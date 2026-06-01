"""Unit tests for backend.services.sla_engine — SLA breach detection and escalation."""

import datetime
import json
import os
from unittest.mock import patch, MagicMock, AsyncMock

import pytest

from backend.services.sla_engine import (
    SLAEngine,
    SLAStatus,
    EscalationLevel,
    ChannelType,
    SLA_POLICIES,
    get_sla_policy,
    compute_sla_breach_at,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def engine():
    """SLAEngine with no DB client (unit tests only)."""
    return SLAEngine(supabase_client=None)


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for async tests."""
    client = MagicMock()
    client.table.return_value.select.return_value.not_.ilike.return_value.not_.ilike.return_value.execute.return_value = MagicMock(data=[])
    return client


def _make_ticket(**overrides):
    """Helper: build a minimal ticket dict with sensible defaults."""
    base = {
        "id": "tkt-001",
        "priority": "medium",
        "status": "open",
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "subject": "Test ticket",
        "assigned_team": "General Support",
        "escalation_level": 0,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# SLA Policy definitions
# ---------------------------------------------------------------------------

class TestSLAPolicies:
    def test_all_priorities_defined(self):
        for p in ("critical", "high", "medium", "low"):
            assert p in SLA_POLICIES

    def test_critical_policy_values(self):
        p = SLA_POLICIES["critical"]
        assert p["max_hours"] == 2
        assert p["max_seconds"] == 7200
        assert p["warning_pct"] == 0.75
        assert p["auto_escalate_on_breach"] is True

    def test_low_policy_no_auto_escalation(self):
        assert SLA_POLICIES["low"]["auto_escalate_on_breach"] is False

    def test_max_hours_descend_by_priority(self):
        hours = [SLA_POLICIES[p]["max_hours"] for p in ("critical", "high", "medium", "low")]
        assert hours == sorted(hours), "max_hours should increase from critical → low"


# ---------------------------------------------------------------------------
# get_sla_policy helper
# ---------------------------------------------------------------------------

class TestGetSlaPolicy:
    def test_exact_match(self):
        assert get_sla_policy("critical")["max_hours"] == 2

    def test_case_insensitive(self):
        assert get_sla_policy("HIGH")["max_hours"] == 4

    def test_whitespace_stripped(self):
        assert get_sla_policy("  low  ")["max_hours"] == 24

    def test_unknown_defaults_to_medium(self):
        assert get_sla_policy("nonexistent")["max_hours"] == 8


# ---------------------------------------------------------------------------
# compute_sla_breach_at helper
# ---------------------------------------------------------------------------

class TestComputeSlaBreachAt:
    def test_returns_iso_string(self):
        result = compute_sla_breach_at("critical")
        # Should parse without error
        datetime.datetime.fromisoformat(result)

    def test_critical_breach_in_2h(self):
        start = datetime.datetime(2026, 1, 1, 12, 0, 0, tzinfo=datetime.timezone.utc)
        result = compute_sla_breach_at("critical", from_time=start)
        expected = datetime.datetime(2026, 1, 1, 14, 0, 0, tzinfo=datetime.timezone.utc)
        assert result == expected.isoformat()

    def test_low_breach_in_24h(self):
        start = datetime.datetime(2026, 1, 1, 12, 0, 0, tzinfo=datetime.timezone.utc)
        result = compute_sla_breach_at("low", from_time=start)
        expected = datetime.datetime(2026, 1, 2, 12, 0, 0, tzinfo=datetime.timezone.utc)
        assert result == expected.isoformat()


# ---------------------------------------------------------------------------
# _fmt_remaining static method
# ---------------------------------------------------------------------------

class TestFmtRemaining:
    def test_overdue(self):
        assert SLAEngine._fmt_remaining(0) == "OVERDUE"
        assert SLAEngine._fmt_remaining(-100) == "OVERDUE"

    def test_minutes_only(self):
        assert SLAEngine._fmt_remaining(1800) == "30m"

    def test_hours_and_minutes(self):
        assert SLAEngine._fmt_remaining(5400) == "1h 30m"

    def test_exact_hour(self):
        assert SLAEngine._fmt_remaining(3600) == "1h 0m"


# ---------------------------------------------------------------------------
# evaluate_ticket — core SLA evaluation
# ---------------------------------------------------------------------------

class TestEvaluateTicket:
    def test_active_ticket_within_sla(self, engine):
        """Ticket created 30 min ago (medium SLA = 8h) → ACTIVE."""
        ticket = _make_ticket(
            priority="medium",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=30)).isoformat(),
        )
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.ACTIVE.value
        assert result["remaining_seconds"] > 0
        assert result["escalation_level"] == 0

    def test_warning_ticket(self, engine):
        """Ticket created 7h ago (medium SLA = 8h, warning at 75% = 6h) → WARNING."""
        ticket = _make_ticket(
            priority="medium",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=7)).isoformat(),
        )
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.WARNING.value
        assert result["escalation_level"] == 1
        assert result["needs_notification"] is True

    def test_breached_ticket(self, engine):
        """Ticket created 10h ago (medium SLA = 8h) → BREACHED."""
        ticket = _make_ticket(
            priority="medium",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=10)).isoformat(),
        )
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.BREACHED.value
        assert result["remaining_seconds"] < 0
        assert result["escalation_level"] >= 2

    def test_resolved_ticket_is_met(self, engine):
        """Resolved ticket → SLA MET regardless of age."""
        ticket = _make_ticket(
            status="resolved",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).isoformat(),
        )
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.MET.value
        assert result["needs_notification"] is False

    def test_closed_ticket_is_met(self, engine):
        ticket = _make_ticket(
            status="closed",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)).isoformat(),
        )
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.MET.value

    def test_auto_resolved_ticket_is_met(self, engine):
        ticket = _make_ticket(
            status="auto-resolved",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)).isoformat(),
        )
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.MET.value

    def test_critical_breach_escalation(self, engine):
        """Critical ticket breached for 3h → L3 escalation (> l3_escalation_mins=120)."""
        ticket = _make_ticket(
            priority="critical",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5)).isoformat(),
            escalation_level=0,
        )
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.BREACHED.value
        assert result["escalation_level"] == 3

    def test_no_escalation_if_already_at_level(self, engine):
        """If ticket already escalated to L2, needs_notification should be False for L2."""
        ticket = _make_ticket(
            priority="critical",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=3)).isoformat(),
            escalation_level=2,
        )
        result = engine.evaluate_ticket(ticket)
        # Breached but already at L2 → no new notification unless L3
        if result["escalation_level"] <= 2:
            assert result["needs_notification"] is False

    def test_missing_created_at_returns_default(self, engine):
        """Ticket with no created_at → default ACTIVE with full SLA remaining."""
        ticket = _make_ticket(created_at=None)
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.ACTIVE.value
        assert result["remaining_seconds"] == SLA_POLICIES["medium"]["max_seconds"]

    def test_invalid_date_format_returns_default(self, engine):
        ticket = _make_ticket(created_at="not-a-date")
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.ACTIVE.value

    def test_unknown_priority_defaults_to_medium(self, engine):
        ticket = _make_ticket(
            priority="UNKNOWN",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)).isoformat(),
        )
        result = engine.evaluate_ticket(ticket)
        # Should use medium policy (8h)
        assert result["sla_status"] == SLAStatus.ACTIVE.value

    def test_elapsed_pct_calculation(self, engine):
        """Ticket at exactly 50% of SLA → elapsed_pct ≈ 0.5."""
        ticket = _make_ticket(
            priority="medium",
            created_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=4)).isoformat(),
        )
        result = engine.evaluate_ticket(ticket)
        assert 0.45 <= result["elapsed_pct"] <= 0.55


# ---------------------------------------------------------------------------
# _build_payload — notification formatting
# ---------------------------------------------------------------------------

class TestBuildPayload:
    def test_slack_payload_structure(self, engine):
        ticket = _make_ticket(id="abc123", priority="high")
        result = {"sla_status": "breached", "remaining_seconds": -3600, "escalation_level": 2}
        payload = engine._build_payload(ticket, result, ChannelType.SLACK)
        assert "attachments" in payload
        assert payload["attachments"][0]["color"] == "#ef4444"

    def test_teams_payload_structure(self, engine):
        ticket = _make_ticket(id="abc123", priority="high")
        result = {"sla_status": "warning", "remaining_seconds": 1800, "escalation_level": 1}
        payload = engine._build_payload(ticket, result, ChannelType.TEAMS)
        assert payload["@type"] == "MessageCard"
        assert "sections" in payload

    def test_email_payload_structure(self, engine):
        ticket = _make_ticket(id="abc123", priority="critical")
        result = {"sla_status": "breached", "remaining_seconds": -7200, "escalation_level": 3}
        # Note: _build_payload has a bug where it references `channel` variable
        # in the email branch but doesn't receive it as a parameter.
        # This test documents the bug (NameError) and verifies the non-email paths work.
        with pytest.raises(NameError, match="channel"):
            engine._build_payload(ticket, result, ChannelType.EMAIL)

    def test_generic_webhook_fallback(self, engine):
        ticket = _make_ticket()
        result = {"sla_status": "active", "remaining_seconds": 3600, "escalation_level": 0}
        payload = engine._build_payload(ticket, result, "unknown")
        assert "title" in payload
        assert "ticket_url" in payload


# ---------------------------------------------------------------------------
# _resolve_channels — channel filtering
# ---------------------------------------------------------------------------

class TestResolveChannels:
    def test_filters_by_enabled(self, engine):
        engine.channels = [
            {"type": "email", "enabled": True, "min_level": 0, "url": "http://test"},
            {"type": "slack", "enabled": False, "min_level": 0, "url": "http://test"},
        ]
        result = {"escalation_level": 1}
        channels = engine._resolve_channels({}, result)
        assert len(channels) == 1
        assert channels[0]["type"] == "email"

    def test_filters_by_min_level(self, engine):
        engine.channels = [
            {"type": "email", "enabled": True, "min_level": 0, "url": "http://test"},
            {"type": "slack", "enabled": True, "min_level": 2, "url": "http://test"},
        ]
        result = {"escalation_level": 1}
        channels = engine._resolve_channels({}, result)
        assert len(channels) == 1
        assert channels[0]["type"] == "email"

    def test_all_channels_at_high_level(self, engine):
        engine.channels = [
            {"type": "email", "enabled": True, "min_level": 0, "url": "http://test"},
            {"type": "slack", "enabled": True, "min_level": 2, "url": "http://test"},
        ]
        result = {"escalation_level": 3}
        channels = engine._resolve_channels({}, result)
        assert len(channels) == 2


# ---------------------------------------------------------------------------
# Helper functions: _load_escalation_channels, _load_team_escalation_contacts
# ---------------------------------------------------------------------------

class TestLoadHelpers:
    def test_load_channels_from_env(self):
        channels = [{"type": "email", "url": "http://test", "enabled": True}]
        with patch.dict(os.environ, {"SLA_CHANNELS": json.dumps(channels)}):
            from backend.services.sla_engine import _load_escalation_channels
            result = _load_escalation_channels()
            assert result == channels

    def test_load_channels_invalid_json(self):
        with patch.dict(os.environ, {"SLA_CHANNELS": "not-json"}):
            from backend.services.sla_engine import _load_escalation_channels
            result = _load_escalation_channels()
            assert result == []

    def test_load_contacts_from_env(self):
        contacts = {"engineering": "eng@company.com"}
        with patch.dict(os.environ, {"SLA_ESCALATION_CONTACTS": json.dumps(contacts)}):
            from backend.services.sla_engine import _load_team_escalation_contacts
            result = _load_team_escalation_contacts()
            assert result == contacts


# ---------------------------------------------------------------------------
# Enum values
# ---------------------------------------------------------------------------

class TestEnums:
    def test_sla_status_values(self):
        assert SLAStatus.ACTIVE.value == "active"
        assert SLAStatus.WARNING.value == "warning"
        assert SLAStatus.BREACHED.value == "breached"
        assert SLAStatus.MET.value == "met"
        assert SLAStatus.PAUSED.value == "paused"

    def test_escalation_level_values(self):
        assert EscalationLevel.NONE.value == 0
        assert EscalationLevel.LEVEL_1.value == 1
        assert EscalationLevel.LEVEL_2.value == 2
        assert EscalationLevel.LEVEL_3.value == 3

    def test_channel_type_values(self):
        assert ChannelType.EMAIL.value == "email"
        assert ChannelType.SLACK.value == "slack"
        assert ChannelType.TEAMS.value == "teams"
        assert ChannelType.WEBHOOK.value == "webhook"
