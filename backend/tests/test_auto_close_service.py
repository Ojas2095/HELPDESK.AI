import importlib
import os
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class _Query:
    def __init__(self, table):
        self.table = table
        self.filters = []
        self.update_payload = None
        self.limit_count = None

    def select(self, *_args):
        return self

    def update(self, payload):
        self.update_payload = payload
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def single(self):
        return self

    def limit(self, count):
        self.limit_count = count
        return self

    def execute(self):
        return self.table.execute(self)


class _Table:
    def __init__(self, name, client):
        self.name = name
        self.client = client

    def select(self, *args):
        return _Query(self).select(*args)

    def update(self, payload):
        return _Query(self).update(payload)

    def execute(self, query):
        if self.name == "system_settings":
            company_id = dict(query.filters).get("company_id")
            return types.SimpleNamespace(data=self.client.settings.get(company_id))
        if self.name == "tickets" and query.update_payload is None:
            rows = list(self.client.tickets)
            for key, value in query.filters:
                rows = [row for row in rows if row.get(key) == value]
            if query.limit_count is not None:
                rows = rows[: query.limit_count]
            return types.SimpleNamespace(data=rows)
        if self.name == "tickets" and query.update_payload is not None:
            filters = dict(query.filters)
            self.client.closed.append(
                {
                    "id": filters.get("id"),
                    "company_id": filters.get("company_id"),
                    "payload": query.update_payload,
                }
            )
            return types.SimpleNamespace(data=query.update_payload)
        return types.SimpleNamespace(data=None)


class _FakeSupabaseClient:
    def __init__(self):
        self.settings = {}
        self.tickets = []
        self.closed = []

    def table(self, name):
        return _Table(name, self)


fake_client = _FakeSupabaseClient()


def _create_client(_url, _key):
    return fake_client


fake_supabase = types.ModuleType("supabase")
fake_supabase.create_client = _create_client
sys.modules.setdefault("supabase", fake_supabase)

fake_dotenv = types.ModuleType("dotenv")
fake_dotenv.load_dotenv = lambda: None
sys.modules.setdefault("dotenv", fake_dotenv)

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")

auto_close_service = importlib.import_module("backend.services.auto_close_service")
AutoCloseService = auto_close_service.AutoCloseService


class AutoCloseServiceTests(unittest.TestCase):
    def setUp(self):
        fake_client.settings = {}
        fake_client.tickets = []
        fake_client.closed = []
        os.environ["AUTO_CLOSE_ENABLED"] = "true"
        os.environ["AUTO_CLOSE_DAYS"] = "7"

    def test_get_system_settings_uses_company_settings_when_available(self):
        fake_client.settings["company-1"] = {
            "auto_close_days": 3,
            "auto_close_enabled": False,
        }
        service = AutoCloseService()

        self.assertEqual(
            service.get_system_settings("company-1"),
            {"auto_close_days": 3, "auto_close_enabled": False},
        )

    def test_run_closes_only_resolved_tickets_older_than_company_cutoff(self):
        old_date = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        recent_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        fake_client.settings["company-1"] = {
            "auto_close_days": 7,
            "auto_close_enabled": True,
        }
        fake_client.tickets = [
            {"id": "old-ticket", "company_id": "company-1", "status": "resolved", "updated_at": old_date},
            {"id": "recent-ticket", "company_id": "company-1", "status": "resolved", "updated_at": recent_date},
            {"id": "open-ticket", "company_id": "company-1", "status": "open", "updated_at": old_date},
        ]
        service = AutoCloseService()

        stats = service.run()

        self.assertEqual(stats["processed_count"], 2)
        self.assertEqual(stats["closed_count"], 1)
        self.assertEqual(stats["skipped_count"], 1)
        self.assertEqual(fake_client.closed[0]["id"], "old-ticket")
        self.assertTrue(fake_client.closed[0]["payload"]["auto_closed"])

    def test_run_skips_company_when_auto_close_is_disabled(self):
        old_date = (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()
        fake_client.settings["company-2"] = {
            "auto_close_days": 7,
            "auto_close_enabled": False,
        }
        fake_client.tickets = [
            {"id": "old-ticket", "company_id": "company-2", "status": "resolved", "updated_at": old_date},
        ]
        service = AutoCloseService()

        stats = service.run()

        self.assertEqual(stats["closed_count"], 0)
        self.assertEqual(stats["skipped_count"], 1)
        self.assertEqual(fake_client.closed, [])


if __name__ == "__main__":
    unittest.main()
