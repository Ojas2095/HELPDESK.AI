"""Unit tests for the health check endpoints."""

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class TestHealthEndpoint:
    """Tests for GET /health endpoint."""

    def test_health_returns_200(self):
        """Health endpoint should return HTTP 200 with status ok."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner:
            mock_cls._loaded = True
            mock_ner._loaded = True
            response = client.get("/health")
            assert response.status_code == 200

    def test_health_response_status_ok(self):
        """Health response should include status 'ok'."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner:
            mock_cls._loaded = True
            mock_ner._loaded = True
            response = client.get("/health")
            data = response.json()
            assert data["status"] == "ok"

    def test_health_reports_classifier_loaded(self):
        """Health endpoint should report classifier_loaded correctly."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner:
            mock_cls._loaded = True
            mock_ner._loaded = False
            response = client.get("/health")
            data = response.json()
            assert data["classifier_loaded"] is True
            assert data["ner_loaded"] is False

    def test_health_reports_ner_loaded(self):
        """Health endpoint should report ner_loaded correctly."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner:
            mock_cls._loaded = False
            mock_ner._loaded = True
            response = client.get("/health")
            data = response.json()
            assert data["classifier_loaded"] is False
            assert data["ner_loaded"] is True

    def test_health_all_services_unloaded(self):
        """Health should still return 200 when no services are loaded."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner:
            mock_cls._loaded = False
            mock_ner._loaded = False
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert data["classifier_loaded"] is False
            assert data["ner_loaded"] is False

    def test_health_response_schema(self):
        """Health response should match the HealthResponse schema."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner:
            mock_cls._loaded = True
            mock_ner._loaded = True
            response = client.get("/health")
            data = response.json()
            assert "status" in data
            assert "classifier_loaded" in data
            assert "ner_loaded" in data
            assert isinstance(data["status"], str)
            assert isinstance(data["classifier_loaded"], bool)
            assert isinstance(data["ner_loaded"], bool)


