"""
Unit tests for DuplicateService.

These tests are aligned to the ACTUAL vectorized implementation:
- check_duplicate() encodes text once and calls util.pytorch_cos_sim()
  against ALL stored embeddings in a single batch operation.
- add_ticket() holds self._lock during list mutation.
- save_to_disk() uses an atomic temp-file swap.

Requires conftest.py (provides `dup_svc` fixture + mocked sentence_transformers).
"""

import json
import os
import threading

import pytest
import torch


# ── 1. Empty store returns None (Bug 1 regression) ───────────────────────────
def test_check_duplicate_empty_store_returns_none(dup_svc):
    """check_duplicate() must return None — not raise RuntimeError — when
    no tickets have been added yet (cold-start scenario)."""
    result = dup_svc.check_duplicate("VPN is not working")
    assert result is None, (
        "Empty _tickets must return None, not raise RuntimeError from torch.stack([])"
    )


# ── 2. Exact duplicate is detected ───────────────────────────────────────────
def test_exact_duplicate_detected(dup_svc):
    """Adding a ticket then checking the same text must return a match
    with similarity_score >= 0.99."""
    dup_svc.add_ticket("t-001", "VPN is not working")
    result = dup_svc.check_duplicate("VPN is not working")
    assert result is not None, "Exact duplicate must be detected"
    assert result["duplicate_ticket_id"] == "t-001"
    assert result["similarity_score"] >= 0.99


# ── 3. Below-threshold text returns None ─────────────────────────────────────
def test_below_threshold_returns_none(dup_svc):
    """Semantically unrelated text must return None (not a false positive)."""
    dup_svc.add_ticket("t-001", "VPN is not working")
    result = dup_svc.check_duplicate("The printer is out of paper")
    assert result is None, "Unrelated text must not be flagged as duplicate"


# ── 4. Best match selected from multiple tickets ──────────────────────────────
def test_picks_best_match_among_multiple_tickets(dup_svc):
    """check_duplicate() performs a single vectorized cos_sim over ALL stored
    embeddings and returns the highest-scoring match — not the first match."""
    dup_svc.add_ticket("t-001", "WiFi connection drops every hour")
    dup_svc.add_ticket("t-002", "VPN authentication fails repeatedly")
    dup_svc.add_ticket("t-003", "VPN connection keeps disconnecting")
    result = dup_svc.check_duplicate("VPN keeps disconnecting")
    # The result must be t-002 or t-003 (both VPN-related), not t-001 (WiFi)
    assert result is not None
    assert result["duplicate_ticket_id"] in ("t-002", "t-003"), (
        "Must return highest similarity match, not first in list"
    )


# ── 5. Unavailable service returns None ──────────────────────────────────────
def test_unavailable_service_returns_none(dup_svc):
    """When is_available() is False the method must return None without error."""
    dup_svc._loaded = False
    result = dup_svc.check_duplicate("test query")
    assert result is None


# ── 6. Thread safety: concurrent add + check does not raise ──────────────────
def test_concurrent_add_check_no_exception(dup_svc):
    """Concurrent add_ticket() and check_duplicate() calls must not raise
    any exception (RuntimeError, IndexError, etc.) due to list mutations
    racing with torch.stack() iteration. Validates the threading.Lock fix."""
    errors: list[Exception] = []

    def _add(i: int):
        try:
            dup_svc.add_ticket(f"t-{i}", f"Support ticket number {i}")
        except Exception as e:
            errors.append(e)

    def _check():
        try:
            dup_svc.check_duplicate("Support ticket number 5")
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=_add, args=(i,)) for i in range(30)]
    threads += [threading.Thread(target=_check) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, (
        f"Thread-safety violation — {len(errors)} error(s) raised:\n"
        + "\n".join(str(e) for e in errors)
    )


# ── 7. save_to_disk atomic write: JSON file is valid after concurrent saves ───
def test_save_to_disk_atomic_no_corruption(dup_svc, tmp_path):
    """Concurrent save_to_disk() calls must not corrupt the JSON file.
    Validates the atomic tempfile + os.replace() fix."""
    errors: list[Exception] = []

    def _save(i: int):
        try:
            dup_svc.save_to_disk(f"t-{i}", f"Ticket text {i}")
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=_save, args=(i,)) for i in range(40)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"save_to_disk raised: {errors}"

    # The JSON file must be valid and contain all 40 entries
    with open(dup_svc.storage_file, "r") as f:
        data = json.load(f)  # must not raise JSONDecodeError
    assert len(data) == 40, f"Expected 40 entries, got {len(data)}"
