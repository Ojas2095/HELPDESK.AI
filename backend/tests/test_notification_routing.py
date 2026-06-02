"""
Unit tests for NotificationRoutingMiddleware.

Tests the notification routing and gating logic in
backend/services/notification_routing.py.
"""

import sys
import os
from unittest.mock import MagicMock, patch, PropertyMock, call
from datetime import datetime, timezone

# ============================================================
# Mock external dependencies BEFORE importing the service
# ============================================================

_mock_supabase_client = MagicMock(name="supabase_client")
_mock_supabase = MagicMock()
_mock_supabase.create_client.return_value = _mock_supabase_client
sys.modules["supabase"] = _mock_supabase

# Mock dotenv to avoid .env file requirement
_mock_dotenv = MagicMock()
sys.modules["dotenv"] = _mock_dotenv

# Now import
from backend.services.notification_routing import (
    NotificationType,
    NotificationRoutingMiddleware,
    load,
    get_instance,
    _instance as _global_instance,
)


# ============================================================
# Helpers
# ============================================================

def create_middleware() -> NotificationRoutingMiddleware:
    """Create a fresh NotificationRoutingMiddleware with mocked Supabase."""
    middleware = NotificationRoutingMiddleware()
    # Clear the singleton so tests don't interfere
    import backend.services.notification_routing as nr_module
    nr_module._instance = None
    return middleware


def setup_settings_response(middleware, settings_override=None):
    """Setup the Supabase mock to return specific settings."""
    default = {
        "email_notifications": True,
        "admin_alerts": True,
        "digest_frequency": "daily"
    }
    if settings_override:
        default.update(settings_override)

    mock_response = MagicMock()
    mock_response.data = default

    chain = middleware.supabase.table.return_value
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain
    chain.execute.return_value = mock_response


# ============================================================
# NotificationType Enum Tests
# ============================================================

class TestNotificationTypeEnum:
    """Test NotificationType enum values."""

    def test_all_types_defined(self):
        expected = {
            "DAILY_DIGEST", "WEEKLY_DIGEST", "TICKET_ALERT",
            "ADMIN_ALERT", "PUSH_NOTIFICATION"
        }
        actual = {t.value for t in NotificationType}
        assert expected == actual

    def test_string_values_correct(self):
        assert NotificationType.DAILY_DIGEST.value == "daily_digest"
        assert NotificationType.WEEKLY_DIGEST.value == "weekly_digest"
        assert NotificationType.TICKET_ALERT.value == "ticket_alert"
        assert NotificationType.ADMIN_ALERT.value == "admin_alert"
        assert NotificationType.PUSH_NOTIFICATION.value == "push_notification"


# ============================================================
# Initialization Tests
# ============================================================

class TestMiddlewareInit:
    """Test NotificationRoutingMiddleware initialization."""

    def test_creates_supabase_client(self):
        middleware = create_middleware()
        _mock_supabase.create_client.assert_called()

    def test_settings_cache_starts_empty(self):
        middleware = create_middleware()
        assert middleware._settings_cache == {}

    def test_log_level_defaults_to_info(self):
        middleware = create_middleware()
        assert middleware.log_level == "info"


# ============================================================
# Email Notification Tests
# ============================================================

class TestShouldSendEmailNotification:
    """Test should_send_email_notification gating logic."""

    def test_allows_when_email_enabled(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"email_notifications": True})

        result = middleware.should_send_email_notification(
            "company-123", NotificationType.TICKET_ALERT
        )
        assert result == True

    def test_blocks_when_email_disabled(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"email_notifications": False})

        result = middleware.should_send_email_notification(
            "company-123", NotificationType.TICKET_ALERT
        )
        assert result == False

    def test_allows_daily_digest_when_frequency_daily(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {
            "email_notifications": True,
            "digest_frequency": "daily"
        })

        result = middleware.should_send_email_notification(
            "company-123", NotificationType.DAILY_DIGEST
        )
        assert result == True

    def test_blocks_digest_when_frequency_disabled(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {
            "email_notifications": True,
            "digest_frequency": "disabled"
        })

        result = middleware.should_send_email_notification(
            "company-123", NotificationType.DAILY_DIGEST
        )
        assert result == False

    def test_blocks_weekly_digest_when_frequency_daily(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {
            "email_notifications": True,
            "digest_frequency": "daily"
        })

        result = middleware.should_send_email_notification(
            "company-123", NotificationType.WEEKLY_DIGEST
        )
        assert result == False

    def test_allows_weekly_digest_when_frequency_weekly(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {
            "email_notifications": True,
            "digest_frequency": "weekly"
        })

        result = middleware.should_send_email_notification(
            "company-123", NotificationType.WEEKLY_DIGEST
        )
        assert result == True

    def test_allows_ticket_alert_regardless_of_digest_frequency(self):
        """Ticket alerts should not be affected by digest_frequency."""
        middleware = create_middleware()
        setup_settings_response(middleware, {
            "email_notifications": True,
            "digest_frequency": "disabled"
        })

        result = middleware.should_send_email_notification(
            "company-123", NotificationType.TICKET_ALERT
        )
        assert result == True


