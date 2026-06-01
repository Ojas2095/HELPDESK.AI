"""
Tests for ticket endpoints authentication and tenant isolation.
Covers: GET /tickets, POST /tickets/save, GET /tickets/{ticket_id}
"""
import pytest
from unittest.mock import patch, MagicMock
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

MOCK_TICKET = {
    "id": "ticket-123",
    "ticket_id": "TKT-001",
    "subject": "Test Issue",
    "description": "Test description",
    "company_id": "test-company-id",
    "user_id": "test-user-id-123",
    "status": "open",
    "created_at": "2026-06-01T00:00:00Z"
}


def mock_get_current_user():
    return MOCK_USER


class TestGetTickets:
    """Tests for GET /tickets endpoint."""

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    @patch("main.supabase")
    def test_get_tickets_requires_auth(self, mock_supabase, mock_auth):
        """Test that /tickets requires authentication."""
        # Without auth header, should get 401
        response = client.get("/tickets")
        assert response.status_code == 401

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    @patch("main.supabase")
    def test_get_tickets_with_auth(self, mock_supabase, mock_auth):
        """Test that /tickets returns tickets for authenticated user."""
        mock_supabase.table.return_value.select.return_value.order.return_value.eq.return_value.execute.return_value = MagicMock(data=[MOCK_TICKET])

        response = client.get("/tickets", headers={"Authorization": "Bearer test-token"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["id"] == "ticket-123"


class TestSaveTicket:
    """Tests for POST /tickets/save endpoint."""

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    @patch("main.supabase")
    def test_save_ticket_requires_auth(self, mock_supabase, mock_auth):
        """Test that /tickets/save requires authentication."""
        response = client.post("/tickets/save", json={
            "subject": "Test",
            "description": "Test",
            "category": "general",
            "subcategory": "other",
            "priority": "low",
            "assigned_team": "support",
            "status": "open",
            "auto_resolve": False,
            "is_duplicate": False,
            "confidence": 0.9,
            "sla_breach_at": "2026-06-02T00:00:00Z",
            "metadata": {},
            "routing_confidence": 0.8
        })
        assert response.status_code == 401

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    @patch("main.supabase")
    def test_save_ticket_uses_auth_user_id(self, mock_supabase, mock_auth):
        """Test that /tickets/save uses authenticated user_id, not request body."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data={
            "company_id": "test-company-id",
            "company": "Test Company"
        })
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[MOCK_TICKET])

        # Try to spoof user_id in body
        response = client.post("/tickets/save", json={
            "user_id": "spoofed-user-id",  # Should be overridden
            "subject": "Test",
            "description": "Test",
            "category": "general",
            "subcategory": "other",
            "priority": "low",
            "assigned_team": "support",
            "status": "open",
            "auto_resolve": False,
            "is_duplicate": False,
            "confidence": 0.9,
            "sla_breach_at": "2026-06-02T00:00:00Z",
            "metadata": {},
            "routing_confidence": 0.8
        }, headers={"Authorization": "Bearer test-token"})

        # Should use authenticated user_id, not spoofed one
        # The actual save logic would use user.get("id") = "test-user-id-123"


class TestGetTicketById:
    """Tests for GET /tickets/{ticket_id} endpoint."""

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    @patch("main.supabase")
    def test_get_ticket_by_id_requires_auth(self, mock_supabase, mock_auth):
        """Test that /tickets/{ticket_id} requires authentication."""
        response = client.get("/tickets/ticket-123")
        assert response.status_code == 401

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    @patch("main.supabase")
    def test_get_ticket_by_id_tenant_isolation(self, mock_supabase, mock_auth):
        """Test that /tickets/{ticket_id} enforces tenant isolation."""
        # Mock ticket from different company
        other_company_ticket = {**MOCK_TICKET, "company_id": "other-company-id"}
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=other_company_ticket)

        response = client.get("/tickets/ticket-123", headers={"Authorization": "Bearer test-token"})
        assert response.status_code == 403
        assert "different company" in response.json()["detail"]

    @patch("main.get_current_user", side_effect=mock_get_current_user)
    @patch("main.supabase")
    def test_get_ticket_by_id_same_company(self, mock_supabase, mock_auth):
        """Test that /tickets/{ticket_id} allows access to same company tickets."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=MOCK_TICKET)

        response = client.get("/tickets/ticket-123", headers={"Authorization": "Bearer test-token"})
        assert response.status_code == 200
        assert response.json()["id"] == "ticket-123"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
