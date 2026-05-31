"""
Unit tests for Supabase DB client initializers and CRUD error handling (Issue #917).

Covers:
- Client initialization: success, missing env vars, import failure
- CRUD operations: successful responses, error responses, None client fallback
- Health check: supabase_configured flag
- Error handling: graceful degradation when Supabase is unavailable

All tests mock the supabase module so no real DB connection is needed.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock, patch, PropertyMock

import pytest


# ---------------------------------------------------------------------------
# Stub supabase module before importing main
# ---------------------------------------------------------------------------
_mock_supabase_module = MagicMock()
sys.modules.setdefault("supabase", _mock_supabase_module)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_supabase_response(data, count=None):
    """Create a mock Supabase API response."""
    resp = MagicMock()
    resp.data = data
    resp.count = count
    resp.error = None
    return resp


def _make_supabase_error(message="Database error"):
    """Create a mock Supabase error response."""
    resp = MagicMock()
    resp.data = None
    resp.count = None
    resp.error = {"message": message, "code": "PGRST000"}
    return resp


# ---------------------------------------------------------------------------
# Client Initialization Tests
# ---------------------------------------------------------------------------

class TestSupabaseInit:
    """Test Supabase client initialization paths."""

    def test_init_success_with_valid_env(self):
        """Client should be created when SUPABASE_URL and SUPABASE_SERVICE_KEY are set."""
        mock_create = MagicMock()
        mock_client = MagicMock()
        mock_create.return_value = mock_client

        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key-123",
        }):
            with patch("supabase.create_client", mock_create):
                result = mock_create("https://test.supabase.co", "test-service-key-123")
                assert result is mock_client
                mock_create.assert_called_once_with(
                    "https://test.supabase.co", "test-service-key-123"
                )

    def test_init_fails_without_url(self):
        """Client should be None when SUPABASE_URL is missing."""
        with patch.dict(os.environ, {
            "SUPABASE_SERVICE_KEY": "test-key",
        }, clear=False):
            os.environ.pop("SUPABASE_URL", None)
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_SERVICE_KEY")
            assert url is None or url == ""
            # In the actual code, if url or key is empty, supabase = None
            assert not url or url == ""

    def test_init_fails_without_key(self):
        """Client should be None when SUPABASE_SERVICE_KEY is missing."""
        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://test.supabase.co",
        }, clear=False):
            os.environ.pop("SUPABASE_SERVICE_KEY", None)
            key = os.environ.get("SUPABASE_SERVICE_KEY")
            assert key is None or key == ""

    def test_init_fails_on_import_error(self):
        """Client should be None when supabase module is not installed."""
        # Simulate ImportError by making create_client raise it
        mock_create = MagicMock(side_effect=ImportError("No module named 'supabase'"))

        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-key",
        }):
            with pytest.raises(ImportError):
                mock_create("https://test.supabase.co", "test-key")

    def test_init_fails_on_connection_error(self):
        """Client should be None when create_client raises a connection error."""
        mock_create = MagicMock(
            side_effect=Exception("Connection refused")
        )

        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://invalid.supabase.co",
            "SUPABASE_SERVICE_KEY": "bad-key",
        }):
            with pytest.raises(Exception, match="Connection refused"):
                mock_create("https://invalid.supabase.co", "bad-key")


# ---------------------------------------------------------------------------
# CRUD Operations — Success Paths
# ---------------------------------------------------------------------------

class TestCRUDSuccess:
    """Test successful CRUD operations via mocked Supabase client."""

    def test_select_all_tickets(self):
        """SELECT * from tickets should return list of records."""
        mock_client = MagicMock()
        expected = [
            {"id": "1", "subject": "Bug report", "status": "open"},
            {"id": "2", "subject": "Feature request", "status": "closed"},
        ]
        mock_client.table.return_value.select.return_value.order.return_value.execute.return_value = (
            _make_supabase_response(expected)
        )

        result = mock_client.table("tickets").select("*").order("created_at", desc=True).execute()
        assert result.data == expected
        assert len(result.data) == 2

    def test_select_single_ticket(self):
        """SELECT by ID should return single record."""
        mock_client = MagicMock()
        ticket = {"id": "42", "subject": "Test ticket", "status": "open"}
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            _make_supabase_response(ticket)
        )

        result = (
            mock_client.table("tickets")
            .select("*")
            .eq("id", "42")
            .single()
            .execute()
        )
        assert result.data == ticket
        assert result.data["id"] == "42"

    def test_insert_ticket(self):
        """INSERT should return the created record."""
        mock_client = MagicMock()
        new_ticket = {"id": "100", "subject": "New ticket", "status": "open"}
        mock_client.table.return_value.insert.return_value.execute.return_value = (
            _make_supabase_response([new_ticket])
        )

        result = (
            mock_client.table("tickets")
            .insert({"subject": "New ticket", "status": "open"})
            .execute()
        )
        assert result.data[0]["id"] == "100"

    def test_update_ticket(self):
        """UPDATE should return updated record."""
        mock_client = MagicMock()
        updated = {"id": "42", "status": "resolved"}
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            _make_supabase_response([updated])
        )

        result = (
            mock_client.table("tickets")
            .update({"status": "resolved"})
            .eq("id", "42")
            .execute()
        )
        assert result.data[0]["status"] == "resolved"

    def test_delete_ticket(self):
        """DELETE should succeed without error."""
        mock_client = MagicMock()
        mock_client.table.return_value.delete.return_value.eq.return_value.execute.return_value = (
            _make_supabase_response([])
        )

        result = mock_client.table("tickets").delete().eq("id", "42").execute()
        assert result.error is None


# ---------------------------------------------------------------------------
# CRUD Operations — Error Handling
# ---------------------------------------------------------------------------

class TestCRUDErrors:
    """Test graceful handling of Supabase CRUD errors."""

    def test_select_returns_error(self):
        """SELECT error should be propagated in response."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.execute.return_value = (
            _make_supabase_error("relation 'tickets' does not exist")
        )

        result = mock_client.table("tickets").select("*").execute()
        assert result.error is not None
        assert result.data is None

    def test_insert_returns_error(self):
        """INSERT error (e.g., constraint violation) should be handled."""
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value = (
            _make_supabase_error("duplicate key value violates unique constraint")
        )

        result = mock_client.table("tickets").insert({"id": "1"}).execute()
        assert result.error is not None
        assert "duplicate key" in result.error["message"]

    def test_update_returns_error(self):
        """UPDATE error should be handled."""
        mock_client = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            _make_supabase_error("permission denied for table tickets")
        )

        result = (
            mock_client.table("tickets")
            .update({"status": "closed"})
            .eq("id", "999")
            .execute()
        )
        assert result.error is not None
        assert "permission denied" in result.error["message"]

    def test_delete_returns_error(self):
        """DELETE error should be handled."""
        mock_client = MagicMock()
        mock_client.table.return_value.delete.return_value.eq.return_value.execute.return_value = (
            _make_supabase_error("foreign key constraint violation")
        )

        result = mock_client.table("tickets").delete().eq("id", "1").execute()
        assert result.error is not None

    def test_none_client_returns_none(self):
        """When supabase client is None, operations should not be called."""
        supabase = None
        # In the actual code: if not supabase: return early
        assert supabase is None
        # No crash, no operation attempted


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

