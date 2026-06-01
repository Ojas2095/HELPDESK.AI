import importlib
import sys
import types
from types import SimpleNamespace
from unittest.mock import Mock

import pytest


@pytest.fixture(autouse=True)
def mock_ai_services():
    yield
    sys.modules.pop("backend.services.rag_service", None)


class EncodedVector:
    def __init__(self, values):
        self._values = values

    def tolist(self):
        return list(self._values)


def import_rag_service(monkeypatch, *, supabase_client=None, transformer_factory=None):
    sys.modules.pop("backend.services.rag_service", None)

    if supabase_client is None:
        supabase_client = Mock(name="supabase_client")
    if transformer_factory is None:
        transformer_factory = Mock(return_value=Mock(name="sentence_model"))

    sentence_module = types.ModuleType("sentence_transformers")
    sentence_module.SentenceTransformer = transformer_factory
    monkeypatch.setitem(sys.modules, "sentence_transformers", sentence_module)

    supabase_module = types.ModuleType("supabase")
    supabase_module.Client = object
    supabase_module.create_client = Mock(return_value=supabase_client)
    monkeypatch.setitem(sys.modules, "supabase", supabase_module)

    dotenv_module = types.ModuleType("dotenv")
    dotenv_module.load_dotenv = Mock()
    monkeypatch.setitem(sys.modules, "dotenv", dotenv_module)

    module = importlib.import_module("backend.services.rag_service")
    return module, transformer_factory, supabase_module.create_client, dotenv_module.load_dotenv


def test_init_creates_supabase_client_when_credentials_are_configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "service-key")
    supabase_client = Mock(name="client")
    module, _, create_client, load_dotenv = import_rag_service(
        monkeypatch,
        supabase_client=supabase_client,
    )

    service = module.RagService()

    load_dotenv.assert_called_once_with()
    create_client.assert_called_once_with("https://example.supabase.co", "service-key")
    assert service.supabase is supabase_client
    assert service.model is None
    assert service.is_available() is False


