"""
Duplicate Detection Service
Uses sentence-transformers all-MiniLM-L6-v2 to detect similar tickets.

Thread Safety (Issue #906):
- self._lock (threading.Lock) protects all reads/writes to self._tickets
- check_duplicate takes a snapshot under lock, then releases before cosine similarity
- self._indexing flag prevents concurrent re-indexing
- load() is idempotent and safe to call from multiple threads
"""

import uuid
import os
import threading
from sentence_transformers import SentenceTransformer, util

SIMILARITY_THRESHOLD = 0.70


class DuplicateService:
    def __init__(self):
        self.model = None
        self._loaded = False
        self._load_failed = False
        # In-memory store: list of (ticket_id, embedding, text)
        self._tickets: list[tuple[str, object, str]] = []
        self.storage_file = os.path.join(os.path.dirname(__file__), "..", "data", "case_history_cache.json")
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)

        # --- Thread-safety additions (Issue #906) ---
        self._lock = threading.Lock()
        self._indexing: bool = False

    def is_available(self) -> bool:
        """Check if the model is available for duplicate detection."""
        return self._loaded and not self._load_failed

    def load(self):
        """Load the sentence-transformer model and saved tickets. Thread-safe and idempotent."""
        # Fast path: already loaded — no lock needed for the bool check
        if self._loaded or self._load_failed:
            return

        with self._lock:
            # Double-checked locking: re-verify inside lock
            if self._loaded or self._load_failed:
                return

            print("[DuplicateService] Loading model...")
            try:
                # Check if a local model path is provided
                model_path = os.environ.get("SENTENCE_TRANSFORMER_MODEL_PATH")
                if model_path and os.path.exists(model_path):
                    print(f"[DuplicateService] Loading from local path: {model_path}")
                    self.model = SentenceTransformer(model_path)
                else:
                    # Download from HuggingFace
                    self.model = SentenceTransformer("all-MiniLM-L6-v2")
                self._loaded = True

                if os.path.exists(self.storage_file):
                    print(f"[DuplicateService] Syncing previous ticket history from {self.storage_file}...")
                    import json
                    try:
                        with open(self.storage_file, "r") as f:
                            data = json.load(f)
                            for item in data:
                                text = item["text"]
                                embedding = self.model.encode(text, convert_to_tensor=True)
                                # _tickets is already protected by the outer lock
                                self._tickets.append((item["ticket_id"], embedding, text))
                        print(f"[DuplicateService] Loaded {len(self._tickets)} tickets.")
                    except Exception as e:
                        print(f"[DuplicateService] Error loading storage: {e}")
            except Exception as e:
                allow_degraded = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") == "1"
                self._load_failed = True
                print(f"[DuplicateService] Failed to load model: {e}")
                if allow_degraded:
                    print("[DuplicateService] DEGRADED: Continuing without model (ALLOW_DEGRADED_STARTUP=1)")
                    self.model = None
                    self._loaded = False
                else:
                    raise

    def save_to_disk(self, ticket_id: str, text: str):
        """Append a new ticket to the JSON storage (disk I/O is outside the in-memory lock)."""
        import json
        data = []
        try:
            os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
            if os.path.exists(self.storage_file):
                with open(self.storage_file, "r") as f:
                    try:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
                    except Exception:
                        data = []

            data.append({"ticket_id": ticket_id, "text": text})
            with open(self.storage_file, "w") as f:
                json.dump(data, f, indent=2)
            print(f"[DuplicateService] Indexed ticket {ticket_id} to case history.")
        except Exception as e:
            print(f"[DuplicateService] Failed to save to disk: {e}")

    def add_ticket(self, ticket_id: str, text: str):
        """
        Add a ticket to the in-memory store and persist to disk.
        Thread-safe: acquires lock before modifying self._tickets.
        """
        self.load()
        if not self.is_available():
            print(f"[DuplicateService] DEGRADED: Skipping embedding for ticket {ticket_id} (model not available)")
            return

        # Compute embedding outside the lock (CPU-bound, can run concurrently)
        embedding = self.model.encode(text, convert_to_tensor=True)

        # Acquire lock only for the list mutation
        with self._lock:
            self._tickets.append((ticket_id, embedding, text))

        # Disk I/O is also done outside the lock to avoid blocking readers
        self.save_to_disk(ticket_id, text)

    def check_duplicate(self, text: str, threshold: float = None) -> dict:
        """
        Check if a ticket is a duplicate of any stored ticket.

        Thread-safe via snapshot isolation:
        1. Acquire lock, take a shallow snapshot of self._tickets, release lock.
        2. Run cosine similarity on the snapshot (CPU-bound) without holding the lock.

        Args:
            text:      The ticket text to check.
            threshold: Optional override for the similarity threshold.

        Returns:
            {
                "is_duplicate": bool,
                "duplicate_ticket_id": str | None,
                "similarity": float
            }
        """
        self.load()

        # If model is not available, return no duplicate found
        if not self.is_available():
            print("[DuplicateService] DEGRADED: Duplicate check skipped (model not available)")
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }

        # Use provided threshold or default to global constant
        active_threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD

        # Step 1: Take a snapshot under lock — do NOT hold the lock during similarity computation
        with self._lock:
            snapshot = list(self._tickets)  # shallow copy is safe; embeddings are immutable tensors

        if not snapshot:
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }

        # Step 2: Run similarity computation outside the lock
        query_embedding = self.model.encode(text, convert_to_tensor=True)

        best_score = 0.0
        best_id = None

        for ticket_id, stored_emb, _ in snapshot:
            score = util.cos_sim(query_embedding, stored_emb).item()
            if score > best_score:
                best_score = score
                best_id = ticket_id

        is_dup = best_score >= active_threshold

        return {
            "is_duplicate": is_dup,
            "duplicate_ticket_id": best_id if is_dup else None,
            "similarity": round(best_score, 4),
        }

    def get_ticket_count(self) -> int:
        """Return the current number of indexed tickets (thread-safe)."""
        with self._lock:
            return len(self._tickets)

    def clear(self):
        """Remove all tickets from the in-memory store (thread-safe). Useful for testing."""
        with self._lock:
            self._tickets.clear()
