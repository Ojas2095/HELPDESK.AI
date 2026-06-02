"""
Tests for backend/services/auto_close_service.py (Issue #913).
Covers: enabled/disabled toggle, default fallback, DB read for is_enabled_for_company,
company-specific settings, run() with disabled flag, run() closes old tickets,
run() skips recent tickets, get_system_settings alias handling.
"""

import sys
import os
import unittest
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))


def _make_supabase_mock(settings_data=None, tickets_data=None, raise_exc=None):
    """Build a minimal mock Supabase client."""
    client = MagicMock()
    settings_result = MagicMock()
    settings_result.data = settings_data

    tickets_result = MagicMock()
    tickets_result.data = tickets_data or []

    update_result = MagicMock()
    update_result.data = [{"id": "t1", "status": "closed"}]

    builder = MagicMock()
    builder.select.return_value = builder
    builder.eq.return_value = builder
    builder.single.return_value = builder
    builder.update.return_value = builder
    builder.order.return_value = builder

    if raise_exc:
        builder.execute.side_effect = raise_exc
    else:
        # First call: settings, subsequent calls: tickets & update
        builder.execute.side_effect = [
            settings_result,
            tickets_result,
            update_result,
        ]

    client.table.return_value = builder
    return client


def _build_service(enabled_env="true", mock_supabase=None):
    """Create an AutoCloseService with mocked Supabase and env vars."""
    from backend.services.auto_close_service import AutoCloseService
    svc = AutoCloseService.__new__(AutoCloseService)
    svc.supabase = mock_supabase or MagicMock()
    svc.enabled = enabled_env.lower() == "true"
    svc.default_auto_close_days = 7
    svc.cron_schedule = "0 2 * * *"
    return svc


class TestAutoCloseEnabledToggle(unittest.TestCase):
    def test_run_returns_disabled_when_env_false(self):
        svc = _build_service(enabled_env="false")
        result = svc.run()
        self.assertEqual(result["status"], "disabled")

    def test_run_proceeds_when_env_true(self):
        mock_sb = MagicMock()
        # simulate no resolved tickets
        res = MagicMock()
        res.data = []
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.execute.return_value = res
        mock_sb.table.return_value = builder

        svc = _build_service(enabled_env="true", mock_supabase=mock_sb)
        result = svc.run()
        self.assertNotEqual(result.get("status"), "disabled")

    def test_enabled_attribute_set_from_env_true(self):
        svc = _build_service("true")
        self.assertTrue(svc.enabled)

    def test_enabled_attribute_set_from_env_false(self):
        svc = _build_service("false")
        self.assertFalse(svc.enabled)


class TestIsEnabledForCompany(unittest.TestCase):
    def test_returns_true_when_db_auto_close_enabled_true(self):
        mock_sb = MagicMock()
        res = MagicMock()
        res.data = {"auto_close_enabled": True, "auto_close_days": 7}
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.single.return_value = builder
        builder.execute.return_value = res
        mock_sb.table.return_value = builder

        svc = _build_service(mock_supabase=mock_sb)
        result = svc.is_enabled_for_company("company-1")
        self.assertTrue(result)

    def test_returns_false_when_db_auto_close_enabled_false(self):
        mock_sb = MagicMock()
        res = MagicMock()
        res.data = {"auto_close_enabled": False}
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.single.return_value = builder
        builder.execute.return_value = res
        mock_sb.table.return_value = builder

        svc = _build_service(mock_supabase=mock_sb)
        result = svc.is_enabled_for_company("company-2")
        self.assertFalse(result)

    def test_falls_back_to_env_on_db_exception(self):
        mock_sb = MagicMock()
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.single.return_value = builder
        builder.execute.side_effect = Exception("DB unavailable")
        mock_sb.table.return_value = builder

        svc = _build_service(enabled_env="true", mock_supabase=mock_sb)
        result = svc.is_enabled_for_company("company-err")
        self.assertTrue(result)

    def test_alias_enable_auto_resolve_used_when_auto_close_enabled_missing(self):
        mock_sb = MagicMock()
        res = MagicMock()
        res.data = {"enable_auto_resolve": True, "auto_close_days": 5}
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.single.return_value = builder
        builder.execute.return_value = res
        mock_sb.table.return_value = builder

        svc = _build_service(mock_supabase=mock_sb)
        result = svc.is_enabled_for_company("company-3")
        self.assertTrue(result)