def test_init_leaves_supabase_unconfigured_when_credentials_are_missing(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    module, _, create_client, _ = import_rag_service(monkeypatch)

    service = module.RagService()

    create_client.assert_not_called()
    assert service.supabase is None


def test_is_available_requires_loaded_model_without_previous_load_failure(monkeypatch):
    module, _, _, _ = import_rag_service(monkeypatch)
    service = module.RagService()

    service._loaded = True
    service._load_failed = False
    assert service.is_available() is True

    service._load_failed = True
    assert service.is_available() is False


def test_load_uses_default_sentence_transformer_when_no_local_path_is_configured(monkeypatch):
    monkeypatch.delenv("SENTENCE_TRANSFORMER_MODEL_PATH", raising=False)
    model = Mock(name="model")
    transformer_factory = Mock(return_value=model)
    module, transformer_factory, _, _ = import_rag_service(
        monkeypatch,
        transformer_factory=transformer_factory,
    )
    service = module.RagService()

    service.load()

    transformer_factory.assert_called_once_with("all-MiniLM-L6-v2")
    assert service.model is model
    assert service.is_available() is True


def test_load_prefers_existing_local_sentence_transformer_path(monkeypatch, tmp_path):
    model_dir = tmp_path / "model"
    model_dir.mkdir()
    monkeypatch.setenv("SENTENCE_TRANSFORMER_MODEL_PATH", str(model_dir))
    model = Mock(name="local_model")
    transformer_factory = Mock(return_value=model)
    module, transformer_factory, _, _ = import_rag_service(
        monkeypatch,
        transformer_factory=transformer_factory,
    )
    service = module.RagService()

    service.load()

    transformer_factory.assert_called_once_with(str(model_dir))
    assert service.model is model
    assert service.is_available() is True


def test_load_is_idempotent_after_model_is_loaded(monkeypatch):
    model = Mock(name="model")
    transformer_factory = Mock(return_value=model)
    module, transformer_factory, _, _ = import_rag_service(
        monkeypatch,
        transformer_factory=transformer_factory,
    )
    service = module.RagService()

    service.load()
    service.load()

    transformer_factory.assert_called_once_with("all-MiniLM-L6-v2")
    assert service.model is model


def test_load_degrades_without_sentence_transformers_when_allowed(monkeypatch):
    monkeypatch.setenv("ALLOW_DEGRADED_STARTUP", "1")
    transformer_factory = Mock()
    module, transformer_factory, _, _ = import_rag_service(
        monkeypatch,
        transformer_factory=transformer_factory,
    )
    monkeypatch.setattr(module, "_HAS_SENTENCE", False)
    monkeypatch.setattr(module, "SentenceTransformer", None)
    service = module.RagService()

    service.load()

    transformer_factory.assert_not_called()
    assert service.model is None
    assert service._loaded is False
    assert service._load_failed is True
    assert service.is_available() is False


def test_load_raises_without_sentence_transformers_when_degraded_startup_is_disabled(monkeypatch):
    monkeypatch.delenv("ALLOW_DEGRADED_STARTUP", raising=False)
    module, _, _, _ = import_rag_service(monkeypatch)
    monkeypatch.setattr(module, "_HAS_SENTENCE", False)
    monkeypatch.setattr(module, "SentenceTransformer", None)
    service = module.RagService()

    with pytest.raises(ImportError, match="sentence-transformers is required"):
        service.load()

    assert service._load_failed is True
    assert service.is_available() is False


def test_search_knowledge_base_returns_none_when_model_or_supabase_is_unavailable(monkeypatch):
    module, _, _, _ = import_rag_service(monkeypatch)
    service = module.RagService()
    model = Mock()
    service.model = model
    service._loaded = False

    assert service.search_knowledge_base("reset password") is None
    model.encode.assert_not_called()

    service._loaded = True
    service.supabase = None
    assert service.search_knowledge_base("reset password") is None
    model.encode.assert_not_called()


def test_search_knowledge_base_returns_first_matching_article(monkeypatch):
    module, _, _, _ = import_rag_service(monkeypatch)
    service = module.RagService()
    service._loaded = True
    service.model = Mock()
    service.model.encode.return_value = EncodedVector([0.1, 0.2, 0.3])

    rpc_call = Mock()
    rpc_call.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "article-1",
                "title": "Reset Password",
                "content": "Use the forgot password flow.",
                "similarity": 0.94,
            },
            {
                "id": "article-2",
                "title": "Other",
                "content": "Lower-ranked article",
                "similarity": 0.88,
            },
        ]
    )
    service.supabase = Mock()
    service.supabase.rpc.return_value = rpc_call

    result = service.search_knowledge_base(
        "How do I reset my password?",
        threshold=0.7,
        match_count=3,
    )

    service.model.encode.assert_called_once_with("How do I reset my password?")
    service.supabase.rpc.assert_called_once_with(
        "match_articles",
        {
            "query_embedding": [0.1, 0.2, 0.3],
            "match_threshold": 0.7,
            "match_count": 3,
        },
    )
    assert result == {
        "id": "article-1",
        "title": "Reset Password",
        "content": "Use the forgot password flow.",
        "similarity": 0.94,
    }


def test_search_knowledge_base_returns_none_when_no_matches_are_found(monkeypatch):
    module, _, _, _ = import_rag_service(monkeypatch)
    service = module.RagService()
    service._loaded = True
    service.model = Mock()
    service.model.encode.return_value = EncodedVector([0.5])
    rpc_call = Mock()
    rpc_call.execute.return_value = SimpleNamespace(data=[])
    service.supabase = Mock()
    service.supabase.rpc.return_value = rpc_call

    assert service.search_knowledge_base("unknown question") is None


def test_search_knowledge_base_handles_embedding_or_rpc_errors(monkeypatch):
    module, _, _, _ = import_rag_service(monkeypatch)
    service = module.RagService()
    service._loaded = True
    service.model = Mock()
    service.model.encode.side_effect = RuntimeError("embedding failed")
    service.supabase = Mock()

    assert service.search_knowledge_base("broken") is None
    service.supabase.rpc.assert_not_called()

    service.model.encode.side_effect = None
    service.model.encode.return_value = EncodedVector([0.9])
    service.supabase.rpc.side_effect = RuntimeError("rpc failed")

    assert service.search_knowledge_base("rpc failure") is None
