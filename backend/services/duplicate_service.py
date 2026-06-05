"""
Duplicate Detection Service
Uses sentence-transformers all-MiniLM-L6-v2 to detect similar tickets.
"""

import json
import os
import tempfile
import threading
import uuid

from sentence_transformers import SentenceTransformer, util

SIMILARITY_THRESHOLD = 0.70


class DuplicateService:
    def __init__(self):
        self.model = None
        self._loaded = False
        self._load_failed = False
        # In-memory store: list of (ticket_id, embedding, text)
        self._tickets: list[tuple[str, object, str]] = []
        # Thread-safety: guards _tickets list and save_to_disk (Bug 3 fix)
        self._lock = threading.Lock()
        # File-level lock for atomic JSON writes (Bug 2 fix)
        self._file_lock = threading.Lock()
        self.storage_file = os.path.join(
            os.path.dirname(__file__), "..", "data", "case_history_cache.json"
        )
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)

    def is_available(self) -> bool:
        """Check if the model is available for duplicate detection."""
        return self._loaded and not self._load_failed

    def load(self):
        """Load the sentence-transformer model and saved tickets."""
        if self._loaded or self._load_failed:
            return

        print("[DuplicateService] Loading model...")
        try:
            model_path = os.environ.get("SENTENCE_TRANSFORMER_MODEL_PATH")
            if model_path and os.path.exists(model_path):
                print(f"[DuplicateService] Loading from local path: {model_path}")
                self.model = SentenceTransformer(model_path)
            else:
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
            self._loaded = True

            if os.path.exists(self.storage_file):
                print(
                    f"[DuplicateService] Syncing previous ticket history "
                    f"from {self.storage_file}..."
                )
                try:
                    with open(self.storage_file, "r") as f:
                        data = json.load(f)
                    for item in data:
                        text = item["text"]
                        embedding = self.model.encode(text, convert_to_tensor=True)
                        self._tickets.append((item["ticket_id"], embedding, text))
                    print(f"[DuplicateService] Loaded {len(self._tickets)} tickets.")
                except Exception as e:
                    print(f"[DuplicateService] Error loading storage: {e}")
        except Exception as e:
            allow_degraded = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") == "1"
            self._load_failed = True
            print(f"[DuplicateService] Failed to load model: {e}")
            if allow_degraded:
                print(
                    "[DuplicateService] DEGRADED: Continuing without model "
                    "(ALLOW_DEGRADED_STARTUP=1)"
                )
                self.model = None
                self._loaded = False
            else:
                raise

    def save_to_disk(self, ticket_id: str, text: str):
        """Append a new ticket to the JSON storage using an atomic write.

        Bug 2 fix: concurrent workers previously held the file open for
        json.load + json.dump simultaneously, producing torn writes and
        JSONDecodeError on the next startup.  We now:
          1. Hold a file-level threading.Lock so only one writer at a time.
          2. Write to a temp file in the same directory, then os.replace()
             (atomic on POSIX; near-atomic on Windows) to swap it in.
        """
        with self._file_lock:
            data: list = []
            if os.path.exists(self.storage_file):
                try:
                    with open(self.storage_file, "r") as f:
                        loaded = json.load(f)
                    if isinstance(loaded, list):
                        data = loaded
                except (json.JSONDecodeError, OSError):
                    data = []

            data.append({"ticket_id": ticket_id, "text": text})

            dir_path = os.path.dirname(self.storage_file)
            tmp_fd, tmp_path = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
            try:
                with os.fdopen(tmp_fd, "w") as tf:
                    json.dump(data, tf, indent=2)
                os.replace(tmp_path, self.storage_file)  # atomic swap
                print(f"[DuplicateService] Indexed ticket {ticket_id} to case history.")
            except Exception as e:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                print(f"[DuplicateService] Failed to save to disk: {e}")
                raise

    def add_ticket(self, ticket_id: str, text: str):
        """Add a ticket to the in-memory store and persist to disk.

        Bug 3 fix: _tickets is mutated under self._lock so concurrent
        check_duplicate() calls get a stable snapshot.
        """
        if not self.is_available():
            return
        embedding = self.model.encode(text, convert_to_tensor=True)
        with self._lock:
            self._tickets.append((ticket_id, embedding, text))
        self.save_to_disk(ticket_id, text)

    def check_duplicate(
        self, text: str, threshold: float = SIMILARITY_THRESHOLD
    ) -> dict | None:
        """Check if text is a duplicate of a stored ticket.

        Bug 1 fix: guard against empty _tickets before calling torch.stack().
        Previously an empty list caused RuntimeError crashing the FastAPI worker.

        Bug 3 fix: snapshot _tickets under self._lock so a concurrent
        add_ticket() cannot mutate the list while torch.stack() is iterating.

        Returns:
            dict with duplicate_ticket_id, similarity_score, original_text
            or None if no duplicate found / service unavailable.
        """
        if not self.is_available():
            return None

        new_emb = self.model.encode(text, convert_to_tensor=True)

        with self._lock:
            if not self._tickets:          # Bug 1 fix: empty-store guard
                return None
            tickets_snapshot = list(self._tickets)

        embeddings = [emb for _, emb, _ in tickets_snapshot]
        stacked = util.pytorch_cos_sim(new_emb, embeddings)

        best_idx = int(stacked.argmax())
        best_score = float(stacked[0][best_idx])

        if best_score >= threshold:
            ticket_id, _, original_text = tickets_snapshot[best_idx]
            return {
                "duplicate_ticket_id": ticket_id,
                "similarity_score": round(best_score, 4),
                "original_text": original_text,
            }
        return None


# Module-level singleton used by main.py
duplicate_service = DuplicateService()
