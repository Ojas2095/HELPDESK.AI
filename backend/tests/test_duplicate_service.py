"""
Unit tests for DuplicateService in backend/services/duplicate_service.py.

Tests the duplicate detection service with proper mocking of PyTorch
and sentence-transformers to match the vectorized implementation.
"""

import sys
import os
import json
import uuid
from unittest.mock import MagicMock, patch, PropertyMock


# ============================================================
# Setup mocks BEFORE importing the service
# ============================================================

# Mock torch
_mock_torch = MagicMock()
_mock_torch.cuda = MagicMock()
_mock_torch.cuda.is_available.return_value = False
_mock_torch.device.return_value = "cpu"
_mock_torch.no_grad = MagicMock()
_mock_torch.no_grad.return_value.__enter__ = MagicMock(return_value=None)
_mock_torch.no_grad.return_value.__exit__ = MagicMock(return_value=None)
_mock_torch.stack.return_value = MagicMock(name="stacked_embeddings")

# Mock torch.max to return the similarity matrix and index 0
_mock_max_result = MagicMock(name="max_result")
_mock_max_result.item.return_value = 0

_mock_torch.max.side_effect = (
    lambda sim, dim: (sim, MagicMock(item=MagicMock(return_value=0)))
)

sys.modules["torch"] = _mock_torch
sys.modules["torch.nn"] = MagicMock()
sys.modules["torch.nn.functional"] = MagicMock()

# Mock sentence_transformers
_mock_st = MagicMock()
_mock_st_model = MagicMock()

# Default encode returns a MagicMock tensor
_default_tensor = MagicMock(name="default_embedding_tensor")
_mock_st_model.encode.return_value = _default_tensor

_mock_st.SentenceTransformer.return_value = _mock_st_model

# cos_sim default: returns a MagicMock with .item() -> 0.0
_default_sim = MagicMock(name="default_sim_tensor")
_default_sim.item.return_value = 0.0
_mock_st.util.cos_sim.return_value = _default_sim

sys.modules["sentence_transformers"] = _mock_st
sys.modules["sentence_transformers.util"] = MagicMock()

# Now we can import DuplicateService
from backend.services.duplicate_service import DuplicateService, SIMILARITY_THRESHOLD


# ============================================================
# Fixtures
# ============================================================

def create_service() -> DuplicateService:
    """Create a fresh DuplicateService with mocked storage."""
    svc = DuplicateService()
    svc.storage_file = "/tmp/test_case_history.json"
    # Clean up any existing storage
    if os.path.exists(svc.storage_file):
        os.remove(svc.storage_file)
    return svc


# ============================================================
# Initialization Tests
# ============================================================

class TestDuplicateServiceInit:
    """Test DuplicateService initialization."""

    def test_initial_state_not_loaded(self):
        svc = create_service()
        assert svc._loaded == False
        assert svc._load_failed == False
        assert svc.model is None

    def test_initial_tickets_empty(self):
        svc = create_service()
        assert svc._tickets == []

    def test_is_available_returns_false_before_load(self):
        svc = create_service()
        assert svc.is_available() == False

    def test_similarity_threshold_default(self):
        assert SIMILARITY_THRESHOLD == 0.70

    def test_storage_file_path_set(self):
        svc = create_service()
        assert svc.storage_file is not None
        assert "case_history_cache.json" in svc.storage_file


# ============================================================
# Load Tests
# ============================================================

class TestDuplicateServiceLoad:
    """Test DuplicateService.load() method."""

    def test_load_sets_loaded_flag(self):
        svc = create_service()
        # Mock os.path.exists to return True for model files
        with patch("os.path.exists", return_value=True):
            with patch("builtins.open", MagicMock()):
                svc.load()
        assert svc._loaded == True

    def test_load_does_not_reload_if_already_loaded(self):
        svc = create_service()
        svc._loaded = True
        call_count_before = _mock_st.SentenceTransformer.call_count
        svc.load()
        # Should not call SentenceTransformer again
        assert _mock_st.SentenceTransformer.call_count == call_count_before

    def test_is_available_after_successful_load(self):
        svc = create_service()
        svc._loaded = True
        assert svc.is_available() == True

    def test_is_available_false_after_load_failure(self):
        svc = create_service()
        svc._load_failed = True
        assert svc.is_available() == False


# ============================================================
# check_duplicate Tests
# ============================================================

