"""
Unit tests for backend.services.incident_service

Covers:
- Incident creation (happy path + validation + DB errors)
- Incident update (field whitelisting, validation, not-found)
- Incident resolution (happy path + edge cases)
- Incident escalation (happy path + edge cases)
- Query helpers: get_incident, list_incidents, get_sla_breached_incidents
- Singleton loader functions
- Degraded mode (no Supabase connection)
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime, timezone

from backend.services.incident_service import (
    IncidentService,
    IncidentStatus,
    VALID_STATUSES,
    VALID_PRIORITIES,
    SLA_HOURS,
    load,
    get_instance,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_supabase(return_data=None, raise_exc=None):
    """
    Build a mock Supabase client whose chained table().method().execute()
    returns *return_data* or raises *raise_exc*.
    """
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.data = return_data

    # Build the chainable mock: table().insert/update/select().eq().single().execute()
    chain = MagicMock()
    chain.execute.return_value = mock_response
    chain.eq.return_value = chain
    chain.single.return_value = chain
    chain.in_.return_value = chain
    chain.lt.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain

    if raise_exc:
        chain.execute.side_effect = raise_exc

    mock_table = MagicMock()
    mock_table.insert.return_value = chain
    mock_table.update.return_value = chain
    mock_table.select.return_value = chain

    mock_client.table.return_value = mock_table
    return mock_client


def _service(return_data=None, raise_exc=None):
    """Create an IncidentService with a mock Supabase client."""
    client = _make_mock_supabase(return_data=return_data, raise_exc=raise_exc)
    return IncidentService(supabase_client=client), client


# ===================================================================
# 1. CREATE INCIDENT
# ===================================================================

class TestCreateIncident:
    """Tests for IncidentService.create_incident()."""

    def test_create_incident_happy_path(self):
        """Successfully create an incident with all required fields."""
        fake_record = {
            "id": "inc-001",
            "title": "Server down",
            "description": "Production server is unresponsive",
            "priority": "Critical",
            "category": "Infrastructure",
            "status": "open",
        }
        svc, mock_client = _service(return_data=[fake_record])

        result = svc.create_incident(
            title="Server down",
            description="Production server is unresponsive",
            priority="Critical",
            category="Infrastructure",
            reported_by="user-123",
            company_id="comp-456",
        )

        assert result["id"] == "inc-001"
        assert result["status"] == "open"
        mock_client.table.assert_called_with("incidents")

    def test_create_incident_defaults(self):
        """Defaults to Medium priority and General category."""
        fake = [{"id": "inc-002", "priority": "Medium", "category": "General", "status": "open"}]
        svc, _ = _service(return_data=fake)

        result = svc.create_incident(title="Test", description="Desc")
        assert result["priority"] == "Medium"
        assert result["category"] == "General"

    def test_create_incident_empty_title_raises(self):
        """Empty title raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="title is required"):
            svc.create_incident(title="", description="desc")

    def test_create_incident_whitespace_title_raises(self):
        """Whitespace-only title raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="title is required"):
            svc.create_incident(title="   ", description="desc")

    def test_create_incident_none_title_raises(self):
        """None title raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="title is required"):
            svc.create_incident(title=None, description="desc")

    def test_create_incident_empty_description_raises(self):
        """Empty description raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="description is required"):
            svc.create_incident(title="Title", description="")

    def test_create_incident_none_description_raises(self):
        """None description raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="description is required"):
            svc.create_incident(title="Title", description=None)

    def test_create_incident_invalid_priority_raises(self):
        """Invalid priority raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="Invalid priority"):
            svc.create_incident(title="T", description="D", priority="Urgent")

    def test_create_incident_no_db_connection_raises(self):
        """ConnectionError when Supabase is unavailable."""
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError, match="Database connection not available"):
            svc.create_incident(title="T", description="D")

    def test_create_incident_db_exception_raises_runtime(self):
        """RuntimeError when the DB insert throws."""
        svc, _ = _service(raise_exc=Exception("DB timeout"))
        with pytest.raises(RuntimeError, match="Database insert failed"):
            svc.create_incident(title="T", description="D")

    def test_create_incident_empty_response_raises(self):
        """RuntimeError when insert returns no data."""
        svc, _ = _service(return_data=None)
        with pytest.raises(RuntimeError, match="returned no data"):
            svc.create_incident(title="T", description="D")

    def test_create_incident_empty_list_response_raises(self):
        """RuntimeError when insert returns an empty list."""
        svc, _ = _service(return_data=[])
        with pytest.raises(RuntimeError, match="returned no data"):
            svc.create_incident(title="T", description="D")

    def test_create_incident_sla_breach_at_set(self):
        """SLA breach timestamp is set based on priority."""
        fake = [{"id": "inc-sla", "priority": "High", "status": "open", "sla_breach_at": "..."}]
        svc, mock_client = _service(return_data=fake)

        svc.create_incident(title="SLA test", description="D", priority="High")

        # Verify the insert payload includes sla_breach_at
        insert_call = mock_client.table.return_value.insert
        inserted_record = insert_call.call_args[0][0]
        assert "sla_breach_at" in inserted_record

    def test_create_incident_metadata_forwarded(self):
        """Custom metadata dict is forwarded to the DB."""
        fake = [{"id": "inc-meta"}]
        svc, mock_client = _service(return_data=fake)
        meta = {"source": "email", "tags": ["vpn"]}

        svc.create_incident(title="T", description="D", metadata=meta)

        inserted = mock_client.table.return_value.insert.call_args[0][0]
        assert inserted["metadata"] == meta

    def test_create_incident_strips_title_and_description(self):
        """Leading/trailing whitespace is stripped from title and description."""
        fake = [{"id": "inc-strip"}]
        svc, mock_client = _service(return_data=fake)

        svc.create_incident(title="  Server down  ", description="  Desc  ")

        inserted = mock_client.table.return_value.insert.call_args[0][0]
        assert inserted["title"] == "Server down"
        assert inserted["description"] == "Desc"


# ===================================================================
# 2. UPDATE INCIDENT
# ===================================================================

class TestUpdateIncident:
    """Tests for IncidentService.update_incident()."""

    def test_update_incident_happy_path(self):
        """Successfully update allowed fields."""
        updated_record = {"id": "inc-001", "status": "in_progress", "priority": "High"}
        svc, _ = _service(return_data=[updated_record])

        result = svc.update_incident("inc-001", {"status": "in_progress", "priority": "High"})
        assert result["status"] == "in_progress"

    def test_update_incident_empty_id_raises(self):
        """Empty incident_id raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="incident_id is required"):
            svc.update_incident("", {"status": "open"})

    def test_update_incident_none_id_raises(self):
        """None incident_id raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="incident_id is required"):
            svc.update_incident(None, {"status": "open"})

    def test_update_incident_empty_updates_raises(self):
        """Empty updates dict raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="No updates provided"):
            svc.update_incident("inc-001", {})

    def test_update_incident_none_updates_raises(self):
        """None updates raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="No updates provided"):
            svc.update_incident("inc-001", None)

    def test_update_incident_no_valid_fields_raises(self):
        """ValueError when all provided fields are disallowed."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="No valid fields"):
            svc.update_incident("inc-001", {"created_at": "2024-01-01", "id": "hack"})

    def test_update_incident_invalid_priority_raises(self):
        """ValueError for invalid priority value."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="Invalid priority"):
            svc.update_incident("inc-001", {"priority": "SuperHigh"})

    def test_update_incident_invalid_status_raises(self):
        """ValueError for invalid status value."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="Invalid status"):
            svc.update_incident("inc-001", {"status": "deleted"})

    def test_update_incident_not_found_raises(self):
        """RuntimeError when incident not found (empty response)."""
        svc, _ = _service(return_data=[])
        with pytest.raises(RuntimeError, match="not found"):
            svc.update_incident("inc-ghost", {"status": "open"})

    def test_update_incident_db_error_raises(self):
        """RuntimeError when DB throws."""
        svc, _ = _service(raise_exc=Exception("Connection lost"))
        with pytest.raises(RuntimeError, match="Database update failed"):
            svc.update_incident("inc-001", {"status": "open"})

    def test_update_incident_no_db_raises(self):
        """ConnectionError when Supabase is not configured."""
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.update_incident("inc-001", {"status": "open"})

    def test_update_incident_filters_disallowed_fields(self):
        """Only whitelisted fields are sent to the DB."""
        fake = [{"id": "inc-001", "title": "Fixed"}]
        svc, mock_client = _service(return_data=fake)

        svc.update_incident("inc-001", {
            "title": "Fixed",
            "id": "should-not-pass",
            "created_at": "should-not-pass",
        })

        update_call = mock_client.table.return_value.update
        payload = update_call.call_args[0][0]
        assert "id" not in payload
        assert "created_at" not in payload
        assert payload["title"] == "Fixed"

    def test_update_incident_sets_updated_at(self):
        """updated_at is always set on updates."""
        fake = [{"id": "inc-001"}]
        svc, mock_client = _service(return_data=fake)

        svc.update_incident("inc-001", {"title": "New"})

        payload = mock_client.table.return_value.update.call_args[0][0]
        assert "updated_at" in payload