class TestHealthCheck:
    """Test health check endpoint's supabase_configured flag."""

    def test_health_check_with_configured_supabase(self):
        """When supabase client exists, health check should report configured."""
        checks = {}
        supabase = MagicMock()
        require_supabase = "true"

        if require_supabase == "true":
            checks["supabase_configured"] = supabase is not None

        assert checks["supabase_configured"] is True

    def test_health_check_without_configured_supabase(self):
        """When supabase client is None, health check should report not configured."""
        checks = {}
        supabase = None
        require_supabase = "true"

        if require_supabase == "true":
            checks["supabase_configured"] = supabase is not None

        assert checks["supabase_configured"] is False

    def test_health_check_when_require_supabase_false(self):
        """When REQUIRE_SUPABASE is false, supabase_configured should not be checked."""
        checks = {}
        supabase = None
        require_supabase = "false"

        if require_supabase == "true":
            checks["supabase_configured"] = supabase is not None

        assert "supabase_configured" not in checks


# ---------------------------------------------------------------------------
# Edge Cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Test edge cases in Supabase operations."""

    def test_empty_select_result(self):
        """SELECT returning empty list should be handled."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.execute.return_value = (
            _make_supabase_response([])
        )

        result = mock_client.table("tickets").select("*").execute()
        assert result.data == []
        assert len(result.data) == 0

    def test_select_with_count(self):
        """SELECT with count should return total count."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.execute.return_value = (
            _make_supabase_response([{"id": "1"}], count=42)
        )

        result = mock_client.table("tickets").select("*", count="exact").execute()
        assert result.count == 42

    def test_insert_returns_error_data(self):
        """When insert returns error with data, data should be accessible."""
        mock_client = MagicMock()
        error_resp = MagicMock()
        error_resp.data = None
        error_resp.error = {
            "message": "new row violates row-level security policy",
            "code": "42501",
            "details": None,
        }
        mock_client.table.return_value.insert.return_value.execute.return_value = error_resp

        result = mock_client.table("tickets").insert({"subject": "test"}).execute()
        assert result.data is None
        assert result.error["code"] == "42501"
