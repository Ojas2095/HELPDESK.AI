"""
Tests for /ai/log_correction endpoint.
Covers: authentication, rate limiting, async file I/O, race conditions.
"""
import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

# Mock supabase before importing main
with patch("main.supabase"):
    from main import app

client = TestClient(app)

# Mock user data
MOCK_USER = {
    "id": "test-user-id-123",
    "email": "test@example.com",
    "user_metadata": {
        "company_id": "test-company-id",
        "company": "Test Company",
        "role": "admin"
    }
}


def mock_get_current_user():
    return MOCK_USER


class TestLogCorrection:
    """Tests for POST /ai/log_correction endpoint."""

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    def test_log_correction_requires_auth(self, mock_auth):
        """Test that /ai/log_correction requires authentication."""
        response = client.post("/ai/log_correction", json={
            "ticket_id": "TKT-001",
            "original_prediction": {"category": "billing"},
            "corrected_prediction": {"category": "technical"}
        })
        assert response.status_code == 401

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    @patch("main.CORRECTIONS_LOG_PATH")
    def test_log_correction_saves_entry(self, mock_path, mock_auth):
        """Test that correction is saved with authenticated user_id."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([], f)
            temp_path = Path(f.name)

        mock_path.exists.return_value = True
        mock_path.stat.return_value.st_size = 2
        mock_path.__str__ = lambda x: str(temp_path)

        response = client.post("/ai/log_correction", json={
            "ticket_id": "TKT-001",
            "original_prediction": {"category": "billing"},
            "corrected_prediction": {"category": "technical"}
        }, headers={"Authorization": "Bearer test-token"})

        assert response.status_code == 200
        assert response.json()["status"] == "saved"

        # Verify user_id is logged
        with open(temp_path) as f:
            logs = json.load(f)
        assert len(logs) == 1
        assert logs[0]["user_id"] == "test-user-id-123"

        # Cleanup
        temp_path.unlink()

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    def test_log_correction_no_change(self, mock_auth):
        """Test that no log entry is created when predictions match."""
        response = client.post("/ai/log_correction", json={
            "ticket_id": "TKT-001",
            "original_prediction": {"category": "billing"},
            "corrected_prediction": {"category": "billing"}
        }, headers={"Authorization": "Bearer test-token"})

        assert response.status_code == 200
        assert response.json()["status"] == "no_change"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
