"""
Unit tests for AutoCloseService.

Tests:
- test_get_system_settings_returns_defaults_on_error
- test_get_system_settings_returns_db_values
- test_close_ticket_success
- test_close_ticket_failure
"""

import os
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from datetime import datetime, timezone

# Set environment variables before importing
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-key"
os.environ["AUTO_CLOSE_ENABLED"] = "true"
os.environ["AUTO_CLOSE_DAYS"] = "7"

from backend.services.auto_close_service import AutoCloseService


class TestAutoCloseService:
    """Test cases for AutoCloseService methods."""

    def setup_method(self):
        """Reset service before each test."""
        with patch("backend.services.auto_close_service.create_client") as mock_client:
            self.mock_supabase = MagicMock()
            mock_client.return_value = self.mock_supabase
            self.service = AutoCloseService()

    def test_get_system_settings_returns_defaults_on_error(self):
        """When database query fails, should return default settings."""
        # Mock the database query to raise an exception
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("DB Error")
        self.mock_supabase.table.return_value = mock_table

        result = self.service.get_system_settings("company-123")

        assert result["auto_close_days"] == 7  # default
        assert result["auto_close_enabled"] is True  # default

    def test_get_system_settings_returns_db_values(self):
        """When database query succeeds, should return database values."""
        # Mock successful database response
        mock_response = MagicMock()
        mock_response.data = {
            "auto_close_days": 14,
            "auto_close_enabled": False
        }
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        self.mock_supabase.table.return_value = mock_table

        result = self.service.get_system_settings("company-123")

        assert result["auto_close_days"] == 14
        assert result["auto_close_enabled"] is False

    def test_close_ticket_success(self):
        """Should successfully close a ticket and update stats."""
        # Mock successful update
        mock_table = MagicMock()
        mock_table.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()
        self.mock_supabase.table.return_value = mock_table

        stats = {"closed_count": 0, "error_count": 0}
        result = self.service._close_ticket("ticket-123", "company-123", stats)

        assert result is True
        assert stats["closed_count"] == 1
        assert stats["error_count"] == 0

    def test_close_ticket_failure(self):
        """Should handle ticket close failure and update error stats."""
        # Mock failed update
        mock_table = MagicMock()
        mock_table.update.return_value.eq.return_value.eq.return_value.execute.side_effect = Exception("DB Error")
        self.mock_supabase.table.return_value = mock_table

        stats = {"closed_count": 0, "error_count": 0}
        result = self.service._close_ticket("ticket-123", "company-123", stats)

        assert result is False
        assert stats["closed_count"] == 0
        assert stats["error_count"] == 1

    def test_service_initialization(self):
        """Should initialize with correct default values."""
        assert self.service.enabled is True
        assert self.service.default_auto_close_days == 7
        assert self.service.cron_schedule == "0 2 * * *"
