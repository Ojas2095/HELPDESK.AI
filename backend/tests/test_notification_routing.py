"""
Unit tests for NotificationRoutingMiddleware.

Tests cover:
- NotificationType enum values
- Settings fetching (success, failure, caching)
- Email notification gating (enabled, disabled, digest frequency)
- Admin alert gating
- Push notification gating
- Cache invalidation
- Singleton pattern (load / get_instance)
- Logging behavior
"""

import os
import sys
import logging
from unittest.mock import patch, MagicMock, PropertyMock
from datetime import datetime, timezone

import pytest

# Ensure backend is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.notification_routing import (
    NotificationType,
    NotificationRoutingMiddleware,
    load,
    get_instance,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_singleton():
    """Reset the module-level singleton before each test."""
    import services.notification_routing as mod
    mod._instance = None
    yield
    mod._instance = None


@pytest.fixture(autouse=True)
def _env_vars(monkeypatch):
    """Provide dummy env vars so create_client doesn't blow up."""
    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake-key")


@pytest.fixture
def mock_supabase():
    """Patch supabase.create_client and return the mock table chain."""
    with patch("services.notification_routing.create_client") as mock_create:
        client = MagicMock()
        mock_create.return_value = client
        yield client


@pytest.fixture
def middleware(mock_supabase):
    """Return a fresh NotificationRoutingMiddleware with mocked Supabase."""
    return NotificationRoutingMiddleware()


def _make_settings(email=True, admin=True, digest="daily"):
    """Helper to build a settings dict matching the DB row."""
    return {
        "email_notifications": email,
        "admin_alerts": admin,
        "digest_frequency": digest,
    }


def _configure_db(mock_supabase, settings):
    """Wire the mock supabase chain to return *settings* from .single().execute()."""
    row = MagicMock()
    row.data = settings
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = row


# ---------------------------------------------------------------------------
# NotificationType enum
# ---------------------------------------------------------------------------

class TestNotificationType:
    def test_enum_values(self):
        assert NotificationType.DAILY_DIGEST == "daily_digest"
        assert NotificationType.WEEKLY_DIGEST == "weekly_digest"
        assert NotificationType.TICKET_ALERT == "ticket_alert"
        assert NotificationType.ADMIN_ALERT == "admin_alert"
        assert NotificationType.PUSH_NOTIFICATION == "push_notification"

    def test_enum_member_count(self):
        assert len(NotificationType) == 5

    def test_is_str_subclass(self):
        """NotificationType inherits from str so it can be serialised easily."""
        assert isinstance(NotificationType.DAILY_DIGEST, str)


# ---------------------------------------------------------------------------
# _fetch_system_settings
# ---------------------------------------------------------------------------

