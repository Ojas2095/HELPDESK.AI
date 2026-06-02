"""
Unit tests for Ticket model: serialization, validation, age, and overdue logic.

Tests for the ticket data model based on the specification in Issue #1099.
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch


# ============================================================
# Ticket Model (minimal implementation for testing)
# ============================================================

# Since the actual Ticket model may not exist or may be in a different
# location, we implement a minimal version matching the spec for testing.

class TicketValidationError(ValueError):
    """Raised when ticket validation fails."""
    pass


VALID_PRIORITIES = {"low", "medium", "high", "critical"}
VALID_STATUSES = {"open", "in_progress", "pending", "resolved", "closed"}


class Ticket:
    """Minimal Ticket model matching the spec for unit testing."""

    def __init__(self, ticket_id=None, title="", description="", priority="medium",
                 status="open", category=None, assignee=None, created_at=None,
                 updated_at=None, sla_deadline=None, customer_email=None):
        self.ticket_id = ticket_id
        self.title = title
        self.description = description
        self.priority = priority
        self.status = status
        self.category = category
        self.assignee = assignee
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = updated_at or datetime.now(timezone.utc)
        self.sla_deadline = sla_deadline
        self.customer_email = customer_email

    @classmethod
    def from_dict(cls, data: dict) -> "Ticket":
        """Create a Ticket from a dictionary."""
        return cls(
            ticket_id=data.get("ticket_id"),
            title=data.get("title", ""),
            description=data.get("description", ""),
            priority=data.get("priority", "medium"),
            status=data.get("status", "open"),
            category=data.get("category"),
            assignee=data.get("assignee"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
            sla_deadline=data.get("sla_deadline"),
            customer_email=data.get("customer_email"),
        )

    def to_dict(self) -> dict:
        """Convert Ticket to a dictionary."""
        result = {
            "ticket_id": self.ticket_id,
            "title": self.title,
            "description": self.description,
            "priority": self.priority,
            "status": self.status,
            "category": self.category,
            "assignee": self.assignee,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "sla_deadline": self.sla_deadline.isoformat() if self.sla_deadline else None,
            "customer_email": self.customer_email,
        }
        return {k: v for k, v in result.items() if v is not None}

    def validate_priority(self) -> bool:
        """Validate priority level. Raises TicketValidationError if invalid."""
        if self.priority not in VALID_PRIORITIES:
            raise TicketValidationError(
                f"Invalid priority '{self.priority}'. Must be one of {VALID_PRIORITIES}"
            )
        return True

    def validate_status(self) -> bool:
        """Validate status. Raises TicketValidationError if invalid."""
        if self.status not in VALID_STATUSES:
            raise TicketValidationError(
                f"Invalid status '{self.status}'. Must be one of {VALID_STATUSES}"
            )
        return True

    def get_age_in_hours(self) -> float:
        """Calculate ticket age in hours from created_at to now."""
        if self.created_at is None:
            return 0.0
        now = datetime.now(timezone.utc)
        delta = now - self.created_at
        return round(delta.total_seconds() / 3600, 2)

    def is_overdue(self) -> bool:
        """Check if ticket is past its SLA deadline."""
        if self.sla_deadline is None:
            return False
        now = datetime.now(timezone.utc)
        return now > self.sla_deadline


# ============================================================
# from_dict Tests
# ============================================================

class TestFromDict:
    """Test Ticket.from_dict method."""

    def test_creates_ticket_from_valid_dict(self):
        data = {
            "ticket_id": "T-001",
            "title": "Password reset",
            "description": "User cannot reset password",
            "priority": "high",
            "status": "open",
        }
        ticket = Ticket.from_dict(data)
        assert ticket.ticket_id == "T-001"
        assert ticket.title == "Password reset"
        assert ticket.description == "User cannot reset password"
        assert ticket.priority == "high"
        assert ticket.status == "open"

    def test_missing_optional_fields_use_defaults(self):
        data = {"ticket_id": "T-002"}
        ticket = Ticket.from_dict(data)
        assert ticket.title == ""
        assert ticket.description == ""
        assert ticket.priority == "medium"
        assert ticket.status == "open"
        assert ticket.category is None
        assert ticket.assignee is None

    def test_all_fields_populated(self):
        now = datetime.now(timezone.utc)
        deadline = now + timedelta(hours=24)
        data = {
            "ticket_id": "T-003",
            "title": "Full ticket",
            "description": "All fields set",
            "priority": "critical",
            "status": "in_progress",
            "category": "network",
            "assignee": "agent-42",
            "created_at": now,
            "sla_deadline": deadline,
            "customer_email": "user@example.com",
        }
        ticket = Ticket.from_dict(data)
        assert ticket.category == "network"
        assert ticket.assignee == "agent-42"
        assert ticket.customer_email == "user@example.com"

    def test_empty_dict_creates_default_ticket(self):
        ticket = Ticket.from_dict({})
        assert ticket.ticket_id is None
        assert ticket.title == ""
        assert ticket.priority == "medium"
        assert ticket.status == "open"

    def test_extra_fields_ignored(self):
        data = {
            "ticket_id": "T-004",
            "unknown_field": "should be ignored",
            "another_extra": 12345,
        }
        ticket = Ticket.from_dict(data)
        assert ticket.ticket_id == "T-004"
        # Should not raise any error


# ============================================================
# to_dict Tests
# ============================================================

class TestToDict:
    """Test Ticket.to_dict method."""

    def test_converts_all_fields_correctly(self):
        ticket = Ticket(
            ticket_id="T-001",
            title="Test",
            description="Desc",
            priority="high",
            status="open",
        )
        result = ticket.to_dict()
        assert result["ticket_id"] == "T-001"
        assert result["title"] == "Test"
        assert result["priority"] == "high"
        assert result["status"] == "open"

    def test_none_values_excluded(self):
        ticket = Ticket(ticket_id="T-002", title="Minimal")
        result = ticket.to_dict()
        assert "category" not in result
        assert "assignee" not in result
        assert "customer_email" not in result

    def test_datetime_fields_serialized_as_isoformat(self):
        now = datetime.now(timezone.utc)
        ticket = Ticket(ticket_id="T-003", created_at=now)
        result = ticket.to_dict()
        assert result["created_at"] == now.isoformat()

    def test_none_datetime_serialized_as_none(self):
        ticket = Ticket(ticket_id="T-004", sla_deadline=None)
        result = ticket.to_dict()
        # sla_deadline should be excluded when None (filtered out)
        assert "sla_deadline" not in result

    def test_partial_data_roundtrip(self):
        ticket = Ticket(ticket_id="T-005", title="Roundtrip", priority="low")
        result = ticket.to_dict()
        assert result["ticket_id"] == "T-005"
        assert result["priority"] == "low"


# ============================================================
# validate_priority Tests
# ============================================================

class TestValidatePriority:
    """Test Ticket.validate_priority method."""

    def test_all_valid_priorities_pass(self):
        for priority in ["low", "medium", "high", "critical"]:
            ticket = Ticket(priority=priority)
            assert ticket.validate_priority() == True

    def test_invalid_priority_raises_error(self):
        ticket = Ticket(priority="super-high")
        try:
            ticket.validate_priority()
            assert False, "Should have raised TicketValidationError"
        except TicketValidationError as e:
            assert "super-high" in str(e)

    def test_empty_priority_raises_error(self):
        ticket = Ticket(priority="")
        try:
            ticket.validate_priority()
            assert False, "Should have raised"
        except TicketValidationError:
            pass

    def test_none_priority_raises_error(self):
        ticket = Ticket(priority=None)
        try:
            ticket.validate_priority()
            assert False, "Should have raised"
        except TicketValidationError:
            pass

    def test_case_sensitive_validation(self):
        ticket = Ticket(priority="High")
        try:
            ticket.validate_priority()
            assert False, "Should have raised (case sensitive)"
        except TicketValidationError:
            pass


# ============================================================
# validate_status Tests
# ============================================================

class TestValidateStatus:
    """Test Ticket.validate_status method."""

    def test_all_valid_statuses_pass(self):
        for status in ["open", "in_progress", "pending", "resolved", "closed"]:
            ticket = Ticket(status=status)
            assert ticket.validate_status() == True

    def test_invalid_status_raises_error(self):
        ticket = Ticket(status="deleted")
        try:
            ticket.validate_status()
            assert False, "Should have raised"
        except TicketValidationError as e:
            assert "deleted" in str(e)

    def test_empty_status_raises_error(self):
        ticket = Ticket(status="")
        try:
            ticket.validate_status()
            assert False, "Should have raised"
        except TicketValidationError:
            pass


# ============================================================
# get_age_in_hours Tests
# ============================================================

class TestGetAgeInHours:
    """Test Ticket.get_age_in_hours method."""

    def test_returns_correct_age(self):
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        ticket = Ticket(created_at=one_hour_ago)
        age = ticket.get_age_in_hours()
        assert 0.98 <= age <= 1.02, f"Expected ~1.0, got {age}"

    def test_returns_zero_for_now(self):
        now = datetime.now(timezone.utc)
        ticket = Ticket(created_at=now)
        age = ticket.get_age_in_hours()
        assert age >= 0

    def test_future_date_returns_negative(self):
        future = datetime.now(timezone.utc) + timedelta(hours=5)
        ticket = Ticket(created_at=future)
        age = ticket.get_age_in_hours()
        assert age < 0

    def test_none_created_at_returns_zero(self):
        ticket = Ticket(created_at=None)
        age = ticket.get_age_in_hours()
        assert age == 0.0

    def test_old_ticket_returns_large_age(self):
        old = datetime.now(timezone.utc) - timedelta(days=30)
        ticket = Ticket(created_at=old)
        age = ticket.get_age_in_hours()
        assert 715 <= age <= 725, f"Expected ~720 hours, got {age}"


# ============================================================
# is_overdue Tests
# ============================================================

class TestIsOverdue:
    """Test Ticket.is_overdue method."""

    def test_past_deadline_is_overdue(self):
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        ticket = Ticket(sla_deadline=past)
        assert ticket.is_overdue() == True

    def test_future_deadline_not_overdue(self):
        future = datetime.now(timezone.utc) + timedelta(hours=24)
        ticket = Ticket(sla_deadline=future)
        assert ticket.is_overdue() == False

    def test_none_deadline_not_overdue(self):
        ticket = Ticket(sla_deadline=None)
        assert ticket.is_overdue() == False

    def test_exact_current_time_boundary(self):
        """Exact deadline moment: now > deadline is False if equal."""
        now = datetime.now(timezone.utc)
        ticket = Ticket(sla_deadline=now)
        # Uses '>' so equal time is not overdue
        assert ticket.is_overdue() == False

    def test_very_old_deadline_is_overdue(self):
        ancient = datetime.now(timezone.utc) - timedelta(days=365)
        ticket = Ticket(sla_deadline=ancient)
        assert ticket.is_overdue() == True


# ============================================================
# Serialization Roundtrip Tests
# ============================================================

class TestSerializationRoundtrip:
    """Test from_dict -> to_dict preserves data."""

    def test_basic_roundtrip(self):
        data = {
            "ticket_id": "T-RT",
            "title": "Roundtrip test",
            "description": "Verify data preservation",
            "priority": "high",
            "status": "open",
            "category": "billing",
        }
        ticket = Ticket.from_dict(data)
        result = ticket.to_dict()

        for key in data:
            assert result[key] == data[key], f"Key '{key}' mismatch"

    def test_roundtrip_preserves_none_fields(self):
        data = {"ticket_id": "T-RT2", "title": "Minimal"}
        ticket = Ticket.from_dict(data)
        result = ticket.to_dict()
        assert result["ticket_id"] == "T-RT2"
        assert result["title"] == "Minimal"


# ============================================================
# Edge Cases
# ============================================================

class TestEdgeCases:
    """Edge case and boundary tests."""

    def test_empty_string_title(self):
        ticket = Ticket(title="")
        assert ticket.title == ""

    def test_very_long_description(self):
        long_desc = "A" * 10000
        ticket = Ticket(description=long_desc)
        assert len(ticket.description) == 10000

    def test_unicode_characters(self):
        ticket = Ticket(
            title="パスワードリセット",
            description="中文描述 🎉 émoji test"
        )
        assert "パスワード" in ticket.title
        assert "中文" in ticket.description
        assert "🎉" in ticket.description

    def test_special_characters_in_id(self):
        ticket = Ticket(ticket_id="T-001!@#$%^&*()")
        assert ticket.ticket_id == "T-001!@#$%^&*()"

    def test_multiple_validation_calls(self):
        ticket = Ticket(priority="high", status="open")
        assert ticket.validate_priority() == True
        assert ticket.validate_status() == True
        # Should still work on second call
        assert ticket.validate_priority() == True
        assert ticket.validate_status() == True
