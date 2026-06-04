"""
Unit tests for backend/services/supabase_utils.py

Tests all Supabase utility wrapper functions:
- get_ticket, create_ticket, update_ticket
- get_profile
- get_system_settings
- list_tickets

All tests use mocked Supabase clients to verify:
- Successful CRUD operations
- Error handling (exception suppression)
- Default value fallbacks
- Empty/None input edge cases
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from backend.services import supabase_utils


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_supabase():
    """Create a mocked Supabase client with chained table/insert/update/select/eq/single/execute methods."""
    client = MagicMock()
    return client


@pytest.fixture
def sample_ticket():
    return {
        "id": "ticket-001",
        "company_id": "company-abc",
        "title": "Test ticket",
        "status": "open",
        "created_at": "2026-01-01T00:00:00Z",
    }


@pytest.fixture
def sample_profile():
    return {
        "id": "user-001",
        "email": "test@example.com",
        "role": "admin",
    }


@pytest.fixture
def sample_settings():
    return {
        "company_id": "company-abc",
        "ai_confidence_threshold": 0.90,
        "duplicate_sensitivity": 0.95,
        "enable_auto_resolve": True,
        "auto_close_days": 14,
        "auto_close_enabled": True,
    }


# ---------------------------------------------------------------------------
# get_ticket
# ---------------------------------------------------------------------------

class TestGetTicket:
    def test_get_ticket_success(self, mock_supabase, sample_ticket):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = sample_ticket

        result = supabase_utils.get_ticket(mock_supabase, "ticket-001")

        assert result == sample_ticket
        mock_supabase.table.assert_called_once_with("tickets")

    def test_get_ticket_not_found(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None

        result = supabase_utils.get_ticket(mock_supabase, "nonexistent")

        assert result is None

    def test_get_ticket_error_suppressed(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("Connection error")

        result = supabase_utils.get_ticket(mock_supabase, "ticket-001")

        assert result is None


# ---------------------------------------------------------------------------
# create_ticket
# ---------------------------------------------------------------------------

class TestCreateTicket:
    def test_create_ticket_success(self, mock_supabase, sample_ticket):
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [sample_ticket]

        result = supabase_utils.create_ticket(mock_supabase, sample_ticket)

        assert result == sample_ticket
        mock_supabase.table.assert_called_once_with("tickets")

    def test_create_ticket_no_data(self, mock_supabase):
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = None

        result = supabase_utils.create_ticket(mock_supabase, {"title": "test"})

        assert result == {}

    def test_create_ticket_empty_data_list(self, mock_supabase):
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = []

        result = supabase_utils.create_ticket(mock_supabase, {"title": "test"})

        assert result == {}

    def test_create_ticket_error_suppressed(self, mock_supabase):
        mock_supabase.table.return_value.insert.return_value.execute.side_effect = Exception("Insert failed")

        result = supabase_utils.create_ticket(mock_supabase, {"title": "test"})

        assert result == {}


# ---------------------------------------------------------------------------
# update_ticket
# ---------------------------------------------------------------------------

class TestUpdateTicket:
    def test_update_ticket_success(self, mock_supabase, sample_ticket):
        updated = {**sample_ticket, "status": "closed"}
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [updated]

        result = supabase_utils.update_ticket(mock_supabase, "ticket-001", {"status": "closed"})

        assert result == updated
        mock_supabase.table.assert_called_once_with("tickets")

    def test_update_ticket_no_data(self, mock_supabase):
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = None

        result = supabase_utils.update_ticket(mock_supabase, "ticket-001", {"status": "closed"})

        assert result == {}

    def test_update_ticket_error_suppressed(self, mock_supabase):
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.side_effect = Exception("Update failed")

        result = supabase_utils.update_ticket(mock_supabase, "ticket-001", {"status": "closed"})

        assert result == {}


# ---------------------------------------------------------------------------
# get_profile
# ---------------------------------------------------------------------------

class TestGetProfile:
    def test_get_profile_success(self, mock_supabase, sample_profile):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = sample_profile

        result = supabase_utils.get_profile(mock_supabase, "user-001")

        assert result == sample_profile
        mock_supabase.table.assert_called_once_with("profiles")

    def test_get_profile_not_found(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None

        result = supabase_utils.get_profile(mock_supabase, "nonexistent")

        assert result is None

    def test_get_profile_error_suppressed(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("Profile query failed")

        result = supabase_utils.get_profile(mock_supabase, "user-001")

        assert result is None


# ---------------------------------------------------------------------------
# get_system_settings
# ---------------------------------------------------------------------------

class TestGetSystemSettings:
    def test_get_system_settings_success(self, mock_supabase, sample_settings):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = sample_settings

        result = supabase_utils.get_system_settings(mock_supabase, "company-abc")

        # Merged with defaults, so company_id and custom values should be present
        assert result["company_id"] == "company-abc"
        assert result["ai_confidence_threshold"] == 0.90
        # Defaults should also be present
        assert "duplicate_sensitivity" in result

    def test_get_system_settings_missing_row(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None

        result = supabase_utils.get_system_settings(mock_supabase, "company-abc")

        # Should return defaults
        assert result["enable_auto_resolve"] is False
        assert result["auto_close_days"] == 7
        assert result["ai_confidence_threshold"] == 0.80

    def test_get_system_settings_error_fallback(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("Settings query failed")

        result = supabase_utils.get_system_settings(mock_supabase, "company-abc")

        # Should return defaults on error
        assert result["auto_close_days"] == 7
        assert result["enable_auto_resolve"] is False

    def test_get_system_settings_no_client(self):
        result = supabase_utils.get_system_settings(None, "company-abc")

        assert result["auto_close_days"] == 7
        assert result["enable_auto_resolve"] is False

    def test_get_system_settings_no_company_id(self, mock_supabase):
        result = supabase_utils.get_system_settings(mock_supabase, None)

        assert result["auto_close_days"] == 7
        assert result["enable_auto_resolve"] is False

    def test_get_system_settings_partial_override(self, mock_supabase):
        """Only one custom setting, others should fall back to defaults."""
        partial = {"company_id": "company-xyz", "auto_close_days": 30}
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = partial

        result = supabase_utils.get_system_settings(mock_supabase, "company-xyz")

        assert result["auto_close_days"] == 30
        assert result["ai_confidence_threshold"] == 0.80  # default
        assert result["enable_auto_resolve"] is False  # default


# ---------------------------------------------------------------------------
# list_tickets
# ---------------------------------------------------------------------------

class TestListTickets:
    def test_list_tickets_success(self, mock_supabase, sample_ticket):
        tickets = [sample_ticket, {**sample_ticket, "id": "ticket-002"}]
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = tickets

        result = supabase_utils.list_tickets(mock_supabase, "company-abc", limit=50)

        assert len(result) == 2
        assert result[0]["id"] == "ticket-001"
        mock_supabase.table.assert_called_once_with("tickets")

    def test_list_tickets_empty(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = []

        result = supabase_utils.list_tickets(mock_supabase, "company-empty")

        assert result == []

    def test_list_tickets_no_data(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = None

        result = supabase_utils.list_tickets(mock_supabase, "company-none")

        assert result == []

    def test_list_tickets_error_suppressed(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.side_effect = Exception("List query failed")

        result = supabase_utils.list_tickets(mock_supabase, "company-error")

        assert result == []

    def test_list_tickets_default_pagination(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = []

        supabase_utils.list_tickets(mock_supabase, "company-abc")

        # Verify default limit=50, offset=0 means range(0, 49)
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.assert_called_once_with(0, 49)

    def test_list_tickets_custom_pagination(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = []

        supabase_utils.list_tickets(mock_supabase, "company-abc", limit=10, offset=20)

        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.assert_called_once_with(20, 29)
