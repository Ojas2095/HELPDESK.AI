"""
Unit tests for NotificationRoutingMiddleware — should_send_* methods,
settings caching, fail-open behavior, and logging.

All Supabase/DB deps are mocked at module level since the production code
imports them at the top level.
"""

import os
import sys
from unittest.mock import patch, MagicMock, PropertyMock
from datetime import datetime, timezone

# ─── Mock Supabase, dotenv at module level ────────────────────────
_mock_supabase = MagicMock()
sys.modules["supabase"] = MagicMock()
sys.modules["supabase"].create_client = MagicMock(return_value=_mock_supabase)

_mock_dotenv = MagicMock()
sys.modules["dotenv"] = MagicMock()
sys.modules["dotenv"].load_dotenv = MagicMock()

# Import under test
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services"))
from notification_routing import (
    NotificationRoutingMiddleware,
    NotificationType,
    load,
    get_instance,
)
import notification_routing as nr_module

import pytest


# ─── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def middleware():
    """Fresh middleware instance with mocked Supabase."""
    mw = NotificationRoutingMiddleware()
    mw.supabase = MagicMock()
    mw._settings_cache = {}
    return mw


def _mock_settings_response(data):
    """Create a mock Supabase response dict."""
    return MagicMock(data=data)


# ─── Initialization Tests ─────────────────────────────────────────

class TestNotificationRoutingInit:
    """Tests for NotificationRoutingMiddleware initialization."""

    def test_init_creates_supabase_client(self):
        """Initialization creates a Supabase client."""
        mw = NotificationRoutingMiddleware()
        assert mw.supabase is not None

    def test_init_empty_cache(self):
        """Cache starts empty."""
        mw = NotificationRoutingMiddleware()
        assert mw._settings_cache == {}

    def test_init_default_log_level(self):
        """Default log level is 'info'."""
        mw = NotificationRoutingMiddleware()
        assert mw.log_level == "info"

    def test_notification_type_enum_values(self):
        """NotificationType enum has expected values."""
        assert NotificationType.DAILY_DIGEST.value == "daily_digest"
        assert NotificationType.WEEKLY_DIGEST.value == "weekly_digest"
        assert NotificationType.TICKET_ALERT.value == "ticket_alert"
        assert NotificationType.ADMIN_ALERT.value == "admin_alert"
        assert NotificationType.PUSH_NOTIFICATION.value == "push_notification"


# ─── _fetch_system_settings Tests ─────────────────────────────────

class TestFetchSystemSettings:
    """Tests for _fetch_system_settings method."""

    def test_fetch_successful(self, middleware):
        """Fetch returns correct values from Supabase response."""
        mock_response = _mock_settings_response({
            "email_notifications": True,
            "admin_alerts": False,
            "digest_frequency": "weekly"
        })
        middleware.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response

        result = middleware._fetch_system_settings("company-1")
        assert result["email_notifications"] is True
        assert result["admin_alerts"] is False
        assert result["digest_frequency"] == "weekly"

    def test_fetch_returns_defaults_when_no_data(self, middleware):
        """Fetch returns defaults when response has no data."""
        mock_response = _mock_settings_response(None)
        middleware.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response

        result = middleware._fetch_system_settings("company-1")
        assert result["email_notifications"] is True
        assert result["admin_alerts"] is True
        assert result["digest_frequency"] == "daily"

    def test_fetch_fail_open_on_exception(self, middleware):
        """Fail-open: returns defaults when Supabase throws."""
        middleware.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("DB down")

        result = middleware._fetch_system_settings("company-1")
        assert result["email_notifications"] is True
        assert result["admin_alerts"] is True
        assert result["digest_frequency"] == "daily"


# ─── Cache Tests ──────────────────────────────────────────────────

