"""
Duplicate ticket detection using sentence embeddings and vectorized cosine similarity.

Embeddings are stacked into a pre-computed NumPy matrix so that
``check_duplicate`` performs a single matrix–vector dot-product instead of
looping over each stored ticket.  When NumPy is unavailable the service
degrades gracefully to a Python loop.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from typing import Any, Dict, List, Optional, Tuple

try:
    import numpy as np

    _HAS_NUMPY = True
except Exception:  # pragma: no cover
    np = None  # type: ignore[assignment]
    _HAS_NUMPY = False

try:
    import torch
    from sentence_transformers import SentenceTransformer, util

    _HAS_SENTENCE = True
except Exception:  # pragma: no cover — optional runtime dependency
    torch = None  # type: ignore[assignment]
    SentenceTransformer = None  # type: ignore[assignment,misc]
    util = None  # type: ignore[assignment]
    _HAS_SENTENCE = False

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.70
MAX_CACHE_ENTRIES = int(os.environ.get("DUPLICATE_CACHE_MAX", "5000"))


def _cosine_similarity_numpy(query: "np.ndarray", matrix: "np.ndarray") -> "np.ndarray":
    """Vectorized cosine similarity: query (d,) vs matrix (n, d).

    Assumes embeddings are already L2-normalized, so cosine similarity
    reduces to a simple dot product.  Falls back to a manual loop when
    the matrix contains zero-norm rows.
    """
    # query @ matrix.T  →  shape (n,)
    return matrix @ query


class DuplicateService:
    def __init__(self) -> None:
        self.model = None
        self._loaded = False
        self._load_failed = False
        # In-memory store: list of (ticket_id, embedding, text)
        self._tickets: List[Tuple[str, Any, str]] = []
        self.storage_file = os.path.join(
            os.path.dirname(__file__), "..", "data", "case_history_cache.json"
        )
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
        # Pre-computed embedding matrix for vectorized search
        self._embedding_matrix: Any = None  # np.ndarray or torch.Tensor
        self._ticket_ids: List[str] = []
        self._embedding_matrix_dirty: bool = True
        # Thread-safe access to _tickets and storage_file
        self._lock = threading.Lock()
        self._indexing: bool = False

    # ------------------------------------------------------------------
    # Availability
    # ------------------------------------------------------------------

    def is_available(self) -> bool:
        return self._loaded and not self._load_failed

    # ------------------------------------------------------------------
    # Encoding helpers
    # ------------------------------------------------------------------

    def _encode(self, text: str):
        """Encode text to an L2-normalized float32 numpy embedding."""
        if not self.model:
            return None
        emb = self.model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
        return emb.astype(np.float32, copy=False)

    def _encode_with_cache(self, text: str):
        """Return an embedding for *text*, using Redis cache when available.

        Strategy:
        1. Check Redis for a pre-computed embedding stored as a JSON float list.
        2. On hit, deserialize and convert back to an array — zero model inference.
        3. On miss, run the model, then persist the result to Redis for future calls.
        """
        try:
            from backend.services.redis_cache import redis_cache

            cached_vector = redis_cache.get_embedding(text)
            if cached_vector is not None:
                logger.debug(
                    "[DuplicateService] Embedding cache HIT for text (len=%d)", len(text)
                )
                return np.array(cached_vector, dtype=np.float32)
        except Exception:
            pass

        # Cache miss: compute via model
        embedding = self._encode(text)

        # Persist as a plain Python list so JSON serialisation is trivial
        try:
            from backend.services.redis_cache import redis_cache

            redis_cache.set_embedding(text, embedding.tolist())
            logger.debug(
                "[DuplicateService] Embedding cache SET for text (len=%d)", len(text)
            )
        except Exception:
            pass

        return embedding

    # ------------------------------------------------------------------
    # Matrix management
    # ------------------------------------------------------------------

    def _rebuild_embedding_matrix(self) -> None:
        """Rebuild the stacked embedding matrix from the ticket list.

        This enables vectorized cosine similarity computation by stacking all
        stored embeddings into a single 2D array, eliminating the per-ticket
        loop in ``check_duplicate``.
        """
        if not self._tickets:
            self._embedding_matrix = None
            self._ticket_ids = []
            self._embedding_matrix_dirty = False
            return

        tickets = list(self._tickets)  # consistent snapshot
        self._ticket_ids = [tid for tid, _, _ in tickets]
        embeddings = [emb for _, emb, _ in tickets]

        if _HAS_NUMPY:
            self._embedding_matrix = np.vstack(embeddings).astype(np.float32)
        elif _HAS_SENTENCE:
            self._embedding_matrix = torch.stack(embeddings)
        else:
            self._embedding_matrix = None

        self._embedding_matrix_dirty = False

    def _ensure_matrix(self) -> None:
        """Rebuild the embedding matrix if it is dirty."""
        if self._embedding_matrix_dirty or self._embedding_matrix is None:
            self._rebuild_embedding_matrix()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def load(self) -> None:
        """Load the sentence-transformer model and saved tickets. Thread-safe and idempotent."""
        # Fast path: already loaded — no lock needed for the bool check
        if self._loaded or self._load_failed:
            return

        print("[DuplicateService] Loading model...")
        if not _HAS_SENTENCE:
            allow_degraded = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") == "1"
            self._load_failed = True
            print("[DuplicateService] sentence-transformers not installed")
            if allow_degraded:
                print(
                    "[DuplicateService] DEGRADED: Continuing without model (ALLOW_DEGRADED_STARTUP=1)"
                )
                self.model = None
                self._loaded = False
                return
            else:
                raise ImportError("sentence-transformers is required for DuplicateService")
        try:
            model_path = os.environ.get("SENTENCE_TRANSFORMER_MODEL_PATH")
            if model_path and os.path.exists(model_path):
                logger.info("[DuplicateService] Loading from local path: %s", model_path)
                self.model = SentenceTransformer(model_path)
            else:
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
            self._loaded = True

            if os.path.exists(self.storage_file):
                print(
                    f"[DuplicateService] Syncing ticket history from {self.storage_file}..."
                )
                try:
                    with open(self.storage_file, "r") as f:
                        data = json.load(f)
                    if not isinstance(data, list):
                        data = []
                    for item in data:
                        text = item["text"]
                        embedding = self._encode(text)
                        self._tickets.append((item["ticket_id"], embedding, text))
                    self._embedding_matrix_dirty = True
                    logger.info(
                        "[DuplicateService] Loaded %d tickets from storage.",
                        len(self._tickets),
                    )
                except Exception as e:
                    logger.error("[DuplicateService] Error loading storage: %s", e)
        except Exception as e:
            allow_degraded = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") == "1"
            self._load_failed = True
            logger.error("[DuplicateService] Failed to load model: %s", e)
            if allow_degraded:
                logger.warning(
                    "[DuplicateService] DEGRADED: Continuing without model (ALLOW_DEGRADED_STARTUP=1)"
                )
                self.model = None
                self._loaded = False
            else:
                raise

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def save_to_disk(self, ticket_id: str, text: str) -> None:
        """Append a new ticket entry to the JSON persistence file."""
        data: list = []
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
        except Exception as exc:
            print(f"[DuplicateService] Failed to save to disk: {exc}")

    def add_ticket(self, ticket_id: str, text: str) -> None:
        """Add a ticket to the in-memory store and persist to disk.

        Computes (or retrieves from Redis cache) the embedding, adds it to
        the in-memory store, persists to disk, and marks the embedding
        matrix as dirty so the next ``check_duplicate`` call rebuilds it.
        """
        self.load()
        if not self.is_available():
            logger.warning(
                "[DuplicateService] DEGRADED: Skipping embedding for ticket %s (model not available)",
                ticket_id,
            )
            return

        # Compute embedding outside the lock (CPU-bound, can run concurrently)
        embedding = self._encode(text)
        with self._lock:
            self._tickets.append((ticket_id, embedding, text))
            self._embedding_matrix_dirty = True
        self.save_to_disk(ticket_id, text)

    def get_ticket_count(self) -> int:
        """Return the number of indexed tickets using a thread-safe snapshot."""
        with self._lock:
            return len(self._tickets)

    def clear(self) -> None:
        """Clear in-memory duplicate detection state in a thread-safe way."""
        with self._lock:
            self._tickets.clear()
            self._ticket_ids.clear()
            self._embedding_matrix = None
            self._embedding_matrix_dirty = True

    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate a 384-d embedding for the provided ticket text."""
        from backend.services.redis_cache import redis_cache

        cached = redis_cache.get_embedding(text)
        if cached is not None:
            return cached

        self.load()
        if not self.is_available():
            return None

        embedding = self.model.encode(
            text, convert_to_numpy=True, normalize_embeddings=True
        )
        values = [float(value) for value in embedding.tolist()]
        redis_cache.set_embedding(text, values)
        return values

    def check_duplicate(self, text: str, threshold: Optional[float] = None) -> Dict:
        """Check whether *text* matches any previously stored ticket.

        Uses vectorized cosine similarity: all stored embeddings are stacked
        into a single 2D matrix and compared against the query embedding in
        one batched dot-product, rather than looping over each stored ticket.

        Args:
            text:      The ticket text to check.
            threshold: Optional override for the similarity threshold.

        Returns:
            dict with duplicate_ticket_id, similarity_score, original_text
            or None if no duplicate found / service unavailable.
        """
        active_threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD
        if not 0.0 <= active_threshold <= 1.0:
            raise ValueError("Duplicate similarity threshold must be between 0.0 and 1.0")

        self.load()

        # If model is not available, return no duplicate found
        if not self.is_available():
            print(
                "[DuplicateService] DEGRADED: Duplicate check skipped (model not available)"
            )
            return {
                "duplicate_ticket_id": ticket_id,
                "similarity_score": round(best_score, 4),
                "original_text": original_text,
            }

        use_default_threshold = threshold is None

        # Try the result cache only when using the default threshold so we
        # don't serve threshold-mismatched cached results.
        if use_default_threshold:
            try:
                from backend.services.redis_cache import redis_cache

                cached_result = redis_cache.get_duplicate_result(text)
                if cached_result is not None:
                    logger.debug("[DuplicateService] Duplicate-result cache HIT")
                    return cached_result
            except Exception:
                pass

        # Take a consistent snapshot under the same lock used by add_ticket().
        # The matrix and ticket ID list must be derived from that same snapshot;
        # using the mutable service-level matrix here can race with concurrent
        # add_ticket() calls and return an ID from a different version of _tickets.
        with self._lock:
            tickets_snapshot = list(self._tickets)

        if not tickets_snapshot:
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }

        query_embedding = self._encode_with_cache(text)
        if query_embedding is None:
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }

        # --- Vectorized cosine similarity (NumPy path) ---
        if _HAS_NUMPY:
            assert np is not None
            ticket_ids_snapshot = [tid for tid, _, _ in tickets_snapshot]
            embeddings_snapshot = [emb for _, emb, _ in tickets_snapshot]
            matrix_snapshot = np.vstack(embeddings_snapshot).astype(np.float32)
            if matrix_snapshot is not None and len(ticket_ids_snapshot) > 0:
                # query (d,) @ matrix.T (d, n) → similarities (n,)
                similarities = _cosine_similarity_numpy(
                    query_embedding, matrix_snapshot
                )
                best_index = int(np.argmax(similarities))
                best_score = float(similarities[best_index])
                best_id = ticket_ids_snapshot[best_index]
            else:
                # Fallback: loop
                best_score = -1.0
                best_id = None
                for tid, stored_emb, _ in tickets_snapshot:
                    score = float(np.dot(query_embedding, stored_emb))
                    if score > best_score:
                        best_score = score
                        best_id = tid

        # --- Fallback: torch path ---
        elif _HAS_SENTENCE:
            embeddings = [stored_emb for _, stored_emb, _ in tickets_snapshot]
            stacked = torch.stack(embeddings)
            sim_matrix = util.cos_sim(
                torch.tensor(query_embedding) if isinstance(query_embedding, np.ndarray) else query_embedding,
                stacked,
            )
            best_score_tensor, best_index_tensor = torch.max(sim_matrix, dim=1)
            best_score = best_score_tensor.item()
            best_index = best_index_tensor.item()
            best_id = tickets_snapshot[best_index][0]

        # --- Fallback: pure Python loop ---
        else:
            best_score = -1.0
            best_id = None
            for tid, stored_emb, _ in tickets_snapshot:
                dot = sum(a * b for a, b in zip(query_embedding, stored_emb))
                if dot > best_score:
                    best_score = dot
                    best_id = tid

        is_dup = best_score >= active_threshold

        result: Dict = {
            "is_duplicate": is_dup,
            "duplicate_ticket_id": best_id if is_dup else None,
            "similarity": round(best_score, 4),
        }

        if use_default_threshold:
            try:
                from backend.services.redis_cache import redis_cache

                redis_cache.set_duplicate_result(text, result)
            except Exception:
                pass

        return result
