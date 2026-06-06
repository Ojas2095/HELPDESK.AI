import sys
from unittest.mock import MagicMock, patch
import torch
import pytest

# Mock sentence_transformers at module level
_mock_st = MagicMock()
_mock_model = MagicMock()

def _fake_encode(text, convert_to_tensor=False):
    import hashlib, torch
    seed = int(hashlib.md5(text.encode()).hexdigest()[:8], 16) % (2**31)
    torch.manual_seed(seed)
    return torch.nn.functional.normalize(torch.randn(1, 384), dim=1).squeeze(0)

_mock_model.encode.side_effect = _fake_encode
_mock_st.SentenceTransformer.return_value = _mock_model
_mock_st.util.pytorch_cos_sim = lambda a, b: torch.nn.functional.cosine_similarity(
    a.unsqueeze(0), b, dim=1
).unsqueeze(0)
sys.modules["sentence_transformers"] = _mock_st

@pytest.fixture
def dup_svc():
    from backend.services.duplicate_service import DuplicateService
    svc = DuplicateService()
    svc._loaded = True
    svc._load_failed = False
    svc.model = _mock_model
    return svc