class TestSettingsCache:
    """Tests for get_system_settings caching behavior."""

    def test_cache_miss_fetches_from_db(self, middleware):
        """Cache miss triggers DB lookup."""
        mock_response = _mock_settings_response({
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        })
        middleware.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response

        result = middleware.get_system_settings("company-1")
        assert middleware.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.called
        assert result["email_notifications"] is True

    def test_cache_hit_skips_db(self, middleware):
        """Cache hit does NOT query the DB."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }

        result = middleware.get_system_settings("company-1")
        # DB should NOT be called
        middleware.supabase.table.return_value.select.assert_not_called()
        assert result["email_notifications"] is True

    def test_cache_per_company(self, middleware):
        """Different companies have separate cache entries."""
        middleware._settings_cache["company-a"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        middleware._settings_cache["company-b"] = {
            "email_notifications": False,
            "admin_alerts": False,
            "digest_frequency": "disabled"
        }

        a = middleware.get_system_settings("company-a")
        b = middleware.get_system_settings("company-b")
        assert a["email_notifications"] is True
        assert b["email_notifications"] is False

    def test_invalidate_cache(self, middleware):
        """invalidate_cache removes company from cache."""
        middleware._settings_cache["company-1"] = {"email_notifications": True}
        middleware.invalidate_cache("company-1")
        assert "company-1" not in middleware._settings_cache

    def test_invalidate_non_existent_does_not_error(self, middleware):
        """invalidate_cache on unknown company_id does not raise."""
        middleware.invalidate_cache("nonexistent")  # Should not raise


# ─── should_send_email_notification Tests ─────────────────────────

class TestShouldSendEmail:
    """Tests for should_send_email_notification."""

    def test_allows_when_email_enabled(self, middleware):
        """Returns True when email_notifications is enabled."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        assert middleware.should_send_email_notification("company-1", NotificationType.TICKET_ALERT) is True

    def test_blocks_when_email_disabled(self, middleware):
        """Returns False when email_notifications is disabled."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": False,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        assert middleware.should_send_email_notification("company-1", NotificationType.TICKET_ALERT) is False

    def test_blocks_daily_digest_when_frequency_disabled(self, middleware):
        """Returns False for daily_digest when digest_frequency is 'disabled'."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "disabled"
        }
        assert middleware.should_send_email_notification("company-1", NotificationType.DAILY_DIGEST) is False

    def test_blocks_weekly_digest_when_frequency_disabled(self, middleware):
        """Returns False for weekly_digest when digest_frequency is 'disabled'."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "disabled"
        }
        assert middleware.should_send_email_notification("company-1", NotificationType.WEEKLY_DIGEST) is False

    def test_blocks_weekly_when_frequency_is_daily(self, middleware):
        """Returns False for weekly_digest when frequency is daily."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        assert middleware.should_send_email_notification("company-1", NotificationType.WEEKLY_DIGEST) is False

    def test_allows_daily_digest_when_frequency_is_daily(self, middleware):
        """Returns True for daily_digest when frequency is daily."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        assert middleware.should_send_email_notification("company-1", NotificationType.DAILY_DIGEST) is True

    def test_allows_weekly_digest_when_frequency_is_weekly(self, middleware):
        """Returns True for weekly_digest when frequency is weekly."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "weekly"
        }
        assert middleware.should_send_email_notification("company-1", NotificationType.WEEKLY_DIGEST) is True

    def test_allows_all_when_not_digest_type(self, middleware):
        """Non-digest types pass through when email is enabled."""
        middleware._settings_cache["company-1"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "disabled"
        }
        # TICKET_ALERT should still go through even though digest is disabled
        assert middleware.should_send_email_notification("company-1", NotificationType.TICKET_ALERT) is True


# ─── should_send_admin_alert Tests ────────────────────────────────

class TestShouldSendAdminAlert:
    """Tests for should_send_admin_alert."""

    def test_allows_when_admin_alerts_enabled(self, middleware):
        """Returns True when admin_alerts is enabled."""
        middleware._settings_cache["company-1"] = {"admin_alerts": True}
        assert middleware.should_send_admin_alert("company-1") is True

    def test_blocks_when_admin_alerts_disabled(self, middleware):
        """Returns False when admin_alerts is disabled."""
        middleware._settings_cache["company-1"] = {"admin_alerts": False}
        assert middleware.should_send_admin_alert("company-1") is False


# ─── should_send_push_notification Tests ──────────────────────────

class TestShouldSendPush:
    """Tests for should_send_push_notification."""

    def test_allows_when_email_enabled(self, middleware):
        """Returns True when email_notifications is enabled."""
        middleware._settings_cache["company-1"] = {"email_notifications": True}
        assert middleware.should_send_push_notification("company-1") is True

    def test_blocks_when_email_disabled(self, middleware):
        """Returns False when email_notifications is disabled."""
        middleware._settings_cache["company-1"] = {"email_notifications": False}
        assert middleware.should_send_push_notification("company-1") is False


# ─── Logging Tests ────────────────────────────────────────────────

class TestNotificationLogging:
    """Tests for notification logging."""

    def test_log_notification_sent_contains_company_and_type(self, middleware):
        """log_notification_sent logs company_id and notification_type."""
        with patch("notification_routing.logger") as mock_logger:
            middleware.log_notification_sent("company-1", NotificationType.TICKET_ALERT)
            mock_logger.info.assert_called_once()
            log_msg = mock_logger.info.call_args[0][0]
            assert "company-1" in log_msg
            assert "ticket_alert" in log_msg

    def test_log_notification_skipped_contains_reason(self, middleware):
        """log_notification_skipped includes the skip reason."""
        with patch("notification_routing.logger") as mock_logger:
            middleware.log_notification_skipped(
                "company-1", NotificationType.DAILY_DIGEST, "email_notifications_disabled"
            )
            mock_logger.warning.assert_called_once()
            log_msg = mock_logger.warning.call_args[0][0]
            assert "email_notifications_disabled" in log_msg

    def test_log_notification_error_contains_error_message(self, middleware):
        """log_notification_error includes the error string."""
        with patch("notification_routing.logger") as mock_logger:
            middleware.log_notification_error(
                "company-1", NotificationType.ADMIN_ALERT, Exception("SMTP timeout")
            )
            mock_logger.error.assert_called_once()
            log_msg = mock_logger.error.call_args[0][0]
            assert "SMTP timeout" in log_msg


# ─── Singleton Tests ──────────────────────────────────────────────

class TestSingleton:
    """Tests for load() and get_instance()."""

    def test_load_returns_middleware_instance(self):
        """load() returns a NotificationRoutingMiddleware instance."""
        mw = load()
        assert isinstance(mw, NotificationRoutingMiddleware)

    def test_load_returns_same_instance_on_repeat_call(self):
        """load() returns the same singleton on subsequent calls."""
        nr_module._instance = None
        first = load()
        second = load()
        assert first is second

    def test_get_instance_none_before_load(self):
        """get_instance() returns None before load() is called."""
        nr_module._instance = None
        assert get_instance() is None

    def test_get_instance_after_load(self):
        """get_instance() returns the instance after load()."""
        nr_module._instance = None
        mw = load()
        assert get_instance() is mw