class TestGetSystemSettings(unittest.TestCase):
    def _mock_settings(self, data):
        mock_sb = MagicMock()
        res = MagicMock()
        res.data = data
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.single.return_value = builder
        builder.execute.return_value = res
        mock_sb.table.return_value = builder
        return mock_sb

    def test_returns_defaults_when_no_data(self):
        mock_sb = self._mock_settings(None)
        svc = _build_service(mock_supabase=mock_sb)
        result = svc.get_system_settings("c1")
        self.assertIn("auto_close_days", result)
        self.assertIn("auto_close_enabled", result)

    def test_returns_db_values(self):
        mock_sb = self._mock_settings({"auto_close_days": 14, "auto_close_enabled": True})
        svc = _build_service(mock_supabase=mock_sb)
        result = svc.get_system_settings("c2")
        self.assertEqual(result["auto_close_days"], 14)
        self.assertTrue(result["auto_close_enabled"])

    def test_defaults_fallback_on_exception(self):
        mock_sb = MagicMock()
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.single.return_value = builder
        builder.execute.side_effect = Exception("network error")
        mock_sb.table.return_value = builder

        svc = _build_service(mock_supabase=mock_sb)
        result = svc.get_system_settings("c3")
        self.assertIsInstance(result, dict)
        self.assertIn("auto_close_days", result)

    def test_default_auto_close_days_is_7(self):
        svc = _build_service()
        svc.supabase = MagicMock()
        svc.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("off")
        result = svc.get_system_settings("c4")
        self.assertEqual(result["auto_close_days"], svc.default_auto_close_days)


class TestRunSkipsRecentTickets(unittest.TestCase):
    def test_recent_ticket_is_skipped(self):
        now = datetime.now(timezone.utc)
        recent_updated_at = (now - timedelta(days=1)).isoformat()

        mock_sb = MagicMock()
        tickets_res = MagicMock()
        tickets_res.data = [{"id": "t1", "company_id": "c1", "status": "resolved",
                              "updated_at": recent_updated_at}]

        settings_res = MagicMock()
        settings_res.data = {"auto_close_days": 7, "auto_close_enabled": True}

        call_count = [0]
        def execute_side_effect():
            call_count[0] += 1
            if call_count[0] == 1:
                return tickets_res
            return settings_res

        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.single.return_value = builder
        builder.execute.side_effect = lambda: execute_side_effect()
        mock_sb.table.return_value = builder

        svc = _build_service(enabled_env="true", mock_supabase=mock_sb)
        # Patch is_enabled_for_company to return True
        svc.is_enabled_for_company = lambda cid: True
        stats = svc.run()
        # Recent ticket should be skipped, not closed
        self.assertEqual(stats.get("closed_count", 0), 0)

    def test_old_ticket_is_closed(self):
        now = datetime.now(timezone.utc)
        old_updated_at = (now - timedelta(days=14)).isoformat()

        mock_sb = MagicMock()

        tickets_res = MagicMock()
        tickets_res.data = [{"id": "t2", "company_id": "c1", "status": "resolved",
                              "updated_at": old_updated_at}]

        settings_res = MagicMock()
        settings_res.data = {"auto_close_days": 7, "auto_close_enabled": True}

        update_res = MagicMock()
        update_res.data = [{"id": "t2", "status": "closed"}]

        call_count = [0]
        def exe():
            call_count[0] += 1
            if call_count[0] == 1:
                return tickets_res
            if call_count[0] == 2:
                return settings_res
            return update_res

        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.single.return_value = builder
        builder.update.return_value = builder
        builder.execute.side_effect = lambda: exe()
        mock_sb.table.return_value = builder

        svc = _build_service(enabled_env="true", mock_supabase=mock_sb)
        svc.is_enabled_for_company = lambda cid: True
        stats = svc.run()
        self.assertGreaterEqual(stats.get("closed_count", 0), 1)