class TestFetchSystemSettings:
    def test_returns_db_values(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=False, admin=False, digest="weekly"))
        result = middleware._fetch_system_settings("company-1")
        assert result == {"email_notifications": False, "admin_alerts": False, "digest_frequency": "weekly"}

    def test_defaults_when_db_returns_none(self, middleware, mock_supabase):
        """If response.data is None the fail-open defaults should be used."""
        row = MagicMock()
        row.data = None
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = row
        result = middleware._fetch_system_settings("company-x")
        assert result == {"email_notifications": True, "admin_alerts": True, "digest_frequency": "daily"}

    def test_fail_open_on_exception(self, middleware, mock_supabase):
        """If Supabase raises, the middleware must fail-open (allow everything)."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("db down")
        result = middleware._fetch_system_settings("company-err")
        assert result["email_notifications"] is True
        assert result["admin_alerts"] is True
        assert result["digest_frequency"] == "daily"

    def test_missing_optional_keys_default(self, middleware, mock_supabase):
        """When DB row is missing optional keys, sensible defaults are used."""
        row = MagicMock()
        row.data = {"email_notifications": False}  # missing admin_alerts, digest_frequency
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = row
        result = middleware._fetch_system_settings("company-partial")
        assert result["email_notifications"] is False
        assert result["admin_alerts"] is True       # default
        assert result["digest_frequency"] == "daily" # default


# ---------------------------------------------------------------------------
# get_system_settings (caching)
# ---------------------------------------------------------------------------

class TestGetSystemSettings:
    def test_caches_after_first_fetch(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings())
        middleware.get_system_settings("c1")
        middleware.get_system_settings("c1")
        # The DB should only be queried once
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.assert_called_once()

    def test_different_companies_cached_separately(self, middleware, mock_supabase):
        call_count = 0
        def side_effect():
            nonlocal call_count
            call_count += 1
            row = MagicMock()
            row.data = _make_settings(email=(call_count == 1))
            return row

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = side_effect

        s1 = middleware.get_system_settings("a")
        s2 = middleware.get_system_settings("b")
        assert s1["email_notifications"] is True
        assert s2["email_notifications"] is False


# ---------------------------------------------------------------------------
# should_send_email_notification
# ---------------------------------------------------------------------------

class TestShouldSendEmailNotification:
    def test_allows_when_enabled(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=True, digest="daily"))
        assert middleware.should_send_email_notification("c1", NotificationType.TICKET_ALERT) is True

    def test_blocks_when_email_disabled(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=False))
        assert middleware.should_send_email_notification("c1", NotificationType.TICKET_ALERT) is False

    def test_blocks_daily_digest_when_frequency_disabled(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=True, digest="disabled"))
        assert middleware.should_send_email_notification("c1", NotificationType.DAILY_DIGEST) is False

    def test_blocks_weekly_digest_when_frequency_daily(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=True, digest="daily"))
        assert middleware.should_send_email_notification("c1", NotificationType.WEEKLY_DIGEST) is False

    def test_allows_weekly_digest_when_frequency_weekly(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=True, digest="weekly"))
        assert middleware.should_send_email_notification("c1", NotificationType.WEEKLY_DIGEST) is True

    def test_allows_daily_digest_when_frequency_daily(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=True, digest="daily"))
        assert middleware.should_send_email_notification("c1", NotificationType.DAILY_DIGEST) is True

    def test_ticket_alert_not_affected_by_digest_frequency(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=True, digest="disabled"))
        assert middleware.should_send_email_notification("c1", NotificationType.TICKET_ALERT) is True


# ---------------------------------------------------------------------------
# should_send_admin_alert
# ---------------------------------------------------------------------------

class TestShouldSendAdminAlert:
    def test_allows_when_enabled(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(admin=True))
        assert middleware.should_send_admin_alert("c1") is True

    def test_blocks_when_disabled(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(admin=False))
        assert middleware.should_send_admin_alert("c1") is False


# ---------------------------------------------------------------------------
# should_send_push_notification
# ---------------------------------------------------------------------------

class TestShouldSendPushNotification:
    def test_allows_when_email_enabled(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=True))
        assert middleware.should_send_push_notification("c1") is True

    def test_blocks_when_email_disabled(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=False))
        assert middleware.should_send_push_notification("c1") is False


# ---------------------------------------------------------------------------
# invalidate_cache
# ---------------------------------------------------------------------------

class TestInvalidateCache:
    def test_removes_cached_entry(self, middleware, mock_supabase):
        _configure_db(mock_supabase, _make_settings(email=True))
        middleware.get_system_settings("c1")
        middleware.invalidate_cache("c1")
        # Next call should hit DB again
        _configure_db(mock_supabase, _make_settings(email=False))
        result = middleware.get_system_settings("c1")
        assert result["email_notifications"] is False

    def test_noop_when_key_absent(self, middleware):
        # Should not raise
        middleware.invalidate_cache("nonexistent")


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

class TestLogging:
    def test_log_notification_sent(self, middleware, caplog):
        with caplog.at_level(logging.INFO, logger="services.notification_routing"):
            middleware.log_notification_sent("c1", NotificationType.TICKET_ALERT)
        assert "Notification sent" in caplog.text
        assert "c1" in caplog.text

    def test_log_notification_skipped(self, middleware, caplog):
        with caplog.at_level(logging.WARNING, logger="services.notification_routing"):
            middleware.log_notification_skipped("c1", NotificationType.ADMIN_ALERT, "disabled")
        assert "Notification skipped" in caplog.text
        assert "disabled" in caplog.text

    def test_log_notification_error(self, middleware, caplog):
        with caplog.at_level(logging.ERROR, logger="services.notification_routing"):
            middleware.log_notification_error("c1", NotificationType.PUSH_NOTIFICATION, RuntimeError("boom"))
        assert "Notification error" in caplog.text
        assert "boom" in caplog.text


# ---------------------------------------------------------------------------
# Singleton (load / get_instance)
# ---------------------------------------------------------------------------

class TestSingleton:
    def test_load_creates_instance(self, mock_supabase):
        inst = load()
        assert inst is not None
        assert isinstance(inst, NotificationRoutingMiddleware)

    def test_load_returns_same_instance(self, mock_supabase):
        a = load()
        b = load()
        assert a is b

    def test_get_instance_returns_none_before_load(self):
        assert get_instance() is None

    def test_get_instance_returns_loaded(self, mock_supabase):
        load()
        assert get_instance() is not None
