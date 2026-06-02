"""
Unit tests for AutoCloseService run method.
Issue: #1154
"""

import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch

sys.modules['supabase'] = Mock()
sys.modules['supabase'].create_client = Mock()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.services.auto_close_service import AutoCloseService, load, get_instance


class TestAutoCloseServiceRun(unittest.TestCase):

    def setUp(self):
        import backend.services.auto_close_service as acs
        acs._instance = None

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_no_resolved_tickets(self, mock_create_client):
        """Test run() with no resolved tickets returns zero counts."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.data = []
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        self.assertEqual(result["processed_count"], 0)
        self.assertEqual(result["closed_count"], 0)
        self.assertEqual(result["error_count"], 0)
        self.assertEqual(result["skipped_count"], 0)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_closes_old_resolved_tickets(self, mock_create_client):
        """Test that tickets older than auto_close_days are closed."""
        mock_client = Mock()
        old_date = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        mock_tickets_response = Mock()
        mock_tickets_response.data = [{"id": "ticket-001", "company_id": "company-001", "status": "resolved", "updated_at": old_date}]
        mock_settings_response = Mock()
        mock_settings_response.data = {"auto_close_days": 7, "auto_close_enabled": True}
        tickets_eq_mock = Mock()
        tickets_eq_mock.execute.return_value = mock_tickets_response
        tickets_select_mock = Mock()
        tickets_select_mock.eq.return_value = tickets_eq_mock
        tickets_table_mock = Mock()
        tickets_table_mock.select.return_value = tickets_select_mock
        settings_eq_mock = Mock()
        settings_eq_mock.single.return_value = Mock()
        settings_eq_mock.single.return_value.execute.return_value = mock_settings_response
        settings_select_mock = Mock()
        settings_select_mock.eq.return_value = settings_eq_mock
        settings_table_mock = Mock()
        settings_table_mock.select.return_value = settings_select_mock
        def table_side_effect(name):
            if name == "tickets": return tickets_table_mock
            elif name == "system_settings": return settings_table_mock
            return Mock()
        mock_client.table.side_effect = table_side_effect
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        self.assertEqual(result["processed_count"], 1)
        self.assertEqual(result["closed_count"], 1)
        self.assertEqual(result["skipped_count"], 0)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_skips_recent_tickets(self, mock_create_client):
        """Test that tickets newer than auto_close_days are skipped."""
        mock_client = Mock()
        recent_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        mock_tickets_response = Mock()
        mock_tickets_response.data = [{"id": "ticket-002", "company_id": "company-002", "status": "resolved", "updated_at": recent_date}]
        mock_settings_response = Mock()
        mock_settings_response.data = {"auto_close_days": 7, "auto_close_enabled": True}
        tickets_eq_mock = Mock()
        tickets_eq_mock.execute.return_value = mock_tickets_response
        tickets_select_mock = Mock()
        tickets_select_mock.eq.return_value = tickets_eq_mock
        tickets_table_mock = Mock()
        tickets_table_mock.select.return_value = tickets_select_mock
        settings_eq_mock = Mock()
        settings_eq_mock.single.return_value = Mock()
        settings_eq_mock.single.return_value.execute.return_value = mock_settings_response
        settings_select_mock = Mock()
        settings_select_mock.eq.return_value = settings_eq_mock
        settings_table_mock = Mock()
        settings_table_mock.select.return_value = settings_select_mock
        def table_side_effect(name):
            if name == "tickets": return tickets_table_mock
            elif name == "system_settings": return settings_table_mock
            return Mock()
        mock_client.table.side_effect = table_side_effect
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        self.assertEqual(result["processed_count"], 1)
        self.assertEqual(result["closed_count"], 0)
        self.assertEqual(result["skipped_count"], 1)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_skips_when_company_disabled(self, mock_create_client):
        """Test that tickets are skipped when auto-close is disabled for company."""
        mock_client = Mock()
        old_date = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        mock_tickets_response = Mock()
        mock_tickets_response.data = [{"id": "ticket-003", "company_id": "company-003", "status": "resolved", "updated_at": old_date}]
        mock_settings_response = Mock()
        mock_settings_response.data = {"auto_close_days": 7, "auto_close_enabled": False}
        tickets_eq_mock = Mock()
        tickets_eq_mock.execute.return_value = mock_tickets_response
        tickets_select_mock = Mock()
        tickets_select_mock.eq.return_value = tickets_eq_mock
        tickets_table_mock = Mock()
        tickets_table_mock.select.return_value = tickets_select_mock
        settings_eq_mock = Mock()
        settings_eq_mock.single.return_value = Mock()
        settings_eq_mock.single.return_value.execute.return_value = mock_settings_response
        settings_select_mock = Mock()
        settings_select_mock.eq.return_value = settings_eq_mock
        settings_table_mock = Mock()
        settings_table_mock.select.return_value = settings_select_mock
        def table_side_effect(name):
            if name == "tickets": return tickets_table_mock
            elif name == "system_settings": return settings_table_mock
            return Mock()
        mock_client.table.side_effect = table_side_effect
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        self.assertEqual(result["processed_count"], 1)
        self.assertEqual(result["closed_count"], 0)
        self.assertEqual(result["skipped_count"], 1)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_handles_missing_updated_at(self, mock_create_client):
        """Test that tickets with missing updated_at are handled gracefully."""
        mock_client = Mock()
        mock_tickets_response = Mock()
        mock_tickets_response.data = [{"id": "ticket-004", "company_id": "company-004", "status": "resolved", "updated_at": None}]
        mock_settings_response = Mock()
        mock_settings_response.data = {"auto_close_days": 7, "auto_close_enabled": True}
        tickets_eq_mock = Mock()
        tickets_eq_mock.execute.return_value = mock_tickets_response
        tickets_select_mock = Mock()
        tickets_select_mock.eq.return_value = tickets_eq_mock
        tickets_table_mock = Mock()
        tickets_table_mock.select.return_value = tickets_select_mock
        settings_eq_mock = Mock()
        settings_eq_mock.single.return_value = Mock()
        settings_eq_mock.single.return_value.execute.return_value = mock_settings_response
        settings_select_mock = Mock()
        settings_select_mock.eq.return_value = settings_eq_mock
        settings_table_mock = Mock()
        settings_table_mock.select.return_value = settings_select_mock
        def table_side_effect(name):
            if name == "tickets": return tickets_table_mock
            elif name == "system_settings": return settings_table_mock
            return Mock()
        mock_client.table.side_effect = table_side_effect
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        self.assertEqual(result["processed_count"], 1)
        self.assertEqual(result["closed_count"], 0)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_handles_invalid_timestamp(self, mock_create_client):
        """Test that invalid timestamps are counted as errors."""
        mock_client = Mock()
        mock_tickets_response = Mock()
        mock_tickets_response.data = [{"id": "ticket-005", "company_id": "company-005", "status": "resolved", "updated_at": "not-a-valid-date"}]
        mock_settings_response = Mock()
        mock_settings_response.data = {"auto_close_days": 7, "auto_close_enabled": True}
        tickets_eq_mock = Mock()
        tickets_eq_mock.execute.return_value = mock_tickets_response
        tickets_select_mock = Mock()
        tickets_select_mock.eq.return_value = tickets_eq_mock
        tickets_table_mock = Mock()
        tickets_table_mock.select.return_value = tickets_select_mock
        settings_eq_mock = Mock()
        settings_eq_mock.single.return_value = Mock()
        settings_eq_mock.single.return_value.execute.return_value = mock_settings_response
        settings_select_mock = Mock()
        settings_select_mock.eq.return_value = settings_eq_mock
        settings_table_mock = Mock()
        settings_table_mock.select.return_value = settings_select_mock
        def table_side_effect(name):
            if name == "tickets": return tickets_table_mock
            elif name == "system_settings": return settings_table_mock
            return Mock()
        mock_client.table.side_effect = table_side_effect
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        self.assertEqual(result["processed_count"], 1)
        self.assertEqual(result["error_count"], 1)
        self.assertEqual(result["closed_count"], 0)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_uses_default_settings_on_db_error(self, mock_create_client):
        """Test that DB error fallback returns disabled (safe default)."""
        mock_client = Mock()
        old_date = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        mock_tickets_response = Mock()
        mock_tickets_response.data = [{"id": "ticket-006", "company_id": "company-006", "status": "resolved", "updated_at": old_date}]
        settings_eq_mock = Mock()
        settings_eq_mock.single.return_value = Mock()
        settings_eq_mock.single.return_value.execute.side_effect = Exception("DB Error")
        settings_select_mock = Mock()
        settings_select_mock.eq.return_value = settings_eq_mock
        settings_table_mock = Mock()
        settings_table_mock.select.return_value = settings_select_mock
        tickets_eq_mock = Mock()
        tickets_eq_mock.execute.return_value = mock_tickets_response
        tickets_select_mock2 = Mock()
        tickets_select_mock2.eq.return_value = tickets_eq_mock
        tickets_table_mock = Mock()
        tickets_table_mock.select.return_value = tickets_select_mock2
        def table_side_effect(name):
            if name == "tickets": return tickets_table_mock
            elif name == "system_settings": return settings_table_mock
            return Mock()
        mock_client.table.side_effect = table_side_effect
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        # DB fallback returns auto_close_enabled=False (safe default), so tickets are skipped
        self.assertEqual(result["processed_count"], 1)
        self.assertEqual(result["closed_count"], 0)
        self.assertEqual(result["skipped_count"], 1)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "5",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_respects_custom_auto_close_days(self, mock_create_client):
        """Test that custom AUTO_CLOSE_DAYS env var is respected."""
        mock_client = Mock()
        old_date = (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()
        mock_tickets_response = Mock()
        mock_tickets_response.data = [{"id": "ticket-007", "company_id": "company-007", "status": "resolved", "updated_at": old_date}]
        mock_settings_response = Mock()
        mock_settings_response.data = {"auto_close_days": 5, "auto_close_enabled": True}
        tickets_eq_mock = Mock()
        tickets_eq_mock.execute.return_value = mock_tickets_response
        tickets_select_mock = Mock()
        tickets_select_mock.eq.return_value = tickets_eq_mock
        tickets_table_mock = Mock()
        tickets_table_mock.select.return_value = tickets_select_mock
        settings_eq_mock = Mock()
        settings_eq_mock.single.return_value = Mock()
        settings_eq_mock.single.return_value.execute.return_value = mock_settings_response
        settings_select_mock = Mock()
        settings_select_mock.eq.return_value = settings_eq_mock
        settings_table_mock = Mock()
        settings_table_mock.select.return_value = settings_select_mock
        def table_side_effect(name):
            if name == "tickets": return tickets_table_mock
            elif name == "system_settings": return settings_table_mock
            return Mock()
        mock_client.table.side_effect = table_side_effect
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        self.assertEqual(result["processed_count"], 1)
        self.assertEqual(result["closed_count"], 1)
        self.assertEqual(result["skipped_count"], 0)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_run_handles_fatal_error_gracefully(self, mock_create_client):
        """Test that fatal errors in run() are handled and stats returned."""
        mock_client = Mock()
        mock_client.table.side_effect = Exception("Connection refused")
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        result = service.run()
        self.assertIn("error_count", result)
        self.assertGreaterEqual(result["error_count"], 1)


class TestAutoCloseServiceInit(unittest.TestCase):

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key-123",
        "AUTO_CLOSE_DAYS": "14",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 0 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_init_reads_env_vars(self, mock_create_client):
        """Test that constructor reads environment variables correctly."""
        mock_client = Mock()
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        self.assertEqual(service.default_auto_close_days, 14)
        self.assertEqual(service.cron_schedule, "0 0 * * *")
        mock_create_client.assert_called_once_with("http://test.supabase.co", "test-key-123")

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_init_defaults(self, mock_create_client):
        """Test default values when env vars are not set."""
        mock_client = Mock()
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        self.assertEqual(service.default_auto_close_days, 7)
        self.assertEqual(service.cron_schedule, "0 2 * * *")


class TestAutoCloseServiceGetCompanySettings(unittest.TestCase):

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_get_company_settings_from_db(self, mock_create_client):
        """Test fetching settings from database."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.data = {"auto_close_days": 10, "auto_close_enabled": False}
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        settings = service.get_company_settings("company-001")
        self.assertEqual(settings["auto_close_days"], 10)
        self.assertEqual(settings["auto_close_enabled"], False)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_get_company_settings_fallback_on_error(self, mock_create_client):
        """Test fallback to safe disabled defaults when DB query fails."""
        mock_client = Mock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("DB Error")
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        settings = service.get_company_settings("company-002")
        # Per code: fallback is safe default (disabled) to prevent accidental auto-closes
        self.assertEqual(settings["auto_close_days"], 7)
        self.assertEqual(settings["auto_close_enabled"], False)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_is_auto_close_enabled_method(self, mock_create_client):
        """Test is_auto_close_enabled method reads from company settings."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.data = {"auto_close_days": 7, "auto_close_enabled": True}
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        self.assertTrue(service.is_auto_close_enabled("company-003"))

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_get_auto_close_days_method(self, mock_create_client):
        """Test get_auto_close_days method reads from company settings."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.data = {"auto_close_days": 10, "auto_close_enabled": True}
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_client
        service = AutoCloseService()
        self.assertEqual(service.get_auto_close_days("company-004"), 10)


class TestAutoCloseServiceHelpers(unittest.TestCase):

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_load_singleton(self, mock_create_client):
        """Test that load() returns a singleton instance."""
        mock_client = Mock()
        mock_create_client.return_value = mock_client
        import backend.services.auto_close_service as acs
        acs._instance = None
        instance1 = load()
        instance2 = load()
        self.assertIs(instance1, instance2)
        self.assertIsNotNone(get_instance())
        self.assertIs(get_instance(), instance1)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "AUTO_CLOSE_DAYS": "7",
        "AUTO_CLOSE_CRON_SCHEDULE": "0 2 * * *",
    }, clear=True)
    @patch('backend.services.auto_close_service.create_client')
    def test_get_instance_before_load(self, mock_create_client):
        """Test get_instance() returns None before load() is called."""
        import backend.services.auto_close_service as acs
        acs._instance = None
        self.assertIsNone(get_instance())


if __name__ == "__main__":
    unittest.main(verbosity=2)
