import pytest
import sys
import os
from unittest.mock import patch, MagicMock

sys.modules['supabase'] = MagicMock()
sys.modules['dotenv'] = MagicMock()

# Ensure we import the real service, bypassing the conftest stub
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
from services.notification_routing import NotificationRoutingMiddleware, NotificationType


class TestNotificationRoutingNoneHandling:
    """Tests for handling None values in notification_routing service"""

    def test_should_send_admin_alert_with_none_admin_alerts(self):
        """Test that admin_alerts=None returns False"""
        svc = NotificationRoutingMiddleware()

        with patch.object(svc, 'get_system_settings', return_value={"admin_alerts": None}):
            result = svc.should_send_admin_alert("company-123")
            assert result is False

    def test_should_send_admin_alert_with_false_admin_alerts(self):
        """Test that admin_alerts=False returns False"""
        svc = NotificationRoutingMiddleware()

        with patch.object(svc, 'get_system_settings', return_value={"admin_alerts": False}):
            result = svc.should_send_admin_alert("company-123")
            assert result is False

    def test_should_send_admin_alert_with_true_admin_alerts(self):
        """Test that admin_alerts=True returns True"""
        svc = NotificationRoutingMiddleware()

        with patch.object(svc, 'get_system_settings', return_value={"admin_alerts": True}):
            result = svc.should_send_admin_alert("company-123")
            assert result is True


class TestNotificationRoutingEmailGating:
    """Tests for email notification gating rules"""

    def test_email_notifications_globally_disabled(self):
        """Test that when email_notifications is False, should_send_email_notification returns False"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": False,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_email_notification("company-123", NotificationType.DAILY_DIGEST)
            assert result is False

    def test_digest_frequency_disabled(self):
        """Test that digest email is not sent if digest frequency is set to 'disabled'"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "disabled"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_email_notification("company-123", NotificationType.DAILY_DIGEST)
            assert result is False

    def test_digest_frequency_mismatch(self):
        """Test that weekly digest is not sent if frequency is set to daily"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_email_notification("company-123", NotificationType.WEEKLY_DIGEST)
            assert result is False

    def test_digest_frequency_valid(self):
        """Test that digest email is allowed when frequencies align"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "weekly"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_email_notification("company-123", NotificationType.WEEKLY_DIGEST)
            assert result is True


class TestNotificationRoutingPushGating:
    """Tests for push notification gating rules"""

    def test_push_notifications_gate_on_global_email_setting(self):
        """Test that push notifications are disabled if global email_notifications is False"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": False,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_push_notification("company-123")
            assert result is False

    def test_push_notifications_allowed(self):
        """Test that push notifications are allowed if email_notifications is True"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_push_notification("company-123")
            assert result is True