# ===================================================================
# 3. RESOLVE INCIDENT
# ===================================================================

class TestResolveIncident:
    """Tests for IncidentService.resolve_incident()."""

    def test_resolve_incident_happy_path(self):
        """Successfully resolve an incident."""
        fake = [{"id": "inc-001", "status": "resolved", "resolution_notes": "Rebooted"}]
        svc, _ = _service(return_data=fake)

        result = svc.resolve_incident("inc-001", resolution_notes="Rebooted", resolved_by="admin-1")
        assert result["status"] == "resolved"

    def test_resolve_incident_empty_id_raises(self):
        """Empty incident_id raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="incident_id is required"):
            svc.resolve_incident("")

    def test_resolve_incident_whitespace_id_raises(self):
        """Whitespace-only incident_id raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="incident_id is required"):
            svc.resolve_incident("   ")

    def test_resolve_incident_no_db_raises(self):
        """ConnectionError when Supabase is not configured."""
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.resolve_incident("inc-001")

    def test_resolve_incident_not_found_raises(self):
        """RuntimeError when incident not found."""
        svc, _ = _service(return_data=[])
        with pytest.raises(RuntimeError, match="not found"):
            svc.resolve_incident("inc-ghost")

    def test_resolve_incident_db_error_raises(self):
        """RuntimeError when DB throws."""
        svc, _ = _service(raise_exc=Exception("Timeout"))
        with pytest.raises(RuntimeError, match="Database update failed"):
            svc.resolve_incident("inc-001")

    def test_resolve_incident_sets_resolved_at(self):
        """resolved_at timestamp is set."""
        fake = [{"id": "inc-001", "status": "resolved"}]
        svc, mock_client = _service(return_data=fake)

        svc.resolve_incident("inc-001")

        payload = mock_client.table.return_value.update.call_args[0][0]
        assert payload["status"] == "resolved"
        assert "resolved_at" in payload
        assert "updated_at" in payload

    def test_resolve_incident_with_resolved_by(self):
        """resolved_by is included when provided."""
        fake = [{"id": "inc-001"}]
        svc, mock_client = _service(return_data=fake)

        svc.resolve_incident("inc-001", resolved_by="admin-42")

        payload = mock_client.table.return_value.update.call_args[0][0]
        assert payload["resolved_by"] == "admin-42"

    def test_resolve_incident_without_resolved_by(self):
        """resolved_by is omitted when not provided."""
        fake = [{"id": "inc-001"}]
        svc, mock_client = _service(return_data=fake)

        svc.resolve_incident("inc-001")

        payload = mock_client.table.return_value.update.call_args[0][0]
        assert "resolved_by" not in payload


