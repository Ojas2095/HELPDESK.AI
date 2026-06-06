"""
Duplicate Detection Service
Uses sentence-transformers all-MiniLM-L6-v2 to detect similar tickets.
"""

import uuid
import os
import threading
import tempfile
import torch
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
        self._lock = threading.Lock()
        self._file_lock = threading.Lock()

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
        with self._file_lock:
            data = []
            os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
            if os.path.exists(self.storage_file):
                with open(self.storage_file, "r") as f:
                    try:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
                    except json.JSONDecodeError:
                        data = []
            
            data.append({"ticket_id": ticket_id, "text": text})
            tmp_fd, tmp_path = tempfile.mkstemp(
                dir=os.path.dirname(self.storage_file), suffix=".tmp"
            )
            try:
                with os.fdopen(tmp_fd, "w") as tf:
                    json.dump(data, tf, indent=2)
                os.replace(tmp_path, self.storage_file)
                print(f"[DuplicateService] Indexed ticket {ticket_id} to case history.")
            except Exception as e:
                os.unlink(tmp_path)
                print(f"[DuplicateService] Failed to save to disk: {e}")
                raise

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

    def check_duplicate(self, text: str, threshold: float = None):
        """
        Check if a ticket is a duplicate of any stored ticket.
        """
        self.load()
        
        if not self.is_available():
            print("[DuplicateService] DEGRADED: Duplicate check skipped (model not available)")
            return None
            
        with self._lock:
            if not self._tickets:
                return None
            tickets_snapshot = list(self._tickets)

        new_emb = self.model.encode(text, convert_to_tensor=True)
        embeddings = [e for _, e, _ in tickets_snapshot]
        stacked = torch.stack(embeddings)
        scores = util.pytorch_cos_sim(new_emb, stacked)[0]
        
        active_threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD
        
        best_score, best_idx = torch.max(scores, dim=0)
        best_score_val = best_score.item()
        
        if best_score_val >= active_threshold:
            best_id = tickets_snapshot[best_idx.item()][0]
            return {
                "is_duplicate": True,
                "duplicate_ticket_id": best_id,
                "similarity": round(best_score_val, 4),
            }
            
        return None
