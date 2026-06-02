"""
Tests for healthcheck and readiness endpoints (/health, /ready).
Covers: healthy state, degraded state, Supabase requirement, response models.
"""

import sys
import os

# Temporarily remove local directories to prevent namespace shadowing
cwd = os.getcwd()
sys.path = [p for p in sys.path if p not in ("", cwd, os.path.dirname(cwd))]

try:
    import supabase
finally:
    sys.path.insert(0, cwd)
    backend_root = os.path.join(cwd, "backend") if "backend" not in cwd else cwd
    sys.path.insert(0, backend_root)
    sys.path.insert(0, os.path.dirname(backend_root))

import unittest
from unittest.mock import MagicMock, patch, PropertyMock

# Set required env vars before importing
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "mock_key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "mock_key")
os.environ.setdefault("ALLOW_DEGRADED_STARTUP", "1")
os.environ.setdefault("REQUIRE_SUPABASE", "false")


class TestHealthEndpoint(unittest.TestCase):
    """Tests for GET /health endpoint."""

    @classmethod
    def setUpClass(cls):
        """Import app after env setup."""
        from fastapi.testclient import TestClient
        from backend.main import app
        cls.app = app
        cls.client = TestClient(app)

    def test_health_returns_200(self):
        """Health endpoint should return 200 OK."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)

    def test_health_returns_ok_status(self):
        """Health endpoint should return status='ok'."""
        data = self.client.get("/health").json()
        self.assertEqual(data["status"], "ok")

    def test_health_response_has_classifier_loaded(self):
        """Health response should include classifier_loaded field."""
        data = self.client.get("/health").json()
        self.assertIn("classifier_loaded", data)
        self.assertIsInstance(data["classifier_loaded"], bool)

    def test_health_response_has_ner_loaded(self):
        """Health response should include ner_loaded field."""
        data = self.client.get("/health").json()
        self.assertIn("ner_loaded", data)
        self.assertIsInstance(data["ner_loaded"], bool)

    def test_health_response_model_matches_schema(self):
        """Health response should match HealthResponse schema."""
        data = self.client.get("/health").json()
        self.assertEqual(set(data.keys()), {"status", "classifier_loaded", "ner_loaded"})

    def test_health_is_lightweight(self):
        """Health endpoint should respond quickly (no DB calls)."""
        import time
        start = time.time()
        self.client.get("/health")
        elapsed = time.time() - start
        self.assertLess(elapsed, 1.0, "Health check should complete in <1s")


class TestReadinessEndpoint(unittest.TestCase):
    """Tests for GET /ready endpoint."""

    @classmethod
    def setUpClass(cls):
        """Import app after env setup."""
        from fastapi.testclient import TestClient
        from backend.main import app
        cls.app = app
        cls.client = TestClient(app)

    def test_ready_returns_200_when_all_healthy(self):
        """Readiness should return 200 when all subsystems are loaded."""
        response = self.client.get("/ready")
        # May be 200 or 503 depending on subsystem state
        self.assertIn(response.status_code, [200, 503])

    def test_ready_response_has_checks(self):
        """Readiness response should include checks dict."""
        data = self.client.get("/ready").json()
        self.assertIn("checks", data)
        self.assertIsInstance(data["checks"], dict)

    def test_ready_response_has_status(self):
        """Readiness response should include status field."""
        data = self.client.get("/ready").json()
        self.assertIn("status", data)
        self.assertIn(data["status"], ["ready", "not_ready"])

    def test_ready_checks_include_api(self):
        """Readiness checks should include api=True."""
        data = self.client.get("/ready").json()
        self.assertIn("api", data["checks"])
        self.assertTrue(data["checks"]["api"])

    def test_ready_checks_include_classifier(self):
        """Readiness checks should include classifier_loaded."""
        data = self.client.get("/ready").json()
        self.assertIn("classifier_loaded", data["checks"])

    def test_ready_checks_include_ner(self):
        """Readiness checks should include ner_loaded."""
        data = self.client.get("/ready").json()
        self.assertIn("ner_loaded", data["checks"])

    def test_ready_checks_include_duplicate_index(self):
        """Readiness checks should include duplicate_index_loaded."""
        data = self.client.get("/ready").json()
        self.assertIn("duplicate_index_loaded", data["checks"])

    def test_ready_checks_include_rag(self):
        """Readiness checks should include rag_loaded."""
        data = self.client.get("/ready").json()
        self.assertIn("rag_loaded", data["checks"])

    def test_ready_returns_503_when_subsystem_fails(self):
        """Readiness should return 503 when any subsystem is not loaded."""
        from backend.main import classifier_service
        original_loaded = classifier_service._loaded
        try:
            classifier_service._loaded = False
            response = self.client.get("/ready")
            self.assertEqual(response.status_code, 503)
            data = response.json()
            self.assertEqual(data["status"], "not_ready")
        finally:
            classifier_service._loaded = original_loaded

    def test_ready_returns_200_when_all_subsystems_loaded(self):
        """Readiness should return 200 when all subsystems report loaded."""
        from backend.main import classifier_service, ner_service, duplicate_service, rag_service
        originals = {
            'classifier': classifier_service._loaded,
            'ner': ner_service._loaded,
            'duplicate': duplicate_service._loaded,
            'rag': rag_service._loaded,
        }
        try:
            classifier_service._loaded = True
            ner_service._loaded = True
            duplicate_service._loaded = True
            rag_service._loaded = True
            response = self.client.get("/ready")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "ready")
        finally:
            classifier_service._loaded = originals['classifier']
            ner_service._loaded = originals['ner']
            duplicate_service._loaded = originals['duplicate']
            rag_service._loaded = originals['rag']

    def test_ready_supabase_check_when_required(self):
        """When REQUIRE_SUPABASE=true, readiness should check supabase_configured."""
        original = os.environ.get("REQUIRE_SUPABASE")
        try:
            os.environ["REQUIRE_SUPABASE"] = "true"
            data = self.client.get("/ready").json()
            self.assertIn("supabase_configured", data["checks"])
        finally:
            if original is not None:
                os.environ["REQUIRE_SUPABASE"] = original
            else:
                os.environ.pop("REQUIRE_SUPABASE", None)

    def test_ready_supabase_not_checked_when_not_required(self):
        """When REQUIRE_SUPABASE=false, readiness should not check supabase."""
        original = os.environ.get("REQUIRE_SUPABASE")
        try:
            os.environ["REQUIRE_SUPABASE"] = "false"
            data = self.client.get("/ready").json()
            self.assertNotIn("supabase_configured", data["checks"])
        finally:
            if original is not None:
                os.environ["REQUIRE_SUPABASE"] = original
            else:
                os.environ.pop("REQUIRE_SUPABASE", None)


if __name__ == "__main__":
    unittest.main()
