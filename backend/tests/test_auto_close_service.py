"""
Unit tests for AutoCloseService — get_system_settings, load method,
_close_ticket, run logic, test_query, and singleton.
"""

import os
import sys
from unittest.mock import patch, MagicMock, PropertyMock

# ─── Mock Supabase, dotenv at module level ────────────────────────
sys.modules["supabase"] = MagicMock()
sys.modules["supabase"].create_client = MagicMock()
sys.modules["dotenv"] = MagicMock()
sys.modules["dotenv"].load_dotenv = MagicMock()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services"))
from auto_close_service import AutoCloseService, load, get_instance
import auto_close_service as ac_module

import pytest
from datetime import datetime, timedelta, timezone


# ─── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def service():
    svc = AutoCloseService()
    svc.supabase = MagicMock()
    svc.enabled = True
    svc.default_auto_close_days = 7
    return svc


def _mock_db_response(data):
    return MagicMock(data=data)


# ─── Initialization Tests ─────────────────────────────────────────

class TestAutoCloseInit:
    def test_init_defaults(self):
        svc = AutoCloseService()
        assert svc.supabase is not None
        assert svc.enabled is True
        assert svc.default_auto_close_days == 7

    def test_init_disabled(self):
        with patch.dict(os.environ, {"AUTO_CLOSE_ENABLED": "false"}, clear=False):
            import importlib
            importlib.reload(ac_module)
            svc = ac_module.AutoCloseService()
            assert svc.enabled is False

    def test_init_custom_auto_close_days(self):
        with patch.dict(os.environ, {"AUTO_CLOSE_DAYS": "14"}, clear=False):
            import importlib
            importlib.reload(ac_module)
            svc = ac_module.AutoCloseService()
            assert svc.default_auto_close_days == 14


# ─── get_system_settings Tests ────────────────────────────────────

class TestGetSystemSettings:
    def test_returns_settings_successfully(self, service):
        mock_resp = _mock_db_response({"auto_close_days": 3, "auto_close_enabled": True})
        service.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_resp
        result = service.get_system_settings("company-1")
        assert result["auto_close_days"] == 3
        assert result["auto_close_enabled"] is True

    def test_falls_back_to_defaults_when_no_data(self, service):
        mock_resp = _mock_db_response(None)
        service.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_resp
        result = service.get_system_settings("company-1")
        assert result["auto_close_days"] == 7
        assert result["auto_close_enabled"] is True

    def test_fall_back_to_defaults_on_exception(self, service):
        service.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("DB timeout")
        result = service.get_system_settings("company-1")
        assert result["auto_close_days"] == 7
        assert result["auto_close_enabled"] is True

    def test_returned_dict_has_expected_keys(self, service):
        mock_resp = _mock_db_response({"auto_close_days": 5, "auto_close_enabled": False})
        service.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_resp
        result = service.get_system_settings("company-1")
        assert "auto_close_days" in result
        assert "auto_close_enabled" in result


# ─── _close_ticket Tests ──────────────────────────────────────────

class TestCloseTicket:
    def test_successful_close_updates_ticket(self, service):
        mock_resp = _mock_db_response([{"id": "ticket-1"}])
        service.supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = mock_resp
        stats = {"closed_count": 0, "error_count": 0}
        result = service._close_ticket("ticket-1", "company-1", stats)
        assert result is True
        assert stats["closed_count"] == 1

    def test_failed_close_increments_errors(self, service):
        service.supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.side_effect = Exception("DB error")
        stats = {"closed_count": 0, "error_count": 0}
        result = service._close_ticket("ticket-1", "company-1", stats)
        assert result is False
        assert stats["error_count"] == 1


# ─── run() Logic Tests ────────────────────────────────────────────

