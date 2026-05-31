import pytest
from unittest.mock import MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import importlib.util

spec = importlib.util.spec_from_file_location(
    "rag_service",
    "/home/itsmaestro/gssoc/HELPDESK.AI/backend/services/rag_service.py"
)
rag_module = importlib.util.module_from_spec(spec)
sys.modules['backend.services.rag_service'] = rag_module
spec.loader.exec_module(rag_module)


class TestRagServiceInit:
    def test_init_sets_defaults(self):
        service = rag_module.RagService()
        assert service.model is None
        assert service._loaded is False
        assert service._load_failed is False


class TestRagServiceAvailability:
    def test_is_available_when_not_loaded(self):
        service = rag_module.RagService()
        assert service.is_available() is False

    def test_is_available_when_load_failed(self):
        service = rag_module.RagService()
        service._load_failed = True
        assert service.is_available() is False


class TestRagServiceLoad:
    def test_load_without_sentence_transformers(self):
        original_has_sentence = rag_module._HAS_SENTENCE
        rag_module._HAS_SENTENCE = False
        try:
            with patch.dict(os.environ, {"ALLOW_DEGRADED_STARTUP": "1"}):
                service = rag_module.RagService()
                service.load()
                assert service._load_failed is True
        finally:
            rag_module._HAS_SENTENCE = original_has_sentence

    def test_load_idempotent(self):
        service = rag_module.RagService()
        service._loaded = True
        service.load()
        assert service._loaded is True


class TestRagServiceSearchKnowledgeBase:
    def test_search_returns_none_when_not_loaded(self):
        service = rag_module.RagService()
        result = service.search_knowledge_base("test query")
        assert result is None

    def test_search_returns_none_when_load_failed(self):
        service = rag_module.RagService()
        service._load_failed = True
        result = service.search_knowledge_base("test query")
        assert result is None

    def test_search_returns_none_without_supabase(self):
        service = rag_module.RagService()
        service._loaded = True
        service.supabase = None
        result = service.search_knowledge_base("test query")
        assert result is None

    def test_search_with_mock_response(self):
        service = rag_module.RagService()
        service._loaded = True
        mock_supabase = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [
            {
                "id": 1,
                "title": "Test Article",
                "content": "Test content",
                "similarity": 0.95
            }
        ]
        mock_supabase.rpc.return_value.execute.return_value = mock_response
        service.supabase = mock_supabase
        service.model = MagicMock()
        service.model.encode.return_value = MagicMock(tolist=lambda: [0.1] * 384)
        result = service.search_knowledge_base("test query")
        assert result is not None
        assert result["title"] == "Test Article"
        assert result["content"] == "Test content"
        assert result["similarity"] == 0.95

    def test_search_with_no_matches(self):
        service = rag_module.RagService()
        service._loaded = True
        mock_supabase = MagicMock()
        mock_response = MagicMock()
        mock_response.data = []
        mock_supabase.rpc.return_value.execute.return_value = mock_response
        service.supabase = mock_supabase
        service.model = MagicMock()
        service.model.encode.return_value = MagicMock(tolist=lambda: [0.1] * 384)
        result = service.search_knowledge_base("test query")
        assert result is None