class TestReadinessEndpoint:
    """Tests for GET /ready endpoint."""

    def test_ready_returns_200_when_all_services_loaded(self):
        """Ready should return 200 when all services are loaded in strict mode."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner, \
             patch("backend.main.duplicate_service") as mock_dup, \
             patch("backend.main.rag_service") as mock_rag:
            mock_cls._loaded = True
            mock_ner._loaded = True
            mock_dup.is_available.return_value = True
            mock_rag.is_available.return_value = True
            response = client.get("/ready")
            assert response.status_code == 200

    def test_ready_response_status_ready(self):
        """Ready response should include status 'ready' when all checks pass."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner, \
             patch("backend.main.duplicate_service") as mock_dup, \
             patch("backend.main.rag_service") as mock_rag:
            mock_cls._loaded = True
            mock_ner._loaded = True
            mock_dup.is_available.return_value = True
            mock_rag.is_available.return_value = True
            response = client.get("/ready")
            data = response.json()
            assert data["status"] == "ready"

    def test_ready_includes_all_checks(self):
        """Ready response should include all service check keys."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner, \
             patch("backend.main.duplicate_service") as mock_dup, \
             patch("backend.main.rag_service") as mock_rag:
            mock_cls._loaded = True
            mock_ner._loaded = True
            mock_dup.is_available.return_value = True
            mock_rag.is_available.return_value = True
            response = client.get("/ready")
            data = response.json()
            assert "api" in data["checks"]
            assert "classifier_loaded" in data["checks"]
            assert "ner_loaded" in data["checks"]
            assert "duplicate_index_loaded" in data["checks"]
            assert "rag_loaded" in data["checks"]

    def test_ready_returns_503_when_classifier_not_loaded_strict(self):
        """Ready should return 503 when classifier is not loaded in strict mode."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner, \
             patch("backend.main.duplicate_service") as mock_dup, \
             patch("backend.main.rag_service") as mock_rag:
            mock_cls._loaded = False
            mock_ner._loaded = True
            mock_dup.is_available.return_value = True
            mock_rag.is_available.return_value = True
            response = client.get("/ready")
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "not_ready"

    def test_ready_returns_503_when_ner_not_loaded_strict(self):
        """Ready should return 503 when NER is not loaded in strict mode."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner, \
             patch("backend.main.duplicate_service") as mock_dup, \
             patch("backend.main.rag_service") as mock_rag:
            mock_cls._loaded = True
            mock_ner._loaded = False
            mock_dup.is_available.return_value = True
            mock_rag.is_available.return_value = True
            response = client.get("/ready")
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "not_ready"

    @patch.dict(os.environ, {"ALLOW_DEGRADED_STARTUP": "1"})
    def test_ready_degraded_mode_allows_partial_services(self):
        """Ready in degraded mode should return 200 even if optional services are down."""
        with patch("backend.main.classifier_service") as mock_cls, \
             patch("backend.main.ner_service") as mock_ner, \
             patch("backend.main.duplicate_service") as mock_dup, \
             patch("backend.main.rag_service") as mock_rag:
            mock_cls._loaded = True
            mock_ner._loaded = True
            mock_dup.is_available.return_value = False
            mock_rag.is_available.return_value = False
            response = client.get("/ready")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ready"


class TestHealthcheckScript:
    """Tests for the standalone healthcheck.py script."""

    def test_healthcheck_script_returns_0_on_success(self, monkeypatch):
        """Standalone healthcheck should return 0 when URL is healthy."""
        from backend import healthcheck
        import urllib.request

        def mock_urlopen(url, timeout):
            class MockResponse:
                status = 200
            return MockResponse()

        monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)
        result = healthcheck.main()
        assert result == 0

    def test_healthcheck_script_returns_1_on_timeout(self, monkeypatch):
        """Standalone healthcheck should return 1 on timeout."""
        from backend import healthcheck
        import urllib.request

        def mock_urlopen(url, timeout):
            raise TimeoutError("Connection timed out")

        monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)
        result = healthcheck.main()
        assert result == 1

    def test_healthcheck_script_returns_1_on_error(self, monkeypatch):
        """Standalone healthcheck should return 1 on URLError."""
        from backend import healthcheck
        import urllib.request
        import urllib.error

        def mock_urlopen(url, timeout):
            raise urllib.error.URLError("Connection refused")

        monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)
        result = healthcheck.main()
        assert result == 1

    def test_healthcheck_script_returns_1_on_500(self, monkeypatch):
        """Standalone healthcheck should return 1 on HTTP 500."""
        from backend import healthcheck
        import urllib.request

        def mock_urlopen(url, timeout):
            class MockResponse:
                status = 500
            return MockResponse()

        monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)
        result = healthcheck.main()
        assert result == 1

    def test_healthcheck_script_invalid_scheme(self, monkeypatch):
        """Standalone healthcheck should return 1 for non-http schemes."""
        from backend import healthcheck

        monkeypatch.setenv("HEALTHCHECK_URL", "ftp://127.0.0.1/ready")
        result = healthcheck.main()
        assert result == 1

    def test_healthcheck_script_custom_url(self, monkeypatch):
        """Standalone healthcheck should use HEALTHCHECK_URL env var."""
        from backend import healthcheck
        import urllib.request

        monkeypatch.setenv("HEALTHCHECK_URL", "https://example.com/ready")
        
        def mock_urlopen(url, timeout):
            class MockResponse:
                status = 200
            return MockResponse()

        monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)
        result = healthcheck.main()
        assert result == 0

    def test_healthcheck_script_custom_timeout(self, monkeypatch):
        """Standalone healthcheck should respect HEALTHCHECK_TIMEOUT_SECONDS."""
        from backend import healthcheck
        import urllib.request

        monkeypatch.setenv("HEALTHCHECK_TIMEOUT_SECONDS", "5")
        
        captured_timeout = []

        def mock_urlopen(url, timeout):
            captured_timeout.append(timeout)
            class MockResponse:
                status = 200
            return MockResponse()

        monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)
        healthcheck.main()
        assert captured_timeout[0] == 5.0
