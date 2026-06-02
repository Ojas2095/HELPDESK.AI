import json
try:
    import numpy as np
    _HAS_NUMPY = True
except Exception:  # pragma: no cover
    np = None  # type: ignore[assignment]
    _HAS_NUMPY = False
import os
import threading
import tempfile
import numpy as np
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

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.70
MAX_CACHE_ENTRIES = int(os.environ.get("DUPLICATE_CACHE_MAX", "5000"))


class DuplicateService:
    def __init__(self):
        self.model = None
        self._loaded = False
        self._load_failed = False
        # In-memory store: list of (ticket_id, embedding, text)
        self._tickets: list[tuple[str, object, str]] = []
        self.storage_file = os.path.join(
            os.path.dirname(__file__), "..", "data", "case_history_cache.json"
        )
        # Pre-computed embedding matrix for vectorized search
        self._embedding_matrix: Any | None = None
        self._ticket_ids: list[str] = []
        self._embedding_matrix_dirty: bool = True
        self.storage_file = os.path.join(os.path.dirname(__file__), "..", "data", "case_history_cache.json")
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
        # Lock for thread-safe access to _tickets and storage_file
        self._lock = threading.Lock()

        # --- Thread-safety additions (Issue #906) ---
        self._lock = threading.Lock()
        self._indexing: bool = False

    def is_available(self) -> bool:
        return self._loaded and not self._load_failed

    def _encode(self, text: str):
        """Encode text to an L2-normalized float32 numpy embedding."""
        if not self.model:
            return None
        emb = self.model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
        return emb.astype(np.float32, copy=False)

    def _rebuild_matrix(self):
        if self._tickets and _HAS_NUMPY:
            self._embedding_matrix = np.vstack([emb for _, emb, _ in self._tickets])
        else:
            self._embedding_matrix = None

    def load(self):
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
                print("[DuplicateService] DEGRADED: Continuing without model (ALLOW_DEGRADED_STARTUP=1)")
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
                print(f"[DuplicateService] Syncing ticket history from {self.storage_file}...")
                try:
                    with open(self.storage_file, "r") as f:
                        data = json.load(f)
                    for item in data:
                        text = item["text"]
                        embedding = self._encode_with_cache(text)
                        self._tickets.append((item["ticket_id"], embedding, text))
                print(f"[DuplicateService] Syncing previous ticket history from {self.storage_file}...")
                try:
                    with open(self.storage_file, "r") as f:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
                        for item in data:
                            text = item["text"]
                            embedding = self.model.encode(text, convert_to_tensor=True)
                            re_encoded += 1
                        self._tickets.append((item["ticket_id"], embedding, text))

                    if re_encoded > 0:
                        logger.info(
                            "[DuplicateService] Loaded %d tickets (%d re-encoded).",
                            len(self._tickets), re_encoded,
                        )
                    else:
                        logger.info("[DuplicateService] Loaded %d tickets (all from cache).", len(self._tickets))
                except Exception as e:
                    logger.error("[DuplicateService] Error loading storage: %s", e)
        except Exception as e:
            allow_degraded = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") == "1"
            self._load_failed = True
            logger.error("[DuplicateService] Failed to load model: %s", e)
            if allow_degraded:
                logger.warning("[DuplicateService] DEGRADED: Continuing without model (ALLOW_DEGRADED_STARTUP=1)")
                self.model = None
                self._loaded = False
            else:
                raise

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _encode_with_cache(self, text: str):
        """
        Return a sentence-transformer embedding tensor for *text*.

        Strategy:
        1. Check Redis for a pre-computed embedding stored as a JSON float list.
        2. On hit, deserialize and convert back to a tensor — zero model inference.
        3. On miss, run the model, then persist the result to Redis for future calls.
        """
        cached_vector = cache_service.get_embedding(text)
        if cached_vector is not None:
            logger.debug("[DuplicateService] Embedding cache HIT for text (len=%d)", len(text))
            return torch.tensor(cached_vector)

        # Cache miss: compute via model
        embedding_tensor = self.model.encode(text, convert_to_tensor=True)

        # Persist as a plain Python list so JSON serialisation is trivial
        cache_service.set_embedding(text, embedding_tensor.tolist())
        logger.debug("[DuplicateService] Embedding cache SET for text (len=%d)", len(text))
        return embedding_tensor

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def save_to_disk(self, ticket_id: str, text: str):
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

    def add_ticket(self, ticket_id: str, text: str):
        """
        Index a new ticket.

        Computes (or retrieves from Redis cache) the embedding, adds it to
        the in-memory store, persists to disk, and invalidates stale
        duplicate-result cache entries so future checks reflect this new ticket.
        """Append a new ticket to the JSON storage atomically.

        Uses a lock to prevent TOCTOU race conditions where concurrent reads
        could overwrite each other's writes. Writes to a temp file first, then
        renames for atomicity.
        """
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

    def _rebuild_embedding_matrix(self):
        """Rebuild the stacked embedding matrix from the ticket list.

        This enables vectorized cosine similarity computation by stacking all
        stored embeddings into a single 2D tensor, eliminating the per-ticket
        loop in ``check_duplicate``.
        """
        if not self._tickets:
            self._embedding_matrix = None
            self._ticket_ids = []
            self._embedding_matrix_dirty = False
            return

        if not _HAS_TORCH:
            self._embedding_matrix = None
            self._ticket_ids = []
            self._embedding_matrix_dirty = False
            return

        tickets = list(self._tickets)  # consistent snapshot
        self._ticket_ids = [tid for tid, _, _ in tickets]
        embeddings = [emb for _, emb, _ in tickets]
        self._embedding_matrix = torch.stack(embeddings)
        self._embedding_matrix_dirty = False

    def add_ticket(self, ticket_id: str, text: str):
        """Add a ticket to the in-memory store and persist to disk."""
        self.load()
        if not self.is_available():
            logger.warning("[DuplicateService] DEGRADED: Skipping embedding for ticket %s (model not available)", ticket_id)
            return

        # Compute embedding outside the lock (CPU-bound, can run concurrently)
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
        """
        Check whether *text* matches any previously stored ticket.

        Cache behaviour:
        - A full duplicate-check result (including threshold) is cached so
          identical texts submitted within the TTL window skip all model work.
        - The cache key encodes only the text; if the caller passes a custom
          threshold, bypass caching to avoid returning stale threshold-specific
          results.
        Uses vectorized cosine similarity: all stored embeddings are stacked
        into a single 2D tensor and compared against the query embedding in
        one batched matrix operation, rather than looping over each stored
        ticket individually.  This reduces the similarity computation from
        O(n) individual tensor operations to a single O(1) matrix multiply.

        Uses vectorized cosine similarity: all stored embeddings are stacked
        into a single 2D tensor and compared against the query embedding in
        one batched matrix operation, rather than looping over each stored
        ticket individually.  This reduces the similarity computation from
        O(n) individual tensor operations to a single O(1) matrix multiply.

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
        if not self.is_available() or torch is None:
            print("[DuplicateService] DEGRADED: Duplicate check skipped (model or torch not available)")
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }

        # Use provided threshold or default to global constant
        active_threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD

        active_threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD
        use_default_threshold = threshold is None

        # Try the result cache only when using the default threshold so we
        # don't serve threshold-mismatched cached results.
        if use_default_threshold:
            cached_result = cache_service.get_duplicate_result(text)
            if cached_result is not None:
                logger.debug("[DuplicateService] Duplicate-result cache HIT")
                return cached_result

        if not self._tickets:
            result = {
        # Take a snapshot of tickets under lock to avoid mutation during iteration
        with self._lock:
            tickets_snapshot = list(self._tickets)

        if not tickets_snapshot:
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }
            if use_default_threshold:
                cache_service.set_duplicate_result(text, result)
            return result

        query_embedding = self._encode_with_cache(text)
        query_embedding = self._encode(text)

        # Stack stored embeddings into a single tensor for vectorized operations
        embeddings = [stored_emb for _, stored_emb, _ in tickets_snapshot]
        stacked_embeddings = torch.stack(embeddings)
        similarity_matrix = util.cos_sim(query_embedding, stacked_embeddings)

        best_score_tensor, best_index_tensor = torch.max(similarity_matrix, dim=1)
        best_score = best_score_tensor.item()
        best_index = best_index_tensor.item()
        best_id = tickets_snapshot[best_index][0]

        is_dup = best_score >= active_threshold

        result = {
            "is_duplicate": is_dup,
            "duplicate_ticket_id": best_id if is_dup else None,
            "similarity": round(best_score, 4),
        }

        if use_default_threshold:
            cache_service.set_duplicate_result(text, result)

        return result
