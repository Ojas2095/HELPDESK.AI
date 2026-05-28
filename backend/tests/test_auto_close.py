import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone

from backend.services.auto_close_service import AutoCloseService, load, get_instance
import backend.services.auto_close_service as acs

class TestAutoCloseService(unittest.TestCase):

    @patch('backend.services.auto_close_service.create_client')
    def setUp(self, mock_create_client):
        self.mock_supabase = MagicMock()
        mock_create_client.return_value = self.mock_supabase
        self.service = AutoCloseService()

    def test_get_system_settings_success(self):
        # mock response
        mock_execute = self.mock_supabase.table().select().eq().single().execute
        mock_execute.return_value.data = {
            "auto_close_days": 10,
            "auto_close_enabled": False
        }
        
        settings = self.service.get_system_settings("company1")
        self.assertEqual(settings["auto_close_days"], 10)
        self.assertEqual(settings["auto_close_enabled"], False)

    def test_get_system_settings_fallback(self):
        # mock response exception
        mock_execute = self.mock_supabase.table().select().eq().single().execute
        mock_execute.side_effect = Exception("DB error")
        
        settings = self.service.get_system_settings("company2")
        self.assertEqual(settings["auto_close_days"], self.service.default_auto_close_days)
        self.assertTrue(settings["auto_close_enabled"])
        
    def test_get_system_settings_no_data(self):
        mock_execute = self.mock_supabase.table().select().eq().single().execute
        mock_execute.return_value.data = None
        
        settings = self.service.get_system_settings("company3")
        self.assertEqual(settings["auto_close_days"], self.service.default_auto_close_days)
        self.assertTrue(settings["auto_close_enabled"])
        
    def test_close_ticket_success(self):
        stats = {"closed_count": 0, "error_count": 0}
        
        # mock execute
        mock_execute = self.mock_supabase.table().update().eq().eq().execute
        mock_execute.return_value = MagicMock()
        
        result = self.service._close_ticket("t1", "c1", stats)
        self.assertTrue(result)
        self.assertEqual(stats["closed_count"], 1)
        self.assertEqual(stats["error_count"], 0)

    def test_close_ticket_error(self):
        stats = {"closed_count": 0, "error_count": 0}
        
        mock_execute = self.mock_supabase.table().update().eq().eq().execute
        mock_execute.side_effect = Exception("Update error")
        
        result = self.service._close_ticket("t1", "c1", stats)
        self.assertFalse(result)
        self.assertEqual(stats["closed_count"], 0)
        self.assertEqual(stats["error_count"], 1)

    def test_run_disabled(self):
        self.service.enabled = False
        stats = self.service.run()
        self.assertEqual(stats["status"], "disabled")

    @patch.object(AutoCloseService, 'get_system_settings')
    @patch.object(AutoCloseService, '_close_ticket')
    def test_run_success(self, mock_close_ticket, mock_get_settings):
        # mock resolved tickets
        now = datetime.now(timezone.utc)
        old_date = (now - timedelta(days=10)).isoformat()
        new_date = (now - timedelta(days=2)).isoformat()
        
        mock_execute = self.mock_supabase.table().select().eq().execute
        mock_execute.return_value.data = [
            {"id": "t1", "company_id": "c1", "status": "resolved", "updated_at": old_date},
            {"id": "t2", "company_id": "c1", "status": "resolved", "updated_at": new_date},
            {"id": "t3", "company_id": "c2", "status": "resolved", "updated_at": old_date},
        ]
        
        # mock settings
        def side_effect_settings(company_id):
            if company_id == "c1":
                return {"auto_close_days": 7, "auto_close_enabled": True}
            else:
                return {"auto_close_days": 7, "auto_close_enabled": False}
        
        mock_get_settings.side_effect = side_effect_settings
        
        # close ticket is only called for old tickets in enabled companies
        def close_side_effect(ticket_id, company_id, stats):
            stats["closed_count"] += 1
            return True
        mock_close_ticket.side_effect = close_side_effect
        
        stats = self.service.run()
        
        self.assertEqual(stats["processed_count"], 3)
        self.assertEqual(stats["closed_count"], 1) # t1 is closed
        self.assertEqual(stats["skipped_count"], 2) # t2 is too new, c2 is disabled
        self.assertEqual(stats["error_count"], 0)
        
        mock_close_ticket.assert_called_once_with("t1", "c1", stats)

    @patch.object(AutoCloseService, 'get_system_settings')
    def test_run_error_handling(self, mock_get_settings):
        # Test missing updated_at or invalid format
        mock_execute = self.mock_supabase.table().select().eq().execute
        mock_execute.return_value.data = [
            {"id": "t1", "company_id": "c1", "status": "resolved", "updated_at": None},
            {"id": "t2", "company_id": "c1", "status": "resolved", "updated_at": "invalid-date"},
        ]
        
        mock_get_settings.return_value = {"auto_close_days": 7, "auto_close_enabled": True}
        
        stats = self.service.run()
        
        # t1 is skipped because of missing updated_at (does not increment error_count or skipped_count)
        # t2 raises ValueError because of invalid timestamp, so error_count += 1
        self.assertEqual(stats["error_count"], 1)

    def test_test_query(self):
        mock_execute = self.mock_supabase.table().select().eq().limit().execute
        mock_execute.return_value.data = [{"id": "t1"}]
        
        results = self.service.test_query()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "t1")

    def test_test_query_exception(self):
        mock_execute = self.mock_supabase.table().select().eq().limit().execute
        mock_execute.side_effect = Exception("DB error")
        
        results = self.service.test_query()
        self.assertEqual(results, [])

    @patch('backend.services.auto_close_service.create_client')
    def test_singleton(self, mock_create_client):
        acs._instance = None
        mock_create_client.return_value = MagicMock()
        
        inst1 = load()
        inst2 = get_instance()
        self.assertIsNotNone(inst1)
        self.assertIs(inst1, inst2)
        
if __name__ == '__main__':
    unittest.main()