# ============================================================
# Admin Alert Tests
# ============================================================

class TestShouldSendAdminAlert:
    """Test should_send_admin_alert gating logic."""

    def test_allows_when_admin_alerts_enabled(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"admin_alerts": True})

        result = middleware.should_send_admin_alert("company-123")
        assert result == True

    def test_blocks_when_admin_alerts_disabled(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"admin_alerts": False})

        result = middleware.should_send_admin_alert("company-123")
        assert result == False


# ============================================================
# Push Notification Tests
# ============================================================

class TestShouldSendPushNotification:
    """Test should_send_push_notification gating logic."""

    def test_allows_when_email_notifications_enabled(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"email_notifications": True})

        result = middleware.should_send_push_notification("company-123")
        assert result == True

    def test_blocks_when_email_notifications_disabled(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"email_notifications": False})

        result = middleware.should_send_push_notification("company-123")
        assert result == False


# ============================================================
# Fail-Open Tests
# ============================================================

class TestFailOpenBehavior:
    """Test that the middleware fails open (allows notifications)
    when settings are unavailable."""

    def test_email_notification_fail_open(self):
        middleware = create_middleware()
        # Simulate Supabase error
        middleware.supabase.table.side_effect = Exception("DB down")

        result = middleware.should_send_email_notification(
            "company-123", NotificationType.TICKET_ALERT
        )
        assert result == True

    def test_admin_alert_fail_open(self):
        middleware = create_middleware()
        middleware.supabase.table.side_effect = Exception("DB down")

        result = middleware.should_send_admin_alert("company-123")
        assert result == True

    def test_push_notification_fail_open(self):
        middleware = create_middleware()
        middleware.supabase.table.side_effect = Exception("DB down")

        result = middleware.should_send_push_notification("company-123")
        assert result == True

    def test_fail_open_returns_default_settings(self):
        middleware = create_middleware()
        middleware.supabase.table.side_effect = Exception("DB down")

        settings = middleware._fetch_system_settings("company-123")
        assert settings["email_notifications"] == True
        assert settings["admin_alerts"] == True
        assert settings["digest_frequency"] == "daily"


# ============================================================
# Caching Tests
# ============================================================

class TestSettingsCaching:
    """Test settings caching behavior."""

    def test_settings_cached_after_first_fetch(self):
        middleware = create_middleware()
        setup_settings_response(middleware)

        # First call should fetch from DB
        middleware.get_system_settings("company-123")

        # Reset the mock to track new calls
        middleware.supabase.table.reset_mock()

        # Second call should use cache
        middleware.get_system_settings("company-123")

        # Supabase should NOT be called again
        middleware.supabase.table.assert_not_called()

    def test_different_companies_have_separate_cache_entries(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"email_notifications": True})
        middleware.get_system_settings("company-A")

        setup_settings_response(middleware, {"email_notifications": False})
        middleware.get_system_settings("company-B")

        assert middleware._settings_cache["company-A"]["email_notifications"] == True
        assert middleware._settings_cache["company-B"]["email_notifications"] == False


# ============================================================
# Cache Invalidation Tests
# ============================================================