# ===================================================================
# 4. ESCALATE INCIDENT
# ===================================================================

class TestEscalateIncident:
    """Tests for IncidentService.escalate_incident()."""

    def test_escalate_incident_happy_path(self):
        """Successfully escalate an incident."""
        fake = [{"id": "inc-001", "status": "escalated", "escalation_reason": "SLA breach"}]
        svc, _ = _service(return_data=fake)

        result = svc.escalate_incident("inc-001", reason="SLA breach", escalated_to="team-ops")
        assert result["status"] == "escalated"

    def test_escalate_incident_empty_id_raises(self):
        """Empty incident_id raises ValueError."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="incident_id is required"):
            svc.escalate_incident("")

    def test_escalate_incident_no_db_raises(self):
        """ConnectionError when Supabase is not configured."""
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.escalate_incident("inc-001")

    def test_escalate_incident_not_found_raises(self):
        """RuntimeError when incident not found."""
        svc, _ = _service(return_data=[])
        with pytest.raises(RuntimeError, match="not found"):
            svc.escalate_incident("inc-ghost")

    def test_escalate_incident_db_error_raises(self):
        """RuntimeError when DB throws."""
        svc, _ = _service(raise_exc=Exception("fail"))
        with pytest.raises(RuntimeError, match="Database update failed"):
            svc.escalate_incident("inc-001")

    def test_escalate_incident_sets_escalated_at(self):
        """escalated_at timestamp is set."""
        fake = [{"id": "inc-001"}]
        svc, mock_client = _service(return_data=fake)

        svc.escalate_incident("inc-001", reason="SLA")

        payload = mock_client.table.return_value.update.call_args[0][0]
        assert payload["status"] == "escalated"
        assert "escalated_at" in payload
        assert payload["escalation_reason"] == "SLA"

    def test_escalate_incident_with_escalated_to(self):
        """escalated_to is included when provided."""
        fake = [{"id": "inc-001"}]
        svc, mock_client = _service(return_data=fake)

        svc.escalate_incident("inc-001", escalated_to="team-senior")

        payload = mock_client.table.return_value.update.call_args[0][0]
        assert payload["escalated_to"] == "team-senior"

    def test_escalate_incident_without_escalated_to(self):
        """escalated_to is omitted when not provided."""
        fake = [{"id": "inc-001"}]
        svc, mock_client = _service(return_data=fake)

        svc.escalate_incident("inc-001")

        payload = mock_client.table.return_value.update.call_args[0][0]
        assert "escalated_to" not in payload


# ===================================================================
# 5. GET INCIDENT
# ===================================================================

class TestGetIncident:
    """Tests for IncidentService.get_incident()."""

    def test_get_incident_found(self):
        """Returns the incident dict when found."""
        fake_data = {"id": "inc-001", "title": "Server down", "status": "open"}
        svc, _ = _service(return_data=fake_data)

        result = svc.get_incident("inc-001")
        assert result["id"] == "inc-001"

    def test_get_incident_not_found_returns_none(self):
        """Returns None when the incident doesn't exist (DB raises)."""
        svc, _ = _service(raise_exc=Exception("Not found"))

        result = svc.get_incident("inc-ghost")
        assert result is None

    def test_get_incident_empty_id_raises(self):
        """ValueError for empty incident_id."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="incident_id is required"):
            svc.get_incident("")

    def test_get_incident_no_db_raises(self):
        """ConnectionError when Supabase is not configured."""
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.get_incident("inc-001")


# ===================================================================
# 6. LIST INCIDENTS
# ===================================================================

class TestListIncidents:
    """Tests for IncidentService.list_incidents()."""

    def test_list_incidents_returns_list(self):
        """Returns a list of incidents."""
        fake = [{"id": "inc-001"}, {"id": "inc-002"}]
        svc, _ = _service(return_data=fake)

        result = svc.list_incidents()
        assert len(result) == 2

    def test_list_incidents_empty(self):
        """Returns empty list when no incidents exist."""
        svc, _ = _service(return_data=[])

        result = svc.list_incidents()
        assert result == []

    def test_list_incidents_none_data(self):
        """Returns empty list when response.data is None."""
        svc, _ = _service(return_data=None)

        result = svc.list_incidents()
        assert result == []

    def test_list_incidents_with_company_filter(self):
        """Applies company_id filter."""
        fake = [{"id": "inc-001", "company_id": "comp-1"}]
        svc, mock_client = _service(return_data=fake)

        result = svc.list_incidents(company_id="comp-1")
        assert len(result) == 1

    def test_list_incidents_with_status_filter(self):
        """Applies status filter."""
        fake = [{"id": "inc-001", "status": "open"}]
        svc, _ = _service(return_data=fake)

        result = svc.list_incidents(status="open")
        assert len(result) == 1

    def test_list_incidents_invalid_status_raises(self):
        """ValueError for invalid status filter."""
        svc, _ = _service()
        with pytest.raises(ValueError, match="Invalid status filter"):
            svc.list_incidents(status="deleted")

    def test_list_incidents_no_db_raises(self):
        """ConnectionError when Supabase is not configured."""
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.list_incidents()

    def test_list_incidents_db_error_returns_empty(self):
        """Returns empty list on DB error (graceful degradation)."""
        svc, _ = _service(raise_exc=Exception("Timeout"))

        result = svc.list_incidents()
        assert result == []


# ===================================================================
# 7. SLA BREACHED INCIDENTS
# ===================================================================

class TestGetSlaBreachedIncidents:
    """Tests for IncidentService.get_sla_breached_incidents()."""

    def test_sla_breached_returns_list(self):
        """Returns incidents with breached SLA."""
        fake = [{"id": "inc-001", "sla_breach_at": "2024-01-01T00:00:00Z"}]
        svc, _ = _service(return_data=fake)

        result = svc.get_sla_breached_incidents()
        assert len(result) == 1

    def test_sla_breached_empty(self):
        """Returns empty list when no breaches."""
        svc, _ = _service(return_data=[])

        result = svc.get_sla_breached_incidents()
        assert result == []

    def test_sla_breached_with_company_filter(self):
        """Applies company_id filter."""
        fake = [{"id": "inc-001"}]
        svc, _ = _service(return_data=fake)

        result = svc.get_sla_breached_incidents(company_id="comp-1")
        assert len(result) == 1

    def test_sla_breached_no_db_raises(self):
        """ConnectionError when Supabase is not configured."""
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.get_sla_breached_incidents()

    def test_sla_breached_db_error_returns_empty(self):
        """Returns empty list on DB error."""
        svc, _ = _service(raise_exc=Exception("fail"))

        result = svc.get_sla_breached_incidents()
        assert result == []


# ===================================================================
# 8. CONSTANTS & ENUMS
# ===================================================================

class TestConstants:
    """Tests for module-level constants and enums."""

    def test_valid_statuses_complete(self):
        """All expected statuses are present."""
        expected = {"open", "in_progress", "resolved", "closed", "escalated"}
        assert VALID_STATUSES == expected

    def test_valid_priorities_complete(self):
        """All expected priorities are present."""
        expected = {"Critical", "High", "Medium", "Low"}
        assert VALID_PRIORITIES == expected

    def test_sla_hours_mapping(self):
        """SLA hours are correctly mapped to priorities."""
        assert SLA_HOURS["Critical"] == 2
        assert SLA_HOURS["High"] == 8
        assert SLA_HOURS["Medium"] == 24
        assert SLA_HOURS["Low"] == 72

    def test_incident_status_enum_values(self):
        """IncidentStatus enum has correct values."""
        assert IncidentStatus.OPEN.value == "open"
        assert IncidentStatus.IN_PROGRESS.value == "in_progress"
        assert IncidentStatus.RESOLVED.value == "resolved"
        assert IncidentStatus.CLOSED.value == "closed"
        assert IncidentStatus.ESCALATED.value == "escalated"

    def test_incident_status_is_string_enum(self):
        """IncidentStatus members are usable as strings."""
        assert IncidentStatus.OPEN == "open"
        assert IncidentStatus.RESOLVED.value == "resolved"


# ===================================================================
# 9. SINGLETON / LOADER
# ===================================================================

class TestSingleton:
    """Tests for load() and get_instance() module functions."""

    def test_get_instance_before_load_returns_none(self):
        """get_instance() returns None before load() is called."""
        import backend.services.incident_service as mod
        mod._instance = None

        assert get_instance() is None

    @patch("backend.services.incident_service.create_client")
    @patch.dict("os.environ", {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
    })
    def test_load_creates_singleton(self, mock_create):
        """load() creates and caches a singleton instance."""
        import backend.services.incident_service as mod
        mod._instance = None

        mock_create.return_value = MagicMock()
        instance = load()

        assert instance is not None
        assert isinstance(instance, IncidentService)
        assert get_instance() is instance

    @patch("backend.services.incident_service.create_client")
    @patch.dict("os.environ", {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
    })
    def test_load_returns_same_instance(self, mock_create):
        """Subsequent calls to load() return the same object."""
        import backend.services.incident_service as mod
        mod._instance = None

        mock_create.return_value = MagicMock()
        first = load()
        second = load()

        assert first is second


# ===================================================================
# 10. DEGRADED MODE (no Supabase)
# ===================================================================

class TestDegradedMode:
    """Tests for IncidentService behavior when Supabase is unavailable."""

    def test_create_raises_connection_error(self):
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.create_incident(title="T", description="D")

    def test_update_raises_connection_error(self):
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.update_incident("id", {"status": "open"})

    def test_resolve_raises_connection_error(self):
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.resolve_incident("id")

    def test_escalate_raises_connection_error(self):
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.escalate_incident("id")

    def test_get_raises_connection_error(self):
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.get_incident("id")

    def test_list_raises_connection_error(self):
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.list_incidents()

    def test_sla_breached_raises_connection_error(self):
        svc = IncidentService(supabase_client=None)
        svc.supabase = None
        with pytest.raises(ConnectionError):
            svc.get_sla_breached_incidents()