class TestCheckDuplicateEmpty:
    """Test check_duplicate with empty ticket store."""

    def test_no_tickets_returns_not_duplicate(self):
        svc = create_service()
        svc._loaded = True
        result = svc.check_duplicate("Test ticket text")
        assert result["is_duplicate"] == False
        assert result["duplicate_ticket_id"] is None
        assert result["similarity"] == 0.0

    def test_not_available_returns_not_duplicate(self):
        svc = create_service()
        result = svc.check_duplicate("Test ticket text")
        assert result["is_duplicate"] == False
        assert result["duplicate_ticket_id"] is None


class TestCheckDuplicateWithTickets:
    """Test check_duplicate with tickets in the store."""

    def test_exact_duplicate_detected(self):
        svc = create_service()
        svc._loaded = True

        # Create a mock tensor for the stored ticket
        stored_tensor = MagicMock(name="stored_tensor")

        # Add ticket directly to internal list
        svc._tickets = [("TICKET-001", stored_tensor, "Password reset not working")]

        # Mock cos_sim to return high similarity
        high_sim = MagicMock(name="high_sim_tensor")
        high_sim.item.return_value = 0.95
        _mock_st.util.cos_sim.return_value = high_sim

        result = svc.check_duplicate("Password reset not working")

        assert result["is_duplicate"] == True
        assert result["duplicate_ticket_id"] == "TICKET-001"
        assert result["similarity"] == 0.95

    def test_dissimilar_ticket_not_duplicate(self):
        svc = create_service()
        svc._loaded = True

        stored_tensor = MagicMock(name="stored_tensor")
        svc._tickets = [("TICKET-001", stored_tensor, "Password reset not working")]

        low_sim = MagicMock(name="low_sim_tensor")
        low_sim.item.return_value = 0.30
        _mock_st.util.cos_sim.return_value = low_sim

        result = svc.check_duplicate("Network connectivity issue")

        assert result["is_duplicate"] == False
        assert result["duplicate_ticket_id"] is None
        assert result["similarity"] == 0.30

    def test_picks_best_match_among_multiple_tickets(self):
        """The real impl does vectorized cos_sim against all tickets at once.
        We mock cos_sim to return a tensor where .max() picks index 1 (score 0.95)."""
        svc = create_service()
        svc._loaded = True

        t1 = MagicMock(name="tensor_t1")
        t2 = MagicMock(name="tensor_t2")
        t3 = MagicMock(name="tensor_t3")

        svc._tickets = [
            ("T-001", t1, "Password reset"),
            ("T-002", t2, "Network timeout issue"),
            ("T-003", t3, "Login page not loading"),
        ]

        # Build a similarity matrix mock where max() picks index 1
        sim_matrix = MagicMock(name="sim_matrix")

        # torch.max is already mocked to return (sim, MagicMock(item=...))
        # Let's set the max item to return index 1
        _mock_torch.max.reset_mock()

        # The item() return determines which ticket index is selected
        _mock_torch.max.side_effect = (
            lambda sim, dim: (sim, MagicMock(item=MagicMock(return_value=1)))
        )

        # The similarity value should be high enough
        high_sim = MagicMock(name="high_sim")
        high_sim.item.return_value = 0.95
        _mock_st.util.cos_sim.return_value = high_sim

        result = svc.check_duplicate("Network timeout issue")

        assert result["is_duplicate"] == True
        assert result["duplicate_ticket_id"] == "T-002"

    def test_similarity_at_threshold_boundary(self):
        """Similarity exactly at threshold should be duplicate."""
        svc = create_service()
        svc._loaded = True

        stored_tensor = MagicMock(name="stored_tensor")
        svc._tickets = [("T-001", stored_tensor, "Test")]

        threshold_sim = MagicMock(name="threshold_sim")
        threshold_sim.item.return_value = SIMILARITY_THRESHOLD
        _mock_st.util.cos_sim.return_value = threshold_sim

        result = svc.check_duplicate("Test")
        assert result["is_duplicate"] == True

    def test_similarity_just_below_threshold(self):
        svc = create_service()
        svc._loaded = True

        stored_tensor = MagicMock(name="stored_tensor")
        svc._tickets = [("T-001", stored_tensor, "Test")]

        below_sim = MagicMock(name="below_sim")
        below_sim.item.return_value = SIMILARITY_THRESHOLD - 0.01
        _mock_st.util.cos_sim.return_value = below_sim

        result = svc.check_duplicate("Test")
        assert result["is_duplicate"] == False

    def test_custom_threshold_override(self):
        svc = create_service()
        svc._loaded = True

        stored_tensor = MagicMock(name="stored_tensor")
        svc._tickets = [("T-001", stored_tensor, "Test")]

        mid_sim = MagicMock(name="mid_sim")
        mid_sim.item.return_value = 0.60
        _mock_st.util.cos_sim.return_value = mid_sim

        # Use lower custom threshold
        result = svc.check_duplicate("Test", threshold=0.50)
        assert result["is_duplicate"] == True

        # Same similarity should NOT be duplicate at default threshold
        result = svc.check_duplicate("Test", threshold=0.70)
        assert result["is_duplicate"] == False


