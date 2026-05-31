import pytest
import datetime
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.services.sla_engine import (
    SLAEngine, SLAStatus, EscalationLevel, ChannelType,
    SLA_POLICIES, get_sla_policy, compute_sla_breach_at
)


class TestSLAStatus:
    def test_sla_status_values(self):
        assert SLAStatus.ACTIVE.value == "active"
        assert SLAStatus.WARNING.value == "warning"
        assert SLAStatus.BREACHED.value == "breached"
        assert SLAStatus.MET.value == "met"
        assert SLAStatus.PAUSED.value == "paused"


class TestEscalationLevel:
    def test_escalation_level_values(self):
        assert EscalationLevel.NONE.value == 0
        assert EscalationLevel.LEVEL_1.value == 1
        assert EscalationLevel.LEVEL_2.value == 2
        assert EscalationLevel.LEVEL_3.value == 3


class TestSLAPolicies:
    def test_critical_policy(self):
        policy = SLA_POLICIES["critical"]
        assert policy["max_hours"] == 2
        assert policy["max_seconds"] == 7200
        assert policy["warning_pct"] == 0.75
        assert policy["auto_escalate_on_breach"] is True

    def test_high_policy(self):
        policy = SLA_POLICIES["high"]
        assert policy["max_hours"] == 4
        assert policy["max_seconds"] == 14400

    def test_medium_policy(self):
        policy = SLA_POLICIES["medium"]
        assert policy["max_hours"] == 8

    def test_low_policy(self):
        policy = SLA_POLICIES["low"]
        assert policy["max_hours"] == 24
        assert policy["auto_escalate_on_breach"] is False


class TestGetSLAPolicy:
    def test_get_policy_critical(self):
        policy = get_sla_policy("critical")
        assert policy["max_hours"] == 2

    def test_get_policy_unknown_returns_medium(self):
        policy = get_sla_policy("unknown")
        assert policy == SLA_POLICIES["medium"]

    def test_get_policy_case_insensitive(self):
        policy = get_sla_policy("HIGH")
        assert policy["max_hours"] == 4


class TestSLAEngineEvaluateTicket:
    def test_evaluate_ticket_active(self):
        engine = SLAEngine(supabase_client=None)
        now = datetime.datetime.utcnow()
        ticket = {
            "priority": "high",
            "created_at": now.isoformat() + "Z",
            "status": "open"
        }
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.ACTIVE.value
        assert result["escalation_level"] == EscalationLevel.NONE.value
        assert result["needs_notification"] is False

    def test_evaluate_ticket_resolved_is_met(self):
        engine = SLAEngine(supabase_client=None)
        now = datetime.datetime.utcnow()
        ticket = {
            "priority": "high",
            "created_at": now.isoformat() + "Z",
            "status": "resolved"
        }
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.MET.value

    def test_evaluate_ticket_closed_is_met(self):
        engine = SLAEngine(supabase_client=None)
        now = datetime.datetime.utcnow()
        ticket = {
            "priority": "medium",
            "created_at": now.isoformat() + "Z",
            "status": "closed"
        }
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.MET.value

    def test_evaluate_ticket_missing_time_returns_default(self):
        engine = SLAEngine(supabase_client=None)
        ticket = {"priority": "high"}
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.ACTIVE.value
        assert result["remaining_seconds"] == SLA_POLICIES["high"]["max_seconds"]

    def test_evaluate_ticket_invalid_time_returns_default(self):
        engine = SLAEngine(supabase_client=None)
        ticket = {
            "priority": "critical",
            "created_at": "invalid-date",
            "status": "open"
        }
        result = engine.evaluate_ticket(ticket)
        assert result["sla_status"] == SLAStatus.ACTIVE.value


class TestComputeSLABreachAt:
    def test_compute_breach_at_returns_iso_string(self):
        now = datetime.datetime.utcnow()
        breach = compute_sla_breach_at("critical", now)
        assert isinstance(breach, str)
        assert "T" in breach

    def test_compute_breach_at_different_priorities(self):
        now = datetime.datetime.utcnow()
        critical_breach = compute_sla_breach_at("critical", now)
        low_breach = compute_sla_breach_at("low", now)
        assert critical_breach != low_breach


class TestSLAEngineNoSupabase:
    def test_check_all_active_tickets_no_client(self):
        engine = SLAEngine(supabase_client=None)
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            engine.check_all_active_tickets()
        )
        assert result == []

    def test_get_dashboard_stats_no_client(self):
        engine = SLAEngine(supabase_client=None)
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            engine.get_dashboard_stats()
        )
        assert "error" in result


class TestFmtRemaining:
    def test_fmt_remaining_overdue(self):
        from backend.services.sla_engine import SLAEngine
        result = SLAEngine._fmt_remaining(0)
        assert result == "OVERDUE"

    def test_fmt_remaining_hours(self):
        from backend.services.sla_engine import SLAEngine
        result = SLAEngine._fmt_remaining(7200)
        assert result == "2h 0m"

    def test_fmt_remaining_minutes(self):
        from backend.services.sla_engine import SLAEngine
        result = SLAEngine._fmt_remaining(300)
        assert result == "5m"
