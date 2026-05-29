"""
Duplicate Detection Service
Uses sentence-transformers all-MiniLM-L6-v2 to detect similar tickets.
"""

import uuid
import os
import torch
import numpy as np
from sentence_transformers import SentenceTransformer, util

SIMILARITY_THRESHOLD = 0.70


class DuplicateService:
    def __init__(self):
        self.model = None
        self._loaded = False
        self._load_failed = False
        # In-memory store: list of (ticket_id, embedding, text)
        self._tickets: list[tuple[str, object, str]] = []
        # Pre-computed embedding matrix for vectorized search
        self._embedding_matrix: torch.Tensor | None = None
        self._ticket_ids: list[str] = []
        self._embedding_matrix_dirty: bool = True
        self.storage_file = os.path.join(os.path.dirname(__file__), "..", "data", "case_history_cache.json")
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

        self._ticket_ids = [tid for tid, _, _ in self._tickets]
        embeddings = [emb for _, emb, _ in self._tickets]
        self._embedding_matrix = torch.stack(embeddings)
        self._embedding_matrix_dirty = False

    def add_ticket(self, ticket_id: str, text: str):
        """Add a ticket to the in-memory store and persist to disk."""
        self.load()
        if not self.is_available():
            print(f"[DuplicateService] DEGRADED: Skipping embedding for ticket {ticket_id} (model not available)")
            return
        embedding = self.model.encode(text, convert_to_tensor=True)
        self._tickets.append((ticket_id, embedding, text))
        self._embedding_matrix_dirty = True
        self.save_to_disk(ticket_id, text)

    def check_duplicate(self, text: str, threshold: float = None) -> dict:
        """
        Check if a ticket is a duplicate of any stored ticket.

        Uses vectorized cosine similarity: all stored embeddings are stacked
        into a single 2D tensor and compared against the query embedding in
        one batched matrix operation, rather than looping over each stored
        ticket individually.  This reduces the similarity computation from
        O(n) individual tensor operations to a single O(1) matrix multiply.

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

        if not self._tickets:
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }

        query_embedding = self.model.encode(text, convert_to_tensor=True)

        # Rebuild embedding matrix if it is stale
        if self._embedding_matrix_dirty or self._embedding_matrix is None:
            self._rebuild_embedding_matrix()

        # Vectorized cosine similarity: compute all similarities at once
        # query_embedding shape: (dim,) -> (1, dim)
        # _embedding_matrix shape: (n_tickets, dim)
        # cos_sim returns shape: (1, n_tickets)
        similarity_scores = util.cos_sim(
            query_embedding.unsqueeze(0), self._embedding_matrix
        ).squeeze(0)

        best_idx = torch.argmax(similarity_scores).item()
        best_score = similarity_scores[best_idx].item()
        best_id = self._ticket_ids[best_idx]

        is_dup = best_score >= active_threshold

        return {
            "is_duplicate": is_dup,
            "duplicate_ticket_id": best_id if is_dup else None,
            "similarity": round(best_score, 4),
        }
