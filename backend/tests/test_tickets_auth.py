"""
Tests for ticket endpoints authentication and tenant isolation.
Covers: GET /tickets, POST /tickets/save, GET /tickets/{ticket_id},
        POST /tickets, PATCH /tickets/{ticket_id}
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Mock supabase before importing main
with patch("main.supabase"):
    from main import app, get_current_user

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
    "owner_id": "test-user-id-123",
    "status": "open",
    "created_at": "2026-06-01T00:00:00Z"
}


def mock_get_current_user():
    return MOCK_USER


@pytest.fixture(autouse=True)
def setup_dependency_override():
    """Override FastAPI dependency for all tests."""
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


class TestGetTickets:
    """Tests for GET /tickets endpoint."""

    def test_get_tickets_requires_auth(self):
        """Test that /tickets requires authentication."""
        app.dependency_overrides.pop(get_current_user, None)
        response = client.get("/tickets")
        assert response.status_code == 401

    @patch("main.supabase")
    def test_get_tickets_with_auth(self, mock_supabase):
        """Test that /tickets returns tickets for authenticated user."""
        mock_supabase.table.return_value.select.return_value.order.return_value.eq.return_value.execute.return_value = MagicMock(data=[MOCK_TICKET])

        response = client.get("/tickets", headers={"Authorization": "Bearer test-token"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["id"] == "ticket-123"


class TestSaveTicket:
    """Tests for POST /tickets/save endpoint."""

    def test_save_ticket_requires_auth(self):
        """Test that /tickets/save requires authentication."""
        app.dependency_overrides.pop(get_current_user, None)
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

    @patch("main.supabase")
    def test_save_ticket_uses_auth_user_id(self, mock_supabase):
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

        # Should succeed with authenticated user_id
        assert response.status_code in (200, 201)
        # Verify the insert was called with the authenticated user_id
        mock_supabase.table.return_value.insert.assert_called_once()
        insert_call_args = mock_supabase.table.return_value.insert.call_args
        saved_data = insert_call_args[0][0] if insert_call_args[0] else insert_call_args[1]
        assert saved_data.get("user_id") == "test-user-id-123", \
            f"Expected authenticated user_id, got {saved_data.get('user_id')}"
        assert saved_data.get("user_id") != "spoofed-user-id"


class TestGetTicketById:
    """Tests for GET /tickets/{ticket_id} endpoint."""

    def test_get_ticket_by_id_requires_auth(self):
        """Test that /tickets/{ticket_id} requires authentication."""
        app.dependency_overrides.pop(get_current_user, None)
        response = client.get("/tickets/ticket-123")
        assert response.status_code == 401

    @patch("main.supabase")
    def test_get_ticket_by_id_tenant_isolation(self, mock_supabase):
        """Test that /tickets/{ticket_id} enforces tenant isolation."""
        # Mock ticket from different company
        other_company_ticket = {**MOCK_TICKET, "company_id": "other-company-id"}
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=other_company_ticket)

        response = client.get("/tickets/ticket-123", headers={"Authorization": "Bearer test-token"})
        assert response.status_code == 403
        assert "different company" in response.json()["detail"]

    @patch("main.supabase")
    def test_get_ticket_by_id_same_company(self, mock_supabase):
        """Test that /tickets/{ticket_id} allows access to same company tickets."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=MOCK_TICKET)

        response = client.get("/tickets/ticket-123", headers={"Authorization": "Bearer test-token"})
        assert response.status_code == 200
        assert response.json()["id"] == "ticket-123"


class TestCreateTicketAuth:
    """Tests for POST /tickets endpoint authentication."""

    def test_create_ticket_requires_auth(self):
        """Test that POST /tickets requires authentication."""
        app.dependency_overrides.pop(get_current_user, None)
        response = client.post("/tickets", json={
            "subject": "Test",
            "description": "Test",
            "category": "general",
            "company_id": "test-company-id"
        })
        assert response.status_code == 401

    def test_create_ticket_with_auth(self):
        """Test that POST /tickets works with authentication and binds owner_id."""
        response = client.post("/tickets", json={
            "ticket_id": "TKT-NEW-001",
            "subject": "Test",
            "description": "Test",
            "category": "general",
            "company_id": "test-company-id"
        }, headers={"Authorization": "Bearer test-token"})
        assert response.status_code in (200, 201)
        # Verify owner_id was bound to authenticated user
        data = response.json()
        assert data.get("owner_id") == "test-user-id-123", \
            f"Expected owner_id to be authenticated user, got {data.get('owner_id')}"


class TestUpdateTicketAuth:
    """Tests for PATCH /tickets/{ticket_id} endpoint authentication."""

    def test_update_ticket_requires_auth(self):
        """Test that PATCH /tickets/{ticket_id} requires authentication."""
        app.dependency_overrides.pop(get_current_user, None)
        response = client.patch("/tickets/ticket-123", json={"status": "closed"})
        assert response.status_code == 401

    def test_update_ticket_with_auth(self):
        """Test that PATCH /tickets/{ticket_id} works with authentication."""
        # First create a ticket we own
        create_response = client.post("/tickets", json={
            "ticket_id": "TKT-UPDATE-001",
            "subject": "Test Update",
            "description": "Test",
            "category": "general",
            "company_id": "test-company-id"
        }, headers={"Authorization": "Bearer test-token"})
        assert create_response.status_code in (200, 201)

        # Now update it
        response = client.patch("/tickets/TKT-UPDATE-001", json={"status": "closed"},
                                headers={"Authorization": "Bearer test-token"})
        assert response.status_code in (200, 204)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