# ============================================================
# add_ticket Tests
# ============================================================

class TestAddTicket:
    """Test add_ticket method."""

    def test_add_ticket_stores_in_memory(self):
        svc = create_service()
        svc._loaded = True

        svc.add_ticket("T-NEW", "New ticket text")
        assert len(svc._tickets) == 1
        assert svc._tickets[0][0] == "T-NEW"
        assert svc._tickets[0][2] == "New ticket text"

    def test_add_ticket_not_available_skips(self):
        svc = create_service()
        # Not loaded
        svc.add_ticket("T-NEW", "New ticket text")
        assert len(svc._tickets) == 0

    def test_add_multiple_tickets(self):
        svc = create_service()
        svc._loaded = True

        svc.add_ticket("T-1", "First ticket")
        svc.add_ticket("T-2", "Second ticket")
        svc.add_ticket("T-3", "Third ticket")

        assert len(svc._tickets) == 3
        ids = [t[0] for t in svc._tickets]
        assert ids == ["T-1", "T-2", "T-3"]

    def test_save_to_disk_called(self):
        svc = create_service()
        svc._loaded = True
        svc.storage_file = "/tmp/test_save_case_history.json"
        if os.path.exists(svc.storage_file):
            os.remove(svc.storage_file)

        svc.add_ticket("T-SAVE", "Save test")

        assert os.path.exists(svc.storage_file)
        with open(svc.storage_file, "r") as f:
            data = json.load(f)
        assert len(data) == 1
        assert data[0]["ticket_id"] == "T-SAVE"
        assert data[0]["text"] == "Save test"


# ============================================================
# check_duplicate result structure
# ============================================================

class TestCheckDuplicateResultStructure:
    """Test that check_duplicate returns correct structure."""

    def test_result_has_required_keys(self):
        svc = create_service()
        svc._loaded = True
        result = svc.check_duplicate("Test")
        assert "is_duplicate" in result
        assert "duplicate_ticket_id" in result
        assert "similarity" in result

    def test_result_types_correct(self):
        svc = create_service()
        svc._loaded = True
        result = svc.check_duplicate("Test")
        assert isinstance(result["is_duplicate"], bool)
        assert isinstance(result["similarity"], float)

    def test_non_duplicate_has_none_id(self):
        svc = create_service()
        svc._loaded = True
        result = svc.check_duplicate("Test")
        assert result["duplicate_ticket_id"] is None


# ============================================================
# Edge Cases
# ============================================================

class TestEdgeCases:
    """Edge case and robustness tests."""

    def test_empty_text_check(self):
        svc = create_service()
        svc._loaded = True
        result = svc.check_duplicate("")
        assert result["is_duplicate"] == False

    def test_very_long_text(self):
        svc = create_service()
        svc._loaded = True
        stored_tensor = MagicMock(name="stored_tensor")
        svc._tickets = [("T-001", stored_tensor, "short")]

        long_text = "ticket " * 1000
        low_sim = MagicMock(name="low_sim")
        low_sim.item.return_value = 0.10
        _mock_st.util.cos_sim.return_value = low_sim

        result = svc.check_duplicate(long_text)
        assert result["is_duplicate"] == False

    def test_unicode_text(self):
        svc = create_service()
        svc._loaded = True
        stored_tensor = MagicMock(name="stored_tensor")
        svc._tickets = [("T-001", stored_tensor, "パスワードリセット")]

        high_sim = MagicMock(name="high_sim")
        high_sim.item.return_value = 0.90
        _mock_st.util.cos_sim.return_value = high_sim

        result = svc.check_duplicate("パスワードリセット")
        assert result["is_duplicate"] == True

    def test_special_characters_in_text(self):
        svc = create_service()
        svc._loaded = True
        stored_tensor = MagicMock(name="stored_tensor")
        svc._tickets = [("T-001", stored_tensor, "Error: <script>alert('xss')</script>")]

        low_sim = MagicMock(name="low_sim")
        low_sim.item.return_value = 0.10
        _mock_st.util.cos_sim.return_value = low_sim

        result = svc.check_duplicate("Normal ticket")
        assert result["is_duplicate"] == False