class TestRun:
    def test_returns_disabled_when_not_enabled(self, service):
        service.enabled = False
        result = service.run()
        assert result == {"status": "disabled"}

    def test_processes_no_resolved_tickets(self, service):
        mock_resp = _mock_db_response([])
        service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_resp
        result = service.run()
        assert result["processed_count"] == 0
        assert result["closed_count"] == 0

    def test_skips_company_with_auto_close_disabled(self, service):
        # Mock resolved tickets
        mock_tickets_resp = _mock_db_response([
            {"id": "t1", "company_id": "c1", "status": "resolved", "updated_at": "2024-01-01T00:00:00Z"}
        ])
        service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        # Mock settings: auto_close_enabled = False
        service.get_system_settings = MagicMock(return_value={"auto_close_days": 7, "auto_close_enabled": False})
        result = service.run()
        assert result["skipped_count"] == 1
        assert result["closed_count"] == 0

    def test_closes_ticket_older_than_cutoff(self, service):
        old_date = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
        mock_tickets_resp = _mock_db_response([
            {"id": "t1", "company_id": "c1", "status": "resolved", "updated_at": old_date}
        ])
        service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        service.get_system_settings = MagicMock(return_value={"auto_close_days": 7, "auto_close_enabled": True})
        # Do NOT mock _close_ticket — let real logic run; mock the DB update instead
        service.supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = _mock_db_response([{"id": "t1"}])
        result = service.run()
        assert result["closed_count"] == 1

    def test_skips_ticket_newer_than_cutoff(self, service):
        recent_date = datetime.now(timezone.utc).isoformat()
        mock_tickets_resp = _mock_db_response([
            {"id": "t1", "company_id": "c1", "status": "resolved", "updated_at": recent_date}
        ])
        service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        service.get_system_settings = MagicMock(return_value={"auto_close_days": 7, "auto_close_enabled": True})
        result = service.run()
        assert result["skipped_count"] == 1
        assert result["closed_count"] == 0

    def test_handles_missing_updated_at_field(self, service):
        mock_tickets_resp = _mock_db_response([
            {"id": "t1", "company_id": "c1", "status": "resolved"}  # no updated_at
        ])
        service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        service.get_system_settings = MagicMock(return_value={"auto_close_days": 7, "auto_close_enabled": True})
        result = service.run()
        # Should skip gracefully, not crash
        assert result["closed_count"] == 0

    def test_handles_invalid_updated_at_timestamp(self, service):
        mock_tickets_resp = _mock_db_response([
            {"id": "t1", "company_id": "c1", "status": "resolved", "updated_at": "not-a-date"}
        ])
        service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        service.get_system_settings = MagicMock(return_value={"auto_close_days": 7, "auto_close_enabled": True})
        result = service.run()
        assert result["error_count"] == 1

    def test_reports_company_processing_error(self, service):
        mock_tickets_resp = _mock_db_response([
            {"id": "t1", "company_id": "c1", "status": "resolved", "updated_at": "2024-01-01T00:00:00Z"}
        ])
        service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        service.get_system_settings = MagicMock(side_effect=Exception("Unexpected error"))
        result = service.run()
        assert result["error_count"] == 1


# ─── test_query Tests ─────────────────────────────────────────────

class TestTestQuery:
    def test_returns_list_of_tickets(self, service):
        mock_resp = _mock_db_response([{"id": "t1", "title": "Test"}])
        service.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_resp
        result = service.test_query()
        assert len(result) == 1
        assert result[0]["id"] == "t1"

    def test_returns_empty_on_exception(self, service):
        service.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.side_effect = Exception("DB error")
        result = service.test_query()
        assert result == []


# ─── Singleton Tests ──────────────────────────────────────────────

class TestSingleton:
    def test_load_returns_auto_close_service(self):
        # Use the module that was already imported at the top
        mw = ac_module.load()
        assert isinstance(mw, ac_module.AutoCloseService)

    def test_load_returns_same_instance(self):
        ac_module._instance = None
        first = load()
        second = load()
        assert first is second

    def test_get_instance_none_before_load(self):
        ac_module._instance = None
        assert get_instance() is None

    def test_get_instance_after_load(self):
        ac_module._instance = None
        mw = load()
        assert get_instance() is mw