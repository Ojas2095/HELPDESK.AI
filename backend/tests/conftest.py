"""
conftest.py — pytest fixtures and mocks for HELPDESK.AI backend tests.

Mocks sentence_transformers at module level so tests run without GPU/model
download. Uses deterministic hash-seeded unit vectors for stable assertions.
"""

import sys
import threading
from unittest.mock import MagicMock

import pytest
import torch


# ── Mock sentence_transformers ────────────────────────────────────────────────
def _fake_encode(text, convert_to_tensor=False, **_kwargs):
    """Return a deterministic unit vector based on the text hash."""
    import hashlib
    seed = int(hashlib.md5(text.encode()).hexdigest()[:8], 16) % (2 ** 31)
    torch.manual_seed(seed)
    vec = torch.nn.functional.normalize(torch.randn(1, 384), dim=1).squeeze(0)
    return vec


def _fake_cos_sim(a, b_list):
    """Compute cosine similarity between tensor a and a list of tensors."""
    if not isinstance(b_list, torch.Tensor):
        b_list = torch.stack(b_list) if b_list else torch.empty(0, a.shape[-1])
    a_norm = torch.nn.functional.normalize(a.unsqueeze(0), dim=1)
    b_norm = torch.nn.functional.normalize(b_list, dim=1)
    return (a_norm @ b_norm.T)  # shape (1, N)


_mock_st = MagicMock()
_mock_model = MagicMock()
_mock_model.encode.side_effect = _fake_encode
_mock_st.SentenceTransformer.return_value = _mock_model
_mock_st.util.pytorch_cos_sim.side_effect = _fake_cos_sim
sys.modules["sentence_transformers"] = _mock_st


# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture
def dup_svc(tmp_path):
    """Return a ready DuplicateService with mocked model and temp storage."""
    # Force reimport with mocked sentence_transformers
    if "backend.services.duplicate_service" in sys.modules:
        del sys.modules["backend.services.duplicate_service"]

    from backend.services.duplicate_service import DuplicateService

    svc = DuplicateService()
    svc._loaded = True
    svc._load_failed = False
    svc.model = _mock_model
    svc.storage_file = str(tmp_path / "cache.json")
    return svc
