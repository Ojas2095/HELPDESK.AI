"""
Duplicate Detection Service
Uses sentence-transformers all-MiniLM-L6-v2 to detect similar tickets.

Thread-safety: all mutable state is guarded by a threading.Lock to prevent
TOCTOU race conditions in save_to_disk() and list mutation in add_ticket().
"""

import json
import os
import threading
import tempfile
from typing import Any
try:
    import numpy as np
except ImportError:
    np = None

try:
    import torch
    from sentence_transformers import SentenceTransformer, util
    _HAS_SENTENCE = True
except Exception:  # pragma: no cover - optional runtime dependency
    torch = None
    SentenceTransformer = None
    util = None
    _HAS_SENTENCE = False

SIMILARITY_THRESHOLD = 0.70


class DuplicateService:
    def __init__(self):
        self.model = None
        self._loaded = False
        self._load_failed = False
        # In-memory store: list of (ticket_id, embedding, text)
        self._tickets: list[tuple[str, object, str]] = []
        # Pre-computed embedding matrix for vectorized search
        self._embedding_matrix = None
        self._ticket_ids: list[str] = []
        self._embedding_matrix_dirty: bool = True
        self.storage_file = os.path.join(os.path.dirname(__file__), "..", "data", "case_history_cache.json")
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
        # Lock for thread-safe access to _tickets and storage_file
        self._lock = threading.Lock()

    def is_available(self) -> bool:
        """Check if the model is available for duplicate detection."""
        return self._loaded and not self._load_failed

    def _encode(self, text: str):
        """Encode text to an L2-normalized float32 numpy embedding."""
        if not self.model:
            return None
        emb = self.model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
        return emb.astype(np.float32, copy=False)

    def _rebuild_matrix(self):
        if self._tickets and np:
            self._embedding_matrix = np.vstack([emb for _, emb, _ in self._tickets])
        else:
            self._embedding_matrix = None

    def load(self):
        """Load the sentence-transformer model and saved tickets."""
        if self._loaded or self._load_failed:
            return

        print("[DuplicateService] Loading model...")
        if not _HAS_SENTENCE:
            allow_degraded = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") == "1"
            self._load_failed = True
            print("[DuplicateService] sentence-transformers not installed")
            if allow_degraded:
                print("[DuplicateService] DEGRADED: Continuing without model (ALLOW_DEGRADED_STARTUP=1)")
                self.model = None
                self._loaded = False
                return
            else:
                raise ImportError("sentence-transformers is required for DuplicateService")
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
                try:
                    with open(self.storage_file, "r") as f:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
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
                print("[DuplicateService] DEGRADED: Continuing without model (ALLOW_DEGRADED_STARTUP=1)")
                self.model = None
                self._loaded = False
            else:
                raise

    def save_to_disk(self, ticket_id: str, text: str):
        """Append a new ticket to the JSON storage atomically."""
        with self._lock:
            data = []
            try:
                os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
                if os.path.exists(self.storage_file):
                    with open(self.storage_file, "r") as f:
                        try:
                            data = json.load(f)
                            if not isinstance(data, list):
                                data = []
                        except (json.JSONDecodeError, ValueError):
                            data = []
                
                data.append({"ticket_id": ticket_id, "text": text})

                # Atomic write: write to temp file, then rename
                dir_name = os.path.dirname(self.storage_file)
                with tempfile.NamedTemporaryFile(
                    mode="w", dir=dir_name, suffix=".tmp", delete=False
                ) as tmp:
                    json.dump(data, tmp, indent=2)
                    tmp.flush()
                    os.fsync(tmp.fileno())
                    tmp_name = tmp.name

                os.replace(tmp_name, self.storage_file)
                print(f"[DuplicateService] Indexed ticket {ticket_id} to case history.")
            except Exception as e:
                print(f"[DuplicateService] Failed to save to disk: {e}")
                # Clean up temp file if rename failed
                try:
                    if 'tmp_name' in locals() and os.path.exists(tmp_name):
                        os.unlink(tmp_name)
                except OSError:
                    pass

    def add_ticket(self, ticket_id: str, text: str):
        """Add a ticket to the in-memory store and persist to disk."""
        self.load()
        if not self.is_available():
            print(f"[DuplicateService] DEGRADED: Skipping embedding for ticket {ticket_id} (model not available)")
            return
        embedding = self.model.encode(text, convert_to_tensor=True)
        with self._lock:
            self._tickets.append((ticket_id, embedding, text))
        self.save_to_disk(ticket_id, text)

    def generate_embedding(self, text: str) -> list[float] | None:
        """Generate a 384-d embedding for the provided ticket text."""
        from backend.services.redis_cache import redis_cache

        cached = redis_cache.get_embedding(text)
        if cached is not None:
            return cached

        self.load()
        if not self.is_available():
            return None

        embedding = self.model.encode(text, convert_to_tensor=False, normalize_embeddings=True)
        values = [float(value) for value in embedding.tolist()]
        redis_cache.set_embedding(text, values)
        return values

    def check_duplicate(self, text: str, threshold: float = None) -> dict:
        """Check if a ticket is a duplicate of any stored ticket."""
        self.load()
        
        if not self.is_available():
            return {"is_duplicate": False, "duplicate_ticket_id": None, "similarity": 0.0}
        
        active_threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD

        with self._lock:
            tickets_snapshot = list(self._tickets)

        if not tickets_snapshot:
            return {"is_duplicate": False, "duplicate_ticket_id": None, "similarity": 0.0}

        query_embedding = self.model.encode(text, convert_to_tensor=True)

        # Compute cosine similarity between query and all stored embeddings
        embeddings = [stored_emb for _, stored_emb, _ in tickets_snapshot]
        stacked_embeddings = torch.stack(embeddings)
        similarity_matrix = util.cos_sim(query_embedding, stacked_embeddings)

        best_score_tensor, best_index_tensor = torch.max(similarity_matrix, dim=1)
        best_score = best_score_tensor.item()
        best_index = best_index_tensor.item()
        best_id = tickets_snapshot[best_index][0]

        is_dup = best_score >= active_threshold

        return {
            "is_duplicate": is_dup,
            "duplicate_ticket_id": best_id if is_dup else None,
            "similarity": round(best_score, 4),
        }
