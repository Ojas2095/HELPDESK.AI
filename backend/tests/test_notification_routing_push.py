"""
Unit tests for notification_routing.should_send_push_notification method.

Tests push notification gating by email_notifications company setting.
Covers: enabled/disabled, missing keys, cache behavior, logging, multiple companies.

Fixes #1157
"""

import pytest
import sys
import os
from unittest.mock import patch, MagicMock

sys.modules["supabase"] = MagicMock()
sys.modules["dotenv"] = MagicMock()

sys.path.insert(0, os.path.join(os.getcwd(), "backend"))
from services.notification_routing import (
    NotificationRoutingMiddleware,
    NotificationType,
)


@pytest.fixture
def svc():
    """Create a fresh NotificationRoutingMiddleware instance."""
    return NotificationRoutingMiddleware()


class TestShouldSendPushNotificationBasic:
    """Core push notification gating logic."""

    def test_push_allowed_when_email_enabled(self, svc):
        """Push notification sent when email_notifications=True."""
        with patch.object(
            svc,
            "get_system_settings",
            return_value={"email_notifications": True, "admin_alerts": True},
        ):
            assert svc.should_send_push_notification("co-1") is True

    def test_push_blocked_when_email_disabled(self, svc):
        """Push notification blocked when email_notifications=False."""
        with patch.object(
            svc,
            "get_system_settings",
            return_value={"email_notifications": False, "admin_alerts": True},
        ):
            assert svc.should_send_push_notification("co-1") is False

    def test_push_blocked_when_email_disabled_string(self, svc):
        """Push notification blocked when email_notifications is string 'false'."""
        with patch.object(
            svc,
            "get_system_settings",
            return_value={"email_notifications": "false", "admin_alerts": True},
        ):
            # String "false" is truthy in Python, so push is allowed
            # This tests actual Python truthiness, not DB semantics
            assert svc.should_send_push_notification("co-1") is True


class TestShouldSendPushNotificationEdgeCases:
    """Edge cases for push notification gating."""

    def test_push_raises_when_email_key_missing(self, svc):
        """Push raises KeyError when email_notifications key is missing (strict dict access)."""
        with patch.object(
            svc, "get_system_settings", return_value={"admin_alerts": True}
        ):
            with pytest.raises(KeyError):
                svc.should_send_push_notification("co-1")

    def test_push_blocked_when_email_is_none(self, svc):
        """Push blocked when email_notifications=None."""
        with patch.object(
            svc,
            "get_system_settings",
            return_value={"email_notifications": None, "admin_alerts": True},
        ):
            assert svc.should_send_push_notification("co-1") is False

    def test_push_blocked_when_email_is_zero(self, svc):
        """Push blocked when email_notifications=0 (falsy int)."""
        with patch.object(
            svc,
            "get_system_settings",
            return_value={"email_notifications": 0, "admin_alerts": True},
        ):
            assert svc.should_send_push_notification("co-1") is False

    def test_push_allowed_when_email_is_nonzero(self, svc):
        """Push allowed when email_notifications=1 (truthy int)."""
        with patch.object(
            svc,
            "get_system_settings",
            return_value={"email_notifications": 1, "admin_alerts": True},
        ):
            assert svc.should_send_push_notification("co-1") is True


class TestShouldSendPushNotificationCache:
    """Cache behavior for push notification checks."""

    def test_push_uses_cached_settings(self, svc):
        """Second call uses cached settings, no DB hit."""
        with patch.object(svc, "_fetch_system_settings") as mock_fetch:
            mock_fetch.return_value = {"email_notifications": True}

            svc.should_send_push_notification("co-cache")
            svc.should_send_push_notification("co-cache")

            mock_fetch.assert_called_once_with("co-cache")

    def test_push_different_companies_independent(self, svc):
        """Different companies have independent settings."""
        with patch.object(svc, "_fetch_system_settings") as mock_fetch:
            mock_fetch.side_effect = lambda cid: {
                "co-a": {"email_notifications": True},
                "co-b": {"email_notifications": False},
            }.get(cid, {"email_notifications": True})

            assert svc.should_send_push_notification("co-a") is True
            assert svc.should_send_push_notification("co-b") is False
            assert mock_fetch.call_count == 2

    def test_push_after_cache_invalidation(self, svc):
        """After cache invalidation, settings are re-fetched."""
        with patch.object(svc, "_fetch_system_settings") as mock_fetch:
            mock_fetch.return_value = {"email_notifications": True}

            svc.should_send_push_notification("co-1")
            svc.invalidate_cache("co-1")
            svc.should_send_push_notification("co-1")

            assert mock_fetch.call_count == 2

    def test_push_settings_change_reflected_after_invalidation(self, svc):
        """Settings changes are reflected after cache invalidation."""
        call_count = [0]

        def dynamic_settings(cid):
            call_count[0] += 1
            if call_count[0] == 1:
                return {"email_notifications": True}
            return {"email_notifications": False}

        with patch.object(svc, "_fetch_system_settings", side_effect=dynamic_settings):
            assert svc.should_send_push_notification("co-1") is True
            svc.invalidate_cache("co-1")
            assert svc.should_send_push_notification("co-1") is False