class TestCacheInvalidation:
    """Test cache invalidation."""

    def test_invalidate_removes_cached_entry(self):
        middleware = create_middleware()
        setup_settings_response(middleware)
        middleware.get_system_settings("company-123")

        assert "company-123" in middleware._settings_cache

        middleware.invalidate_cache("company-123")

        assert "company-123" not in middleware._settings_cache

    def test_invalidate_nonexistent_key_no_error(self):
        middleware = create_middleware()
        # Should not raise
        middleware.invalidate_cache("nonexistent")

    def test_after_invalidation_re_fetches(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"email_notifications": True})
        middleware.get_system_settings("company-123")
        middleware.invalidate_cache("company-123")

        # Change settings
        setup_settings_response(middleware, {"email_notifications": False})
        settings = middleware.get_system_settings("company-123")

        assert settings["email_notifications"] == False


# ============================================================
# Singleton Pattern Tests
# ============================================================

class TestSingletonPattern:
    """Test the singleton pattern for NotificationRoutingMiddleware."""

    def setup_method(self):
        # Reset singleton before each test
        import backend.services.notification_routing as nr_module
        nr_module._instance = None

    def test_load_creates_instance(self):
        instance = load()
        assert instance is not None
        assert isinstance(instance, NotificationRoutingMiddleware)

    def test_load_returns_same_instance(self):
        first = load()
        second = load()
        assert first is second

    def test_get_instance_returns_none_before_load(self):
        import backend.services.notification_routing as nr_module
        nr_module._instance = None
        assert get_instance() is None

    def test_get_instance_returns_instance_after_load(self):
        load()
        instance = get_instance()
        assert instance is not None


# ============================================================
# Integration: Multiple notification types for same company
# ============================================================

class TestMultipleNotificationTypes:
    """Test interactions between different notification types
    for the same company."""

    def test_all_notifications_blocked_when_email_disabled(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {"email_notifications": False})

        assert middleware.should_send_email_notification(
            "company-123", NotificationType.TICKET_ALERT
        ) == False
        assert middleware.should_send_push_notification("company-123") == False

    def test_admin_alerts_independent_of_email_setting(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {
            "email_notifications": False,
            "admin_alerts": True
        })

        assert middleware.should_send_admin_alert("company-123") == True
        assert middleware.should_send_email_notification(
            "company-123", NotificationType.TICKET_ALERT
        ) == False

    def test_digest_blocked_but_alerts_allowed(self):
        middleware = create_middleware()
        setup_settings_response(middleware, {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "disabled"
        })

        assert middleware.should_send_email_notification(
            "company-123", NotificationType.DAILY_DIGEST
        ) == False
        assert middleware.should_send_email_notification(
            "company-123", NotificationType.TICKET_ALERT
        ) == True


# ============================================================
# Edge Cases
# ============================================================

class TestEdgeCases:
    """Edge case and robustness tests."""

    def test_empty_company_id(self):
        middleware = create_middleware()
        setup_settings_response(middleware)
        result = middleware.should_send_email_notification(
            "", NotificationType.TICKET_ALERT
        )
        assert isinstance(result, bool)

    def test_very_long_company_id(self):
        middleware = create_middleware()
        setup_settings_response(middleware)
        long_id = "c" * 1000
        result = middleware.should_send_email_notification(
            long_id, NotificationType.TICKET_ALERT
        )
        assert isinstance(result, bool)

    def test_special_characters_in_company_id(self):
        middleware = create_middleware()
        setup_settings_response(middleware)
        result = middleware.should_send_email_notification(
            "company-123!@#$%^&*()", NotificationType.TICKET_ALERT
        )
        assert isinstance(result, bool)

    def test_null_data_from_supabase(self):
        middleware = create_middleware()
        mock_response = MagicMock()
        mock_response.data = None

        chain = middleware.supabase.table.return_value
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.single.return_value = chain
        chain.execute.return_value = mock_response

        # Should fail-open
        result = middleware.should_send_email_notification(
            "company-123", NotificationType.TICKET_ALERT
        )
        assert result == True

    def test_settings_cache_can_handle_many_companies(self):
        middleware = create_middleware()
        setup_settings_response(middleware)

        for i in range(100):
            middleware._settings_cache[f"company-{i}"] = {
                "email_notifications": True,
                "admin_alerts": True,
                "digest_frequency": "daily"
            }

        assert len(middleware._settings_cache) == 100