class TestRunReturnStats(unittest.TestCase):
    def test_run_returns_dict_with_expected_keys(self):
        mock_sb = MagicMock()
        res = MagicMock()
        res.data = []
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.execute.return_value = res
        mock_sb.table.return_value = builder

        svc = _build_service(enabled_env="true", mock_supabase=mock_sb)
        stats = svc.run()
        for key in ("processed_count", "closed_count", "error_count", "skipped_count"):
            self.assertIn(key, stats)

    def test_run_error_returns_non_fatal(self):
        mock_sb = MagicMock()
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.execute.side_effect = Exception("fatal DB error")
        mock_sb.table.return_value = builder

        svc = _build_service(enabled_env="true", mock_supabase=mock_sb)
        stats = svc.run()
        self.assertIn("error_count", stats)
Unit tests for AutoCloseService (Issue #279).

Covers:
- __init__ with various env-var configurations
- get_system_settings success / fallback
- _close_ticket success / failure
- run() when service is disabled
- run() with no resolved tickets
- run() closing old resolved tickets
- run() skipping tickets within auto_close window
- run() skipping companies with auto_close disabled
- run() handling missing updated_at fields
- run() handling invalid timestamps
- run() handling exception during company processing
- run() fatal error handling
- test_query success / error
- Singleton pattern (load / get_instance)
"""

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, PropertyMock

# Prevent namespace shadowing of supabase library
_cwd = os.getcwd()
sys.path = [p for p in sys.path if p not in ("", _cwd, os.path.dirname(_cwd))]
try:
    import supabase
finally:
    sys.path.insert(0, _cwd)
    _backend_root = os.path.join(_cwd, "backend") if "backend" not in _cwd else _cwd
    sys.path.insert(0, _backend_root)
    sys.path.insert(0, os.path.dirname(_backend_root))

os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock_service_key"

from backend.services.auto_close_service import (
    AutoCloseService,
    load as load_service,
    get_instance,
)


class _AutoCloseTestBase(unittest.TestCase):
    """Shared setup: patches create_client so no real Supabase calls happen."""

    def setUp(self):
        self.patcher = patch("backend.services.auto_close_service.create_client")
        self.mock_create_client = self.patcher.start()
        self.mock_supabase = MagicMock()
        self.mock_create_client.return_value = self.mock_supabase
        self.service = AutoCloseService()

    def tearDown(self):
        self.patcher.stop()


# ---------------------------------------------------------------------------
# __init__ / configuration
# ---------------------------------------------------------------------------

class TestAutoCloseInit(_AutoCloseTestBase):

    def test_defaults_from_env(self):
        self.assertTrue(self.service.enabled)
        self.assertEqual(self.service.default_auto_close_days, 7)
        self.assertEqual(self.service.cron_schedule, "0 2 * * *")
        self.mock_create_client.assert_called_once_with(
            "https://example.supabase.co", "mock_service_key"
        )

    @patch.dict(os.environ, {"AUTO_CLOSE_ENABLED": "false"})
    def test_disabled_via_env(self):
        svc = AutoCloseService()
        self.assertFalse(svc.enabled)

    @patch.dict(os.environ, {"AUTO_CLOSE_ENABLED": "FALSE"})
    def test_disabled_case_insensitive(self):
        svc = AutoCloseService()
        self.assertFalse(svc.enabled)

    @patch.dict(os.environ, {"AUTO_CLOSE_DAYS": "14"})
    def test_custom_auto_close_days(self):
        svc = AutoCloseService()
        self.assertEqual(svc.default_auto_close_days, 14)

    @patch.dict(os.environ, {"AUTO_CLOSE_CRON_SCHEDULE": "0 5 * * 1"})
    def test_custom_cron_schedule(self):
        svc = AutoCloseService()
        self.assertEqual(svc.cron_schedule, "0 5 * * 1")


# ---------------------------------------------------------------------------
# get_system_settings
# ---------------------------------------------------------------------------

class TestGetSystemSettings(_AutoCloseTestBase):

    def test_returns_db_settings_when_found(self):
        mock_resp = MagicMock()
        mock_resp.data = {"auto_close_days": 5, "auto_close_enabled": False}
        chain = self.mock_supabase.table.return_value
        chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_resp

        result = self.service.get_system_settings("company-123")
        self.assertEqual(result["auto_close_days"], 5)
        self.assertFalse(result["auto_close_enabled"])

    def test_falls_back_to_defaults_on_exception(self):
        self.mock_supabase.table.side_effect = Exception("connection refused")

        result = self.service.get_system_settings("company-bad")
        self.assertEqual(result["auto_close_days"], 7)
        self.assertTrue(result["auto_close_enabled"])

    def test_falls_back_when_data_is_none(self):
        mock_resp = MagicMock()
        mock_resp.data = None
        chain = self.mock_supabase.table.return_value
        chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_resp

        result = self.service.get_system_settings("company-empty")
        # When data is None, the code returns defaults because `if response.data:` is falsy
        self.assertEqual(result["auto_close_days"], 7)
        self.assertTrue(result["auto_close_enabled"])


# ---------------------------------------------------------------------------
# _close_ticket
# ---------------------------------------------------------------------------

class TestCloseTicket(_AutoCloseTestBase):

    def test_successful_close(self):
        stats = {"closed_count": 0, "error_count": 0}
        self.mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()

        result = self.service._close_ticket("t-1", "c-1", stats)
        self.assertTrue(result)
        self.assertEqual(stats["closed_count"], 1)
        self.assertEqual(stats["error_count"], 0)

    def test_failed_close(self):
        stats = {"closed_count": 0, "error_count": 0}
        self.mock_supabase.table.side_effect = Exception("db down")

        result = self.service._close_ticket("t-1", "c-1", stats)
        self.assertFalse(result)
        self.assertEqual(stats["closed_count"], 0)
        self.assertEqual(stats["error_count"], 1)

    def test_multiple_successes_increment_counter(self):
        stats = {"closed_count": 0, "error_count": 0}
        self.mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()

        self.service._close_ticket("t-1", "c-1", stats)
        self.service._close_ticket("t-2", "c-1", stats)
        self.assertEqual(stats["closed_count"], 2)


# ---------------------------------------------------------------------------
# run()
# ---------------------------------------------------------------------------

class TestRun(_AutoCloseTestBase):

    def test_returns_disabled_status(self):
        self.service.enabled = False
        result = self.service.run()
        self.assertEqual(result, {"status": "disabled"})

    def test_no_resolved_tickets(self):
        self.service.enabled = True
        mock_resp = MagicMock()
        mock_resp.data = []
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_resp

        result = self.service.run()
        self.assertEqual(result["processed_count"], 0)
        self.assertEqual(result["closed_count"], 0)
        self.assertEqual(result["skipped_count"], 0)

    def test_closes_old_resolved_tickets(self):
        """Tickets resolved more than auto_close_days ago should be closed."""
        self.service.enabled = True
        old_time = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        tickets = [
            {"id": "t-1", "company_id": "c-1", "status": "resolved", "updated_at": old_time},
        ]
        # First call: fetch resolved tickets
        mock_tickets_resp = MagicMock()
        mock_tickets_resp.data = tickets
        # Second call: get_system_settings for c-1
        mock_settings_resp = MagicMock()
        mock_settings_resp.data = {"auto_close_days": 7, "auto_close_enabled": True}
        # Third call: close ticket
        mock_close_resp = MagicMock()

        table_mock = self.mock_supabase.table
        # Chain for tickets select ... eq ... execute
        tickets_chain = MagicMock()
        tickets_chain.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        # Chain for system_settings select ... eq ... single ... execute
        settings_chain = MagicMock()
        settings_chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_settings_resp
        # Chain for tickets update ... eq ... eq ... execute
        close_chain = MagicMock()
        close_chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = mock_close_resp

        call_sequence = [tickets_chain, settings_chain, close_chain]
        call_idx = {"i": 0}
        def table_side_effect(name):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return call_sequence[idx]
        table_mock.side_effect = table_side_effect

        result = self.service.run()
        self.assertEqual(result["closed_count"], 1)

    def test_skips_tickets_within_window(self):
        """Recently resolved tickets should NOT be closed."""
        self.service.enabled = True
        recent_time = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        tickets = [
            {"id": "t-2", "company_id": "c-1", "status": "resolved", "updated_at": recent_time},
        ]
        mock_tickets_resp = MagicMock()
        mock_tickets_resp.data = tickets
        mock_settings_resp = MagicMock()
        mock_settings_resp.data = {"auto_close_days": 7, "auto_close_enabled": True}

        tickets_chain = MagicMock()
        tickets_chain.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        settings_chain = MagicMock()
        settings_chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_settings_resp

        call_sequence = [tickets_chain, settings_chain]
        call_idx = {"i": 0}
        def table_side_effect(name):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return call_sequence[idx]
        self.mock_supabase.table.side_effect = table_side_effect

        result = self.service.run()
        self.assertEqual(result["closed_count"], 0)
        self.assertEqual(result["skipped_count"], 1)

    def test_skips_company_with_auto_close_disabled(self):
        """When auto_close_enabled is False for a company, all its tickets are skipped."""
        self.service.enabled = True
        old_time = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        tickets = [
            {"id": "t-3", "company_id": "c-2", "status": "resolved", "updated_at": old_time},
        ]
        mock_tickets_resp = MagicMock()
        mock_tickets_resp.data = tickets
        mock_settings_resp = MagicMock()
        mock_settings_resp.data = {"auto_close_days": 7, "auto_close_enabled": False}

        tickets_chain = MagicMock()
        tickets_chain.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        settings_chain = MagicMock()
        settings_chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_settings_resp

        call_sequence = [tickets_chain, settings_chain]
        call_idx = {"i": 0}
        def table_side_effect(name):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return call_sequence[idx]
        self.mock_supabase.table.side_effect = table_side_effect

        result = self.service.run()
        self.assertEqual(result["closed_count"], 0)
        self.assertEqual(result["skipped_count"], 1)

    def test_handles_missing_updated_at(self):
        """Tickets without updated_at should be skipped gracefully."""
        self.service.enabled = True
        tickets = [
            {"id": "t-4", "company_id": "c-1", "status": "resolved", "updated_at": None},
        ]
        mock_tickets_resp = MagicMock()
        mock_tickets_resp.data = tickets
        mock_settings_resp = MagicMock()
        mock_settings_resp.data = {"auto_close_days": 7, "auto_close_enabled": True}

        tickets_chain = MagicMock()
        tickets_chain.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        settings_chain = MagicMock()
        settings_chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_settings_resp

        call_sequence = [tickets_chain, settings_chain]
        call_idx = {"i": 0}
        def table_side_effect(name):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return call_sequence[idx]
        self.mock_supabase.table.side_effect = table_side_effect

        result = self.service.run()
        # Ticket was neither closed nor explicitly skipped — the continue skips it
        self.assertEqual(result["closed_count"], 0)

    def test_handles_invalid_timestamp(self):
        """Malformed timestamp should increment error_count."""
        self.service.enabled = True
        tickets = [
            {"id": "t-5", "company_id": "c-1", "status": "resolved", "updated_at": "not-a-date"},
        ]
        mock_tickets_resp = MagicMock()
        mock_tickets_resp.data = tickets
        mock_settings_resp = MagicMock()
        mock_settings_resp.data = {"auto_close_days": 7, "auto_close_enabled": True}

        tickets_chain = MagicMock()
        tickets_chain.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        settings_chain = MagicMock()
        settings_chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_settings_resp

        call_sequence = [tickets_chain, settings_chain]
        call_idx = {"i": 0}
        def table_side_effect(name):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return call_sequence[idx]
        self.mock_supabase.table.side_effect = table_side_effect

        result = self.service.run()
        self.assertGreaterEqual(result["error_count"], 1)

    def test_handles_z_suffix_in_timestamp(self):
        """ISO timestamps with 'Z' suffix should be parsed correctly."""
        self.service.enabled = True
        old_time = (datetime.now(timezone.utc) - timedelta(days=10)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        tickets = [
            {"id": "t-6", "company_id": "c-1", "status": "resolved", "updated_at": old_time},
        ]
        mock_tickets_resp = MagicMock()
        mock_tickets_resp.data = tickets
        mock_settings_resp = MagicMock()
        mock_settings_resp.data = {"auto_close_days": 7, "auto_close_enabled": True}
        mock_close_resp = MagicMock()

        tickets_chain = MagicMock()
        tickets_chain.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp
        settings_chain = MagicMock()
        settings_chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_settings_resp
        close_chain = MagicMock()
        close_chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = mock_close_resp

        call_sequence = [tickets_chain, settings_chain, close_chain]
        call_idx = {"i": 0}
        def table_side_effect(name):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return call_sequence[idx]
        self.mock_supabase.table.side_effect = table_side_effect

        result = self.service.run()
        self.assertEqual(result["closed_count"], 1)

    def test_fatal_error_returns_error_stats(self):
        """Top-level exception should be caught and counted."""
        self.service.enabled = True
        self.mock_supabase.table.side_effect = Exception("catastrophic failure")

        result = self.service.run()
        self.assertGreaterEqual(result["error_count"], 1)

    def test_multi_company_grouping(self):
        """Tickets from different companies should be grouped and processed separately."""
        self.service.enabled = True
        old_time = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        tickets = [
            {"id": "t-10", "company_id": "c-A", "status": "resolved", "updated_at": old_time},
            {"id": "t-11", "company_id": "c-B", "status": "resolved", "updated_at": old_time},
        ]
        mock_tickets_resp = MagicMock()
        mock_tickets_resp.data = tickets

        mock_settings_A = MagicMock()
        mock_settings_A.data = {"auto_close_days": 7, "auto_close_enabled": True}
        mock_settings_B = MagicMock()
        mock_settings_B.data = {"auto_close_days": 3, "auto_close_enabled": True}

        mock_close = MagicMock()

        tickets_chain = MagicMock()
        tickets_chain.select.return_value.eq.return_value.execute.return_value = mock_tickets_resp

        settings_A_chain = MagicMock()
        settings_A_chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_settings_A
        close_A_chain = MagicMock()
        close_A_chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = mock_close

        settings_B_chain = MagicMock()
        settings_B_chain.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_settings_B
        close_B_chain = MagicMock()
        close_B_chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = mock_close

        # tickets -> settings_A -> close_A -> settings_B -> close_B
        chains = [tickets_chain, settings_A_chain, close_A_chain, settings_B_chain, close_B_chain]
        call_idx = {"i": 0}

        def table_side_effect(name):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return chains[idx]
        self.mock_supabase.table.side_effect = table_side_effect

        result = self.service.run()
        self.assertEqual(result["processed_count"], 2)
        self.assertEqual(result["closed_count"], 2)


# ---------------------------------------------------------------------------
# test_query
# ---------------------------------------------------------------------------

class TestQuery(_AutoCloseTestBase):

    def test_returns_resolved_tickets(self):
        mock_resp = MagicMock()
        mock_resp.data = [
            {"id": "t-1", "company_id": "c-1", "status": "resolved", "updated_at": "2025-01-01T00:00:00Z", "title": "Issue"},
        ]
        chain = self.mock_supabase.table.return_value
        chain.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_resp

        result = self.service.test_query()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "t-1")

    def test_returns_empty_on_error(self):
        self.mock_supabase.table.side_effect = Exception("query failed")

        result = self.service.test_query()
        self.assertEqual(result, [])

    def test_returns_empty_when_no_data(self):
        mock_resp = MagicMock()
        mock_resp.data = None
        chain = self.mock_supabase.table.return_value
        chain.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_resp

        result = self.service.test_query()
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# Singleton pattern
# ---------------------------------------------------------------------------

class TestSingleton(unittest.TestCase):

    def tearDown(self):
        # Reset module-level singleton
        import backend.services.auto_close_service as mod
        mod._instance = None

    @patch("backend.services.auto_close_service.create_client")
    def test_load_returns_instance(self, mock_create):
        mock_create.return_value = MagicMock()
        import backend.services.auto_close_service as mod
        mod._instance = None  # ensure clean state

        instance = load_service()
        self.assertIsInstance(instance, AutoCloseService)

    @patch("backend.services.auto_close_service.create_client")
    def test_load_returns_same_instance(self, mock_create):
        mock_create.return_value = MagicMock()
        import backend.services.auto_close_service as mod
        mod._instance = None

        a = load_service()
        b = load_service()
        self.assertIs(a, b)

    def test_get_instance_none_before_load(self):
        import backend.services.auto_close_service as mod
        mod._instance = None
        self.assertIsNone(get_instance())

    @patch("backend.services.auto_close_service.create_client")
    def test_get_instance_after_load(self, mock_create):
        mock_create.return_value = MagicMock()
        import backend.services.auto_close_service as mod
        mod._instance = None

        load_service()
        self.assertIsNotNone(get_instance())


if __name__ == "__main__":
    unittest.main()