class TestNotificationRoutingDatabaseAndCache:
    """Tests for database fetching and cache behavior"""

    def test_fetch_system_settings_success(self):
        """Test fetching system settings successfully from Supabase"""
        svc = NotificationRoutingMiddleware()
        mock_data = {
            "email_notifications": True,
            "admin_alerts": False,
            "digest_frequency": "weekly"
        }
        
        # Setup mock client behavior
        mock_execute = MagicMock()
        mock_execute.data = mock_data
        
        mock_single = MagicMock()
        mock_single.execute.return_value = mock_execute
        
        mock_eq = MagicMock()
        mock_eq.single.return_value = mock_single
        
        mock_select = MagicMock()
        mock_select.eq.return_value = mock_eq
        
        svc.supabase = MagicMock()
        svc.supabase.table.return_value.select.return_value = mock_select
        
        settings = svc._fetch_system_settings("company-123")
        assert settings["email_notifications"] is True
        assert settings["admin_alerts"] is False
        assert settings["digest_frequency"] == "weekly"

    def test_fetch_system_settings_fail_open(self):
        """Test that on database errors, the middleware degrades gracefully to fail-open"""
        svc = NotificationRoutingMiddleware()
        svc.supabase = MagicMock()
        svc.supabase.table.side_effect = Exception("DB Connection Refused")
        
        settings = svc._fetch_system_settings("company-123")
        assert settings["email_notifications"] is True
        assert settings["admin_alerts"] is True
        assert settings["digest_frequency"] == "daily"

    def test_get_system_settings_cache(self):
        """Test that settings are cached after the first fetch to avoid repeated DB hits"""
        svc = NotificationRoutingMiddleware()
        
        with patch.object(svc, '_fetch_system_settings') as mock_fetch:
            mock_fetch.return_value = {"email_notifications": True}
            
            # First call should hit DB
            settings_first = svc.get_system_settings("company-123")
            # Second call should read from cache
            settings_second = svc.get_system_settings("company-123")
            
            assert settings_first == {"email_notifications": True}
            assert settings_second == {"email_notifications": True}
            mock_fetch.assert_called_once_with("company-123")

    def test_invalidate_cache_removes_cached_entry(self):
        """Test that invalidate_cache removes the cached settings for a company"""
        svc = NotificationRoutingMiddleware()

        with patch.object(svc, '_fetch_system_settings') as mock_fetch:
            mock_fetch.return_value = {"email_notifications": True}

            # Populate cache
            svc.get_system_settings("company-123")
            assert "company-123" in svc._settings_cache

            # Invalidate
            svc.invalidate_cache("company-123")
            assert "company-123" not in svc._settings_cache

    def test_invalidate_cache_triggers_refetch_on_next_call(self):
        """Test that after invalidation, the next get_system_settings call hits the DB again"""
        svc = NotificationRoutingMiddleware()

        with patch.object(svc, '_fetch_system_settings') as mock_fetch:
            mock_fetch.return_value = {"email_notifications": True}

            # Populate cache
            svc.get_system_settings("company-123")
            assert mock_fetch.call_count == 1

            # Invalidate
            svc.invalidate_cache("company-123")

            # Next call should refetch
            svc.get_system_settings("company-123")
            assert mock_fetch.call_count == 2

    def test_invalidate_cache_noop_for_unknown_company(self):
        """Test that invalidating a non-cached company does not raise an error"""
        svc = NotificationRoutingMiddleware()
        # Should not raise
        svc.invalidate_cache("nonexistent-company")

    def test_settings_cached_per_company(self):
        """Test that different companies have independent caches"""
        svc = NotificationRoutingMiddleware()

        with patch.object(svc, '_fetch_system_settings') as mock_fetch:
            mock_fetch.side_effect = [
                {"email_notifications": True},
                {"email_notifications": False}
            ]

            settings_a = svc.get_system_settings("company-A")
            settings_b = svc.get_system_settings("company-B")

            assert settings_a["email_notifications"] is True
            assert settings_b["email_notifications"] is False
            assert mock_fetch.call_count == 2

    def test_fetch_system_settings_with_missing_fields(self):
        """Test that _fetch_system_settings defaults missing fields gracefully"""
        svc = NotificationRoutingMiddleware()

        mock_execute = MagicMock()
        mock_execute.data = {"email_notifications": False}  # Missing admin_alerts, digest_frequency

        mock_single = MagicMock()
        mock_single.execute.return_value = mock_execute

        mock_eq = MagicMock()
        mock_eq.single.return_value = mock_single

        mock_select = MagicMock()
        mock_select.eq.return_value = mock_eq

        svc.supabase = MagicMock()
        svc.supabase.table.return_value.select.return_value = mock_select

        settings = svc._fetch_system_settings("company-123")
        assert settings["email_notifications"] is False
        assert settings["admin_alerts"] is True  # Default
        assert settings["digest_frequency"] == "daily"  # Default


class TestNotificationRoutingAdditionalEmailGating:
    """Additional email notification gating tests"""

    def test_daily_digest_when_frequency_is_daily(self):
        """Test that daily digest is sent when frequency is 'daily'"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_email_notification("company-123", NotificationType.DAILY_DIGEST)
            assert result is True

    def test_ticket_alert_bypasses_digest_frequency_check(self):
        """Test that non-digest notifications (e.g. TICKET_ALERT) are not gated by digest_frequency"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "disabled"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_email_notification("company-123", NotificationType.TICKET_ALERT)
            assert result is True

    def test_weekly_digest_with_weekly_frequency(self):
        """Test that weekly digest is allowed when frequency is 'weekly'"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "weekly"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            result = svc.should_send_email_notification("company-123", NotificationType.WEEKLY_DIGEST)
            assert result is True

    def test_email_disabled_overrides_everything(self):
        """Test that email_notifications=False blocks all notification types"""
        svc = NotificationRoutingMiddleware()
        settings = {
            "email_notifications": False,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        with patch.object(svc, 'get_system_settings', return_value=settings):
            for ntype in NotificationType:
                result = svc.should_send_email_notification("company-123", ntype)
                assert result is False, f"Expected False for {ntype.value} when email_notifications=False"