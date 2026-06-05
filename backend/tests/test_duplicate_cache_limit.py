import json
import importlib.util
from pathlib import Path
from types import SimpleNamespace


_MODULE_PATH = Path(__file__).resolve().parents[1] / "services" / "duplicate_service.py"
_SPEC = importlib.util.spec_from_file_location("duplicate_service_cache_limit_under_test", _MODULE_PATH)
duplicate_module = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(duplicate_module)
DuplicateService = duplicate_module.DuplicateService


class _FakeEmbedding:
    def astype(self, *_args, **_kwargs):
        return self


class _FakeModel:
    def __init__(self):
        self.encoded_texts = []

    def encode(self, text, **_kwargs):
        self.encoded_texts.append(text)
        return _FakeEmbedding()


def test_save_to_disk_keeps_only_most_recent_cache_entries(tmp_path, monkeypatch):
    monkeypatch.setattr(duplicate_module, "MAX_CACHE_ENTRIES", 2)
    storage_file = tmp_path / "case_history_cache.json"
    storage_file.write_text(
        json.dumps(
            [
                {"ticket_id": "old-1", "text": "old one"},
                {"ticket_id": "old-2", "text": "old two"},
            ]
        )
    )

    service = DuplicateService()
    service.storage_file = str(storage_file)

    service.save_to_disk("new-3", "new three")

    saved = json.loads(storage_file.read_text())
    assert saved == [
        {"ticket_id": "old-2", "text": "old two"},
        {"ticket_id": "new-3", "text": "new three"},
    ]


def test_load_reencodes_only_most_recent_cache_entries(tmp_path, monkeypatch):
    monkeypatch.setattr(duplicate_module, "MAX_CACHE_ENTRIES", 2)
    monkeypatch.setattr(duplicate_module, "_HAS_SENTENCE", True)
    monkeypatch.setattr(duplicate_module, "np", SimpleNamespace(float32="float32"))

    fake_model = _FakeModel()
    monkeypatch.setattr(duplicate_module, "SentenceTransformer", lambda *_args, **_kwargs: fake_model)

    storage_file = tmp_path / "case_history_cache.json"
    storage_file.write_text(
        json.dumps(
            [
                {"ticket_id": "old-1", "text": "old one"},
                {"ticket_id": "old-2", "text": "old two"},
                {"ticket_id": "new-3", "text": "new three"},
            ]
        )
    )

    service = DuplicateService()
    service.storage_file = str(storage_file)

    service.load()

    assert fake_model.encoded_texts == ["old two", "new three"]
    assert [ticket_id for ticket_id, _embedding, _text in service._tickets] == ["old-2", "new-3"]
