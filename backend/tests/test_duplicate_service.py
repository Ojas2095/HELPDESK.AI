import importlib
import sys
import types
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class _Score:
    def __init__(self, value):
        self._value = value

    def item(self):
        return self._value


class _FakeUtil:
    @staticmethod
    def cos_sim(left, right):
        left_tokens = set(str(left).lower().split())
        right_tokens = set(str(right).lower().split())
        if not left_tokens or not right_tokens:
            return _Score(0.0)
        return _Score(len(left_tokens & right_tokens) / len(left_tokens | right_tokens))


class _FakeSentenceTransformer:
    def __init__(self, *_args, **_kwargs):
        pass

    def encode(self, text, convert_to_tensor=True):
        return text


fake_sentence_transformers = types.ModuleType("sentence_transformers")
fake_sentence_transformers.SentenceTransformer = _FakeSentenceTransformer
fake_sentence_transformers.util = _FakeUtil
sys.modules.setdefault("sentence_transformers", fake_sentence_transformers)

duplicate_service = importlib.import_module("backend.services.duplicate_service")
DuplicateService = duplicate_service.DuplicateService


class DuplicateServiceCheckDuplicateTests(unittest.TestCase):
    def make_service(self):
        service = DuplicateService()
        service.storage_file = str(ROOT / "backend" / "data" / "test_case_history_cache.json")
        service._loaded = True
        service._load_failed = False
        service.model = _FakeSentenceTransformer()
        return service

    def test_returns_no_duplicate_when_no_tickets_are_indexed(self):
        service = self.make_service()

        result = service.check_duplicate("password reset fails")

        self.assertEqual(
            result,
            {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            },
        )

    def test_detects_best_duplicate_above_default_threshold(self):
        service = self.make_service()
        service._tickets = [
            ("ticket-low", "billing invoice request", "billing invoice request"),
            ("ticket-high", "password reset fails login", "password reset fails login"),
        ]

        result = service.check_duplicate("password reset fails login")

        self.assertTrue(result["is_duplicate"])
        self.assertEqual(result["duplicate_ticket_id"], "ticket-high")
        self.assertEqual(result["similarity"], 1.0)

    def test_threshold_override_can_suppress_lower_similarity_match(self):
        service = self.make_service()
        service._tickets = [
            ("ticket-1", "password reset fails login", "password reset fails login"),
        ]

        result = service.check_duplicate("password reset broken", threshold=0.95)

        self.assertFalse(result["is_duplicate"])
        self.assertIsNone(result["duplicate_ticket_id"])
        self.assertLess(result["similarity"], 0.95)

    def test_returns_no_duplicate_when_model_is_unavailable(self):
        service = DuplicateService()
        service._loaded = False
        service._load_failed = True

        result = service.check_duplicate("anything")

        self.assertFalse(result["is_duplicate"])
        self.assertIsNone(result["duplicate_ticket_id"])
        self.assertEqual(result["similarity"], 0.0)


if __name__ == "__main__":
    unittest.main()