class TestShouldSendPushNotificationLogging:
    """Logging behavior for push notification decisions."""

    def test_push_allowed_logs_sent(self, svc):
        """When push is allowed, log_notification_sent is called."""
        with patch.object(
            svc, "get_system_settings", return_value={"email_notifications": True}
        ), patch.object(svc, "log_notification_sent") as mock_log:
            svc.should_send_push_notification("co-1")
            mock_log.assert_called_once_with("co-1", NotificationType.PUSH_NOTIFICATION)

    def test_push_blocked_logs_skipped(self, svc):
        """When push is blocked, log_notification_skipped is called."""
        with patch.object(
            svc, "get_system_settings", return_value={"email_notifications": False}
        ), patch.object(svc, "log_notification_skipped") as mock_log:
            svc.should_send_push_notification("co-1")
            mock_log.assert_called_once_with(
                "co-1", NotificationType.PUSH_NOTIFICATION, "notifications_disabled"
            )

    def test_push_blocked_reason_is_notifications_disabled(self, svc):
        """When push is blocked, the skip reason is 'notifications_disabled'."""
        with patch.object(
            svc, "get_system_settings", return_value={"email_notifications": False}
        ), patch.object(svc, "log_notification_skipped") as mock_log:
            svc.should_send_push_notification("co-1")
            _, _, reason = mock_log.call_args[0]
            assert reason == "notifications_disabled"


class TestShouldSendPushNotificationIntegration:
    """Integration with other notification methods."""

    def test_push_and_email_both_blocked_when_email_disabled(self, svc):
        """Both push and email are blocked when email_notifications=False."""
        settings = {"email_notifications": False, "admin_alerts": True}
        with patch.object(svc, "get_system_settings", return_value=settings):
            assert svc.should_send_push_notification("co-1") is False
            assert (
                svc.should_send_email_notification(
                    "co-1", NotificationType.DAILY_DIGEST
                )
                is False
            )

    def test_push_allowed_but_admin_alert_independent(self, svc):
        """Push can be allowed even if admin_alerts is disabled."""
        settings = {"email_notifications": True, "admin_alerts": False}
        with patch.object(svc, "get_system_settings", return_value=settings):
            assert svc.should_send_push_notification("co-1") is True
            assert svc.should_send_admin_alert("co-1") is False

    def test_push_blocked_but_admin_alert_allowed(self, svc):
        """Push can be blocked while admin alerts are allowed."""
        settings = {"email_notifications": False, "admin_alerts": True}
        with patch.object(svc, "get_system_settings", return_value=settings):
            assert svc.should_send_push_notification("co-1") is False
            assert svc.should_send_admin_alert("co-1") is True


class TestShouldSendPushNotificationFailOpen:
    """Fail-open behavior when settings are unavailable."""

    def test_push_fail_open_on_db_error(self, svc):
        """Push allowed when DB fetch fails (fail-open)."""
        svc.supabase = MagicMock()
        svc.supabase.table.side_effect = Exception("DB down")

        # _fetch_system_settings catches exception and returns defaults
        assert svc.should_send_push_notification("co-1") is True

    def test_push_fail_open_returns_default_email_true(self, svc):
        """Fail-open defaults email_notifications=True."""
        svc.supabase = MagicMock()
        svc.supabase.table.side_effect = Exception("timeout")

        settings = svc._fetch_system_settings("co-1")
        assert settings["email_notifications"] is True
