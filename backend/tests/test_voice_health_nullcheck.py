"""
Unit tests for voice health endpoint null-check fix (Issue #1115)

Tests that the /api/voice/health endpoint properly handles:
- Missing whisper model (None)
- Missing voice_service module
- Missing _whisper_model attribute
- Successful model loading
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from backend.main import app
    return TestClient(app)


class TestVoiceHealthEndpoint:
    """Test suite for /api/voice/health endpoint."""

    def test_health_when_model_loaded(self, client):
        """Test health endpoint when whisper model is successfully loaded."""
        with patch('backend.services.voice_service._whisper_model') as mock_model:
            mock_model.is_some_value = True  # Simulate loaded model
            
            response = client.get("/api/voice/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert data["model_loaded"] is True
            assert "max_audio_size_mb" in data
            assert "supported_formats" in data
            assert isinstance(data["supported_formats"], list)

    def test_health_when_model_is_none(self, client):
        """Test health endpoint when whisper model is None (not loaded)."""
        with patch('backend.services.voice_service._whisper_model', None):
            response = client.get("/api/voice/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "degraded"
            assert data["model_loaded"] is False
            assert "max_audio_size_mb" in data
            assert "supported_formats" in data

    def test_health_when_attribute_missing(self, client):
        """Test health endpoint when _whisper_model attribute doesn't exist."""
        with patch('backend.services.voice_service') as mock_service:
            # Remove the _whisper_model attribute
            del mock_service._whisper_model
            
            response = client.get("/api/voice/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "unavailable"
            assert data["model_loaded"] is False
            assert "message" in data
            assert "Voice service not properly initialized" in data["message"]

    def test_health_when_module_import_fails(self, client):
        """Test health endpoint when voice_service module can't be imported."""
        with patch.dict('sys.modules', {'backend.services.voice_service': None}):
            response = client.get("/api/voice/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "unavailable"
            assert data["model_loaded"] is False
            assert "message" in data

    def test_health_response_structure(self, client):
        """Test that health endpoint always returns consistent structure."""
        with patch('backend.services.voice_service._whisper_model', None):
            response = client.get("/api/voice/health")
            
            assert response.status_code == 200
            data = response.json()
            
            # Check required fields are always present
            assert "status" in data
            assert "model_loaded" in data
            assert "max_audio_size_mb" in data
            assert "supported_formats" in data
            
            # Check data types
            assert isinstance(data["status"], str)
            assert isinstance(data["model_loaded"], bool)
            assert isinstance(data["max_audio_size_mb"], int)
            assert isinstance(data["supported_formats"], list)
            
            # Check supported formats
            expected_formats = ["webm", "wav", "mp3", "ogg", "m4a", "flac"]
            for fmt in expected_formats:
                assert fmt in data["supported_formats"]

    def test_health_max_audio_size(self, client):
        """Test that max_audio_size_mb is calculated correctly."""
        with patch('backend.services.voice_service._whisper_model', None):
            response = client.get("/api/voice/health")
            
            data = response.json()
            # MAX_UPLOAD_SIZE is 25MB, so max_audio_size_mb should be 25
            assert data["max_audio_size_mb"] == 25

    def test_health_with_exception(self, client):
        """Test health endpoint when an unexpected exception occurs."""
        with patch('backend.services.voice_service') as mock_service:
            # Make accessing _whisper_model raise an exception
            type(mock_service)._whisper_model = property(
                lambda self: (_ for _ in ()).throw(Exception("Test error"))
            )
            
            response = client.get("/api/voice/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "error"
            assert data["model_loaded"] is False
            assert "message" in data
            assert "Health check failed" in data["message"]


class TestVoiceHealthEndpointIntegration:
    """Integration tests for voice health endpoint."""

    def test_health_endpoint_accessible(self, client):
        """Test that health endpoint is accessible without authentication."""
        with patch('backend.services.voice_service._whisper_model', None):
            response = client.get("/api/voice/health")
            
            # Should not require authentication
            assert response.status_code == 200

    def test_health_endpoint_no_side_effects(self, client):
        """Test that health endpoint doesn't have side effects."""
        with patch('backend.services.voice_service._whisper_model', None):
            # Call health endpoint multiple times
            for _ in range(3):
                response = client.get("/api/voice/health")
                assert response.status_code == 200
                data = response.json()
                assert data["model_loaded"] is False
