"""
Unit tests for DuplicateService.
Tests cover: initialization, availability, load behavior, add_ticket,
check_duplicate, save_to_disk, and degraded mode.
"""

import json
import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def _no_model_imports(monkeypatch):
    """Stub heavy ML imports so the module can be loaded without
    sentence-transformers being installed in the test environment."""
    mock_st = MagicMock()
    monkeypatch.setitem(__import__("sys").modules, "sentence_transformers", mock_st)
    return mock_st


@pytest.fixture()
def service(_no_model_imports, tmp_path, monkeypatch):
    """Return a fresh DuplicateService wired to a temporary storage dir."""
    from backend.services.duplicate_service import DuplicateService

    svc = DuplicateService()
    svc.storage_file = str(tmp_path / "case_history_cache.json")
    return svc


@pytest.fixture()
def loaded_service(service, _no_model_imports):
    """Return a DuplicateService with a mocked model already loaded."""
    mock_model = MagicMock()
    # encode returns a tensor-like object
    mock_model.encode.return_value = MagicMock()

    service.model = mock_model
    service._loaded = True
    return service


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------

class TestInit:
    def test_default_state(self, service):
        assert service.model is None
        assert service._loaded is False
        assert service._load_failed is False
        assert service._tickets == []

    def test_storage_dir_created(self, _no_model_imports, tmp_path):
        """DuplicateService should create its storage directory if missing."""
        from backend.services.duplicate_service import DuplicateService
        nested_dir = tmp_path / "deeply" / "nested" / "cache"
        svc = DuplicateService()
        svc.storage_file = str(nested_dir / "data.json")
        # The directory should not exist yet
        assert not nested_dir.exists()
        # After save_to_disk, the directory should be created
        svc.save_to_disk("t1", "hello")
        assert nested_dir.exists()


# ---------------------------------------------------------------------------
# is_available
# ---------------------------------------------------------------------------

class TestIsAvailable:
    def test_not_loaded(self, service):
        assert service.is_available() is False

    def test_loaded(self, loaded_service):
        assert loaded_service.is_available() is True

    def test_load_failed(self, service):
        service._load_failed = True
        assert service.is_available() is False

    def test_loaded_then_failed(self, loaded_service):
        loaded_service._load_failed = True
        assert loaded_service.is_available() is False


# ---------------------------------------------------------------------------
# add_ticket
# ---------------------------------------------------------------------------

class TestAddTicket:
    def test_adds_to_memory(self, loaded_service):
        loaded_service.add_ticket("t1", "hello world")
        assert len(loaded_service._tickets) == 1
        assert loaded_service._tickets[0][0] == "t1"
        assert loaded_service._tickets[0][2] == "hello world"

    def test_persists_to_disk(self, loaded_service):
        loaded_service.add_ticket("t1", "hello world")
        with open(loaded_service.storage_file) as f:
            data = json.load(f)
        assert len(data) == 1
        assert data[0]["ticket_id"] == "t1"
        assert data[0]["text"] == "hello world"

    def test_multiple_tickets(self, loaded_service):
        loaded_service.add_ticket("t1", "first")
        loaded_service.add_ticket("t2", "second")
        assert len(loaded_service._tickets) == 2

    def test_skips_when_degraded(self, service):
        """When model is not available, add_ticket should skip embedding."""
        service._loaded = False
        service._load_failed = True
        service.add_ticket("t1", "text")
        assert len(service._tickets) == 0


# ---------------------------------------------------------------------------
# check_duplicate
# ---------------------------------------------------------------------------

