"""
Duplicate Detection Service
Uses sentence-transformers all-MiniLM-L6-v2 to detect similar tickets.

Cosine similarity is computed via NumPy matrix math against a stacked
embedding matrix instead of a Python-level for-loop, which scales
linearly with ticket count but at vectorized C-level speed.
"""

import uuid
import numpy as np
from sentence_transformers import SentenceTransformer

SIMILARITY_THRESHOLD = 0.70


import os

class DuplicateService:
    def __init__(self):
        self.model = None
        self._loaded = False
        # In-memory store: list of (ticket_id, embedding (np.ndarray, L2-normalized), text)
        self._tickets: list[tuple[str, np.ndarray, str]] = []
        # Stacked matrix cache of normalized embeddings (shape: [N, D])
        self._embedding_matrix: np.ndarray | None = None
        self.storage_file = os.path.join(os.path.dirname(__file__), "..", "data", "case_history_cache.json")
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)

    def _encode(self, text: str) -> np.ndarray:
        """Encode text to an L2-normalized float32 numpy embedding."""
        emb = self.model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
        return emb.astype(np.float32, copy=False)

    def _rebuild_matrix(self):
        if self._tickets:
            self._embedding_matrix = np.vstack([emb for _, emb, _ in self._tickets])
        else:
            self._embedding_matrix = None

    def load(self):
        """Load the sentence-transformer model and saved tickets."""
        if self._loaded:
            return

        print("[DuplicateService] Loading model...")
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
                        embedding = self._encode(text)
                        self._tickets.append((item["ticket_id"], embedding, text))
                self._rebuild_matrix()
                print(f"[DuplicateService] Loaded {len(self._tickets)} tickets.")
            except Exception as e:
                print(f"[DuplicateService] Error loading storage: {e}")

    def save_to_disk(self, ticket_id: str, text: str):
        """Append a new ticket to the JSON storage."""
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
                    except:
                        data = []

            data.append({"ticket_id": ticket_id, "text": text})
            with open(self.storage_file, "w") as f:
                json.dump(data, f, indent=2)
            print(f"[DuplicateService] Indexed ticket {ticket_id} to case history.")
        except Exception as e:
            print(f"[DuplicateService] Failed to save to disk: {e}")

    def add_ticket(self, ticket_id: str, text: str):
        """Add a ticket to the in-memory store and persist to disk."""
        self.load()
        embedding = self._encode(text)
        self._tickets.append((ticket_id, embedding, text))
        # Incrementally append to the matrix to avoid rebuilding from scratch.
        if self._embedding_matrix is None:
            self._embedding_matrix = embedding.reshape(1, -1)
        else:
            self._embedding_matrix = np.vstack([self._embedding_matrix, embedding])
        self.save_to_disk(ticket_id, text)

    def check_duplicate(self, text: str, threshold: float = None) -> dict:
        """
        Check if a ticket is a duplicate of any stored ticket.

        Args:
            text: The ticket text to check.
            threshold: Optional override for the similarity threshold.

        Returns:
            {
                "is_duplicate": bool,
                "duplicate_ticket_id": str | None,
                "similarity": float
            }
        """
        self.load()

        # Use provided threshold or default to global constant
        active_threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD

        if not self._tickets or self._embedding_matrix is None:
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }

        query_embedding = self._encode(text)

        # Vectorized cosine similarity: since both query and stored embeddings
        # are L2-normalized, cosine similarity reduces to a single matrix-vector
        # dot product. This replaces the previous O(N) Python loop with a
        # single NumPy BLAS call.
        scores = self._embedding_matrix @ query_embedding
        best_idx = int(np.argmax(scores))
        best_score = float(scores[best_idx])
        best_id = self._tickets[best_idx][0]

        is_dup = best_score >= active_threshold

        return {
            "is_duplicate": is_dup,
            "duplicate_ticket_id": best_id if is_dup else None,
            "similarity": round(best_score, 4),
        }
