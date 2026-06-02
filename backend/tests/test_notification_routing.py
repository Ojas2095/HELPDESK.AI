"""
Unit tests for NotificationRoutingMiddleware.
Issues: #1157, #1158, #1162
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch

sys.modules["supabase"] = Mock()
sys.modules["supabase"].create_client = Mock()
sys.modules["dotenv"] = Mock()
sys.modules["dotenv"].load_dotenv = Mock()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.services.notification_routing import (
    NotificationRoutingMiddleware, 
    NotificationType,
    load, 
    get_instance
)


class TestShouldSendPushNotification(unittest.TestCase):
    def setUp(self):
        import backend.services.notification_routing as nr
        nr._instance = None
        self.middleware = NotificationRoutingMiddleware()
        self.middleware._settings_cache = {}

    def test_push_allowed_when_email_enabled(self):
        self.middleware._settings_cache["company-001"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_push_notification("company-001")
        self.assertTrue(result)

    def test_push_blocked_when_email_disabled(self):
        self.middleware._settings_cache["company-002"] = {
            "email_notifications": False,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_push_notification("company-002")
        self.assertFalse(result)

    def test_push_uses_fallback_when_settings_unavailable(self):
        self.middleware._settings_cache = {}
        with patch.object(self.middleware, "_fetch_system_settings") as mock_fetch:
            mock_fetch.return_value = {
                "email_notifications": True,
                "admin_alerts": True,
                "digest_frequency": "daily"
            }
            result = self.middleware.should_send_push_notification("company-003")
            self.assertTrue(result)


class TestShouldSendAdminAlert(unittest.TestCase):
    def setUp(self):
        import backend.services.notification_routing as nr
        nr._instance = None
        self.middleware = NotificationRoutingMiddleware()
        self.middleware._settings_cache = {}

    def test_admin_alert_allowed_when_enabled(self):
        self.middleware._settings_cache["company-001"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_admin_alert("company-001")
        self.assertTrue(result)

    def test_admin_alert_blocked_when_disabled(self):
        self.middleware._settings_cache["company-002"] = {
            "email_notifications": True,
            "admin_alerts": False,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_admin_alert("company-002")
        self.assertFalse(result)

    def test_admin_alert_blocked_when_none(self):
        self.middleware._settings_cache["company-003"] = {
            "email_notifications": True,
            "admin_alerts": None,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_admin_alert("company-003")
        self.assertFalse(result)

    def test_admin_alert_uses_fallback_when_settings_unavailable(self):
        self.middleware._settings_cache = {}
        with patch.object(self.middleware, "_fetch_system_settings") as mock_fetch:
            mock_fetch.return_value = {
                "email_notifications": True,
                "admin_alerts": True,
                "digest_frequency": "daily"
            }
            result = self.middleware.should_send_admin_alert("company-004")
            self.assertTrue(result)


class TestShouldSendEmailNotification(unittest.TestCase):
    def setUp(self):
        import backend.services.notification_routing as nr
        nr._instance = None
        self.middleware = NotificationRoutingMiddleware()
        self.middleware._settings_cache = {}

    def test_email_allowed_when_enabled(self):
        self.middleware._settings_cache["company-001"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_email_notification(
            "company-001", NotificationType.TICKET_ALERT
        )
        self.assertTrue(result)

    def test_email_blocked_when_disabled(self):
        self.middleware._settings_cache["company-002"] = {
            "email_notifications": False,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_email_notification(
            "company-002", NotificationType.TICKET_ALERT
        )
        self.assertFalse(result)

    def test_daily_digest_allowed_when_frequency_daily(self):
        self.middleware._settings_cache["company-003"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_email_notification(
            "company-003", NotificationType.DAILY_DIGEST
        )
        self.assertTrue(result)

    def test_weekly_digest_blocked_when_frequency_daily(self):
        self.middleware._settings_cache["company-004"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        result = self.middleware.should_send_email_notification(
            "company-004", NotificationType.WEEKLY_DIGEST
        )
        self.assertFalse(result)

    def test_digest_blocked_when_frequency_disabled(self):
        self.middleware._settings_cache["company-005"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "disabled"
        }
        result = self.middleware.should_send_email_notification(
            "company-005", NotificationType.DAILY_DIGEST
        )
        self.assertFalse(result)

    def test_weekly_digest_allowed_when_frequency_weekly(self):
        self.middleware._settings_cache["company-006"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "weekly"
        }
        result = self.middleware.should_send_email_notification(
            "company-006", NotificationType.WEEKLY_DIGEST
        )
        self.assertTrue(result)


class TestSystemSettingsFetch(unittest.TestCase):
    def setUp(self):
        import backend.services.notification_routing as nr
        nr._instance = None
        self.middleware = NotificationRoutingMiddleware()
        self.middleware._settings_cache = {}

    @patch("backend.services.notification_routing.create_client")
    def test_fetch_from_database(self, mock_create_client):
        mock_client = Mock()
        mock_response = Mock()
        mock_response.data = {
            "email_notifications": False,
            "admin_alerts": False,
            "digest_frequency": "weekly"
        }
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_client
        result = self.middleware._fetch_system_settings("company-001")
        self.assertFalse(result.get("email_notifications"))
        self.assertFalse(result.get("admin_alerts"))
        self.assertEqual(result.get("digest_frequency"), "weekly")

    @patch("backend.services.notification_routing.create_client")
    def test_fallback_on_db_error(self, mock_create_client):
        mock_client = Mock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("DB Error")
        mock_create_client.return_value = mock_client
        result = self.middleware._fetch_system_settings("company-002")
        self.assertTrue(result.get("email_notifications"))
        self.assertTrue(result.get("admin_alerts"))
        self.assertEqual(result.get("digest_frequency"), "daily")

    def test_caching(self):
        self.middleware._settings_cache["company-001"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        with patch.object(self.middleware, "_fetch_system_settings") as mock_fetch:
            result = self.middleware.get_system_settings("company-001")
            mock_fetch.assert_not_called()
            self.assertTrue(result.get("email_notifications"))


class TestCacheInvalidation(unittest.TestCase):
    def setUp(self):
        import backend.services.notification_routing as nr
        nr._instance = None
        self.middleware = NotificationRoutingMiddleware()
        self.middleware._settings_cache = {}

    def test_invalidate_cache(self):
        self.middleware._settings_cache["company-001"] = {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily"
        }
        self.middleware.invalidate_cache("company-001")
        self.assertNotIn("company-001", self.middleware._settings_cache)

    def test_invalidate_nonexistent_cache(self):
        self.middleware.invalidate_cache("company-999")
        self.assertEqual(self.middleware._settings_cache, {})


class TestSingleton(unittest.TestCase):
    def setUp(self):
        import backend.services.notification_routing as nr
        nr._instance = None

    @patch("backend.services.notification_routing.create_client")
    def test_load_singleton(self, mock_create_client):
        mock_client = Mock()
        mock_create_client.return_value = mock_client
        import backend.services.notification_routing as nr
        nr._instance = None
        instance1 = load()
        instance2 = load()
        self.assertIs(instance1, instance2)
        self.assertIsNotNone(get_instance())
        self.assertIs(get_instance(), instance1)

    @patch("backend.services.notification_routing.create_client")
    def test_get_instance_before_load(self, mock_create_client):
        import backend.services.notification_routing as nr
        nr._instance = None
        self.assertIsNone(get_instance())


if __name__ == "__main__":
    unittest.main(verbosity=2)
