"""
Unit tests for DuplicateService load method — local path, HuggingFace fallback,
ALLOW_DEGRADED_STARTUP, error recovery, and is_available.
"""

import os, sys, json
from unittest.mock import patch, MagicMock, mock_open

# ─── Mock sentence_transformers at module level ───────────────────
_sent_transformers = MagicMock()
_sent_transformers.SentenceTransformer = MagicMock()
_sent_transformers.util = MagicMock()
_sent_transformers.util.cos_sim = MagicMock(return_value=MagicMock(item=lambda: 0.95))
sys.modules["sentence_transformers"] = _sent_transformers
sys.modules["sentence_transformers.util"] = _sent_transformers.util

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services"))
from duplicate_service import DuplicateService, SIMILARITY_THRESHOLD
import duplicate_service as ds_module

import pytest


# ─── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def service():
    svc = DuplicateService()
    svc.model = None
    svc._loaded = False
    svc._load_failed = False
    svc._tickets = []
    return svc


# ─── Init & is_available Tests ───────────────────────────────────

class TestDuplicateInit:
    def test_init_defaults(self):
        svc = DuplicateService()
        assert svc.model is None
        assert svc._loaded is False
        assert svc._load_failed is False
        assert svc._tickets == []

    def test_is_available_false_initially(self, service):
        assert service.is_available() is False

    def test_is_available_true_when_loaded(self, service):
        service._loaded = True
        assert service.is_available() is True

    def test_is_available_false_on_load_fail(self, service):
        service._load_failed = True
        assert service.is_available() is False

    def test_similarity_threshold_constant(self):
        assert SIMILARITY_THRESHOLD == 0.70


# ─── load() Tests ─────────────────────────────────────────────────

class TestLoad:
    def test_load_skip_if_already_loaded(self, service):
        """load() is a no-op if already loaded or previously failed."""
        service._loaded = True
        service.load()  # Should not try to load again
        assert service._loaded is True

    def test_load_skip_if_previously_failed(self, service):
        """load() is a no-op if _load_failed is True."""
        service._load_failed = True
        service.load()  # Should not try again
        assert service._load_failed is True

    def test_load_from_local_path(self, service):
        """load() uses local model path when SENTENCE_TRANSFORMER_MODEL_PATH is set."""
        with patch.dict(os.environ, {"SENTENCE_TRANSFORMER_MODEL_PATH": "/tmp/local-model"}):
            with patch("os.path.exists", return_value=True):
                service.load()
                assert service._loaded is True
                assert service.model is not None

    def test_load_from_huggingface(self, service):
        """load() downloads from HuggingFace when no local path is set."""
        with patch.dict(os.environ, {}, clear=True):
            with patch("os.path.exists", return_value=False):
                _sent_transformers.SentenceTransformer.reset_mock()
                service.load()
                assert service._loaded is True
                _sent_transformers.SentenceTransformer.assert_called_with("all-MiniLM-L6-v2")

    def test_load_raises_on_failure_without_degraded(self, service):
        """load() raises on model failure when ALLOW_DEGRADED_STARTUP is not set."""
        _sent_transformers.SentenceTransformer.side_effect = Exception("Download failed")
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(Exception, match="Download failed"):
                service.load()
        _sent_transformers.SentenceTransformer.side_effect = None

    def test_load_degraded_startup(self, service):
        """load() sets _load_failed but does not raise when ALLOW_DEGRADED_STARTUP=1."""
        _sent_transformers.SentenceTransformer.side_effect = Exception("Download failed")
        with patch.dict(os.environ, {"ALLOW_DEGRADED_STARTUP": "1"}, clear=True):
            service.load()
            assert service._load_failed is True
            assert service._loaded is False
        _sent_transformers.SentenceTransformer.side_effect = None

    def test_load_recovery_after_failure(self, service):
        """After _load_failed=True, load() will not retry (skip guard)."""
        service._load_failed = True
        with patch("duplicate_service.SentenceTransformer") as mock_st:
            service.load()
            mock_st.assert_not_called()

    def test_load_creates_storage_dir(self, service):
        """Service creates storage dir on init (not during load)."""
        with patch("os.makedirs") as mock_makedirs:
            svc = DuplicateService()
            mock_makedirs.assert_called()


# ─── check_duplicate Tests ───────────────────────────────────────

class TestCheckDuplicate:
    def test_returns_no_duplicate_when_model_unavailable(self, service):
        """check_duplicate returns no duplicate when model failed to load."""
        service._load_failed = True  # Simulate model load failure
        result = service.check_duplicate("test text")
        assert result["is_duplicate"] is False
        assert result["duplicate_ticket_id"] is None
        assert result["similarity"] == 0.0

    def test_returns_no_duplicate_when_no_tickets_stored(self, service):
        service._loaded = True
        service.model = MagicMock()
        service.model.encode.return_value = "mock_emb"
        result = service.check_duplicate("test text")
        assert result["is_duplicate"] is False
        assert result["duplicate_ticket_id"] is None

    def test_detects_duplicate_above_threshold(self, service):
        service._loaded = True
        service.model = MagicMock()
        sv_emb = MagicMock()
        service._tickets = [("ticket-1", sv_emb, "original text")]
        with patch("duplicate_service.util.cos_sim", return_value=MagicMock(item=lambda: 0.95)):
            result = service.check_duplicate("similar text")
            assert result["is_duplicate"] is True
            assert result["duplicate_ticket_id"] == "ticket-1"
            assert result["similarity"] == 0.95

    def test_no_duplicate_below_threshold(self, service):
        service._loaded = True
        service.model = MagicMock()
        sv_emb = MagicMock()
        service._tickets = [("ticket-1", sv_emb, "different text")]
        with patch("duplicate_service.util.cos_sim", return_value=MagicMock(item=lambda: 0.30)):
            result = service.check_duplicate("very different text")
            assert result["is_duplicate"] is False
            assert result["duplicate_ticket_id"] is None
            assert result["similarity"] == 0.30

    def test_custom_threshold_override(self, service):
        service._loaded = True
        service.model = MagicMock()
        sv_emb = MagicMock()
        service._tickets = [("ticket-1", sv_emb, "some text")]
        # Similarity is 0.85, default threshold is 0.70, but custom threshold is 0.90
        with patch("duplicate_service.util.cos_sim", return_value=MagicMock(item=lambda: 0.85)):
            result = service.check_duplicate("text", threshold=0.90)
            assert result["is_duplicate"] is False


# ─── add_ticket Tests ─────────────────────────────────────────────

class TestAddTicket:
    def test_add_ticket_auto_loads(self, service):
        """add_ticket calls load() if model not yet loaded."""
        # Prevent storage file loading by setting _loaded before add_ticket
        service._loaded = True
        service.model = MagicMock()
        service.model.encode.return_value = "emb"
        with patch.object(service, "save_to_disk") as mock_save:
            service.add_ticket("t1", "test text")
            mock_save.assert_called_once_with("t1", "test text")
            assert len(service._tickets) == 1

    def test_add_ticket_degraded_if_unavailable(self, service):
        """add_ticket skips embedding when model is not available."""
        service._load_failed = True  # Simulate a previous failed load
        result = service.add_ticket("t1", "test text")
        assert service._tickets == []