class TestCheckDuplicate:
    def test_no_tickets_returns_no_duplicate(self, loaded_service):
        result = loaded_service.check_duplicate("some text")
        assert result["is_duplicate"] is False
        assert result["duplicate_ticket_id"] is None
        assert result["similarity"] == 0.0

    def test_degraded_returns_no_duplicate(self, service):
        service._loaded = False
        service._load_failed = True
        # Add a ticket to ensure degraded mode skips matching, not just empty-list path
        service._tickets = [("t1", MagicMock(), "stored text")]
        result = service.check_duplicate("query text")
        assert result["is_duplicate"] is False
        assert result["duplicate_ticket_id"] is None

    def test_duplicate_detected_above_threshold(self, loaded_service):
        """When cosine similarity is above threshold, flag as duplicate."""
        import torch

        # Mock cos_sim to return high similarity
        with patch("backend.services.duplicate_service.util") as mock_util:
            mock_util.cos_sim.return_value.item.return_value = 0.95

            # Add a stored ticket
            loaded_service._tickets = [
                ("t1", MagicMock(), "my printer is broken"),
            ]

            result = loaded_service.check_duplicate("printer not working")
            assert result["is_duplicate"] is True
            assert result["duplicate_ticket_id"] == "t1"
            assert result["similarity"] == 0.95

    def test_no_duplicate_below_threshold(self, loaded_service):
        """When cosine similarity is below threshold, not a duplicate."""
        with patch("backend.services.duplicate_service.util") as mock_util:
            mock_util.cos_sim.return_value.item.return_value = 0.3

            loaded_service._tickets = [
                ("t1", MagicMock(), "my printer is broken"),
            ]

            result = loaded_service.check_duplicate("how do I reset my password")
            assert result["is_duplicate"] is False
            assert result["duplicate_ticket_id"] is None

    def test_custom_threshold(self, loaded_service):
        """Custom threshold overrides the default."""
        with patch("backend.services.duplicate_service.util") as mock_util:
            mock_util.cos_sim.return_value.item.return_value = 0.5

            loaded_service._tickets = [
                ("t1", MagicMock(), "text"),
            ]

            # Default threshold is 0.70, so 0.5 is not a duplicate
            result = loaded_service.check_duplicate("text")
            assert result["is_duplicate"] is False

            # With custom threshold of 0.4, 0.5 IS a duplicate
            result = loaded_service.check_duplicate("text", threshold=0.4)
            assert result["is_duplicate"] is True

    def test_returns_best_match(self, loaded_service):
        """When multiple stored tickets exist, returns the best match."""
        with patch("backend.services.duplicate_service.util") as mock_util:
            # First call returns 0.5, second returns 0.9
            mock_util.cos_sim.return_value.item.side_effect = [0.5, 0.9]

            loaded_service._tickets = [
                ("t1", MagicMock(), "unrelated"),
                ("t2", MagicMock(), "very similar"),
            ]

            result = loaded_service.check_duplicate("query")
            assert result["is_duplicate"] is True
            assert result["duplicate_ticket_id"] == "t2"
            assert result["similarity"] == 0.9


# ---------------------------------------------------------------------------
# save_to_disk
# ---------------------------------------------------------------------------

class TestSaveToDisk:
    def test_creates_new_file(self, loaded_service):
        loaded_service.save_to_disk("t1", "hello")
        with open(loaded_service.storage_file) as f:
            data = json.load(f)
        assert data == [{"ticket_id": "t1", "text": "hello"}]

    def test_appends_to_existing(self, loaded_service):
        loaded_service.save_to_disk("t1", "first")
        loaded_service.save_to_disk("t2", "second")
        with open(loaded_service.storage_file) as f:
            data = json.load(f)
        assert len(data) == 2
        assert data[1]["ticket_id"] == "t2"

    def test_handles_corrupt_json(self, loaded_service):
        """If the file contains invalid JSON, starts fresh."""
        with open(loaded_service.storage_file, "w") as f:
            f.write("not valid json{{{")
        loaded_service.save_to_disk("t1", "text")
        with open(loaded_service.storage_file) as f:
            data = json.load(f)
        assert data == [{"ticket_id": "t1", "text": "text"}]

    def test_handles_non_list_json(self, loaded_service):
        """If the file contains a JSON object instead of list, starts fresh."""
        with open(loaded_service.storage_file, "w") as f:
            json.dump({"not": "a list"}, f)
        loaded_service.save_to_disk("t1", "text")
        with open(loaded_service.storage_file) as f:
            data = json.load(f)
        assert data == [{"ticket_id": "t1", "text": "text"}]


# ---------------------------------------------------------------------------
# load
# ---------------------------------------------------------------------------

class TestLoad:
    def test_load_sets_loaded_flag(self, service, _no_model_imports):
        with patch("backend.services.duplicate_service.SentenceTransformer") as mock_st:
            mock_st.return_value = MagicMock()
            service.load()
            assert service._loaded is True
            assert service.model is not None

    def test_load_idempotent(self, service, _no_model_imports):
        with patch("backend.services.duplicate_service.SentenceTransformer") as mock_st:
            mock_st.return_value = MagicMock()
            service.load()
            service.load()
            mock_st.assert_called_once()

    def test_load_failure_sets_flag(self, service, _no_model_imports):
        with patch("backend.services.duplicate_service.SentenceTransformer") as mock_st:
            mock_st.side_effect = RuntimeError("no model")
            with pytest.raises(RuntimeError):
                service.load()
            assert service._load_failed is True

    def test_degraded_startup_on_failure(self, service, _no_model_imports, monkeypatch):
        monkeypatch.setenv("ALLOW_DEGRADED_STARTUP", "1")
        with patch("backend.services.duplicate_service.SentenceTransformer") as mock_st:
            mock_st.side_effect = RuntimeError("no model")
            service.load()
            assert service._load_failed is True
            assert service.model is None

    def test_loads_saved_tickets(self, service, _no_model_imports, tmp_path):
        # Write saved tickets
        cache_file = str(tmp_path / "case_history_cache.json")
        with open(cache_file, "w") as f:
            json.dump([
                {"ticket_id": "t1", "text": "old ticket"},
                {"ticket_id": "t2", "text": "another ticket"},
            ], f)

        service.storage_file = cache_file

        with patch("backend.services.duplicate_service.SentenceTransformer") as mock_st:
            mock_model = MagicMock()
            mock_st.return_value = mock_model
            service.load()

            assert len(service._tickets) == 2
            assert service._tickets[0][0] == "t1"
            assert service._tickets[1][0] == "t2"
