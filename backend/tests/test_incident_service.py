import pytest
from unittest.mock import MagicMock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.services.incident_service import IncidentService, CORRELATION_THRESHOLD, WINDOW_SECONDS


class MockDuplicateService:
    def __init__(self):
        self.model = None
        self._loaded = False

    def load(self):
        self._loaded = True


class TestIncidentServicePrune:
    def test_prune_removes_old_tickets(self):
        mock_dup = MockDuplicateService()
        service = IncidentService(mock_dup)
        now = 1000.0
        service._recent = [
            {"ticket_id": "1", "ts": now - 100},
            {"ticket_id": "2", "ts": now - WINDOW_SECONDS - 10},
            {"ticket_id": "3", "ts": now -50},
        ]
        service._prune(now)
        assert len(service._recent) == 2
        assert all(t["ts"] >= now - WINDOW_SECONDS for t in service._recent)

    def test_prune_keeps_recent_tickets(self):
        mock_dup = MockDuplicateService()
        service = IncidentService(mock_dup)
        now = 1000.0
        service._recent = [
            {"ticket_id": "1", "ts": now - 100},
            {"ticket_id": "2", "ts": now - 200},
        ]
        service._prune(now)
        assert len(service._recent) == 2


class TestIncidentServiceCritical:
    def test_is_critical_priority_critical(self):
        mock_dup = MockDuplicateService()
        service = IncidentService(mock_dup)
        assert service._is_critical("critical", None) is True
        assert service._is_critical("CRITICAL", None) is True

    def test_is_critical_category_email(self):
        mock_dup = MockDuplicateService()
        service = IncidentService(mock_dup)
        assert service._is_critical(None, "email") is True
        assert service._is_critical(None, "network") is True
        assert service._is_critical(None, "authentication") is True
        assert service._is_critical(None, "exchange") is True

    def test_is_critical_not_critical(self):
        mock_dup = MockDuplicateService()
        service = IncidentService(mock_dup)
        assert service._is_critical("high", "general") is False
        assert service._is_critical(None, None) is False


class TestIncidentServiceCorrelate:
    def test_correlate_returns_defaults_when_no_model(self):
        mock_dup = MockDuplicateService()
        service = IncidentService(mock_dup)
        result = service.correlate("Test ticket text")
        assert result["incident_id"] is None
        assert result["is_major_incident"] is False
        assert result["ticket_count"] == 0
        assert result["affected_users"] == 0
        assert result["similarity"] == 0.0


class TestIncidentServiceListActive:
    def test_list_active_returns_empty_initially(self):
        mock_dup = MockDuplicateService()
        service = IncidentService(mock_dup)
        assert service.list_active() == []
