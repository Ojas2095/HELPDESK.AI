import pytest
import torch
from unittest.mock import MagicMock, patch

# ─── 1. Empty store returns None ────────────────────────────────────────────
def test_check_duplicate_empty_store_returns_none(dup_svc):
    result = dup_svc.check_duplicate("VPN is not working")
    assert result is None, "Empty store must return None, not raise RuntimeError"

# ─── 2. Exact duplicate detected ────────────────────────────────────────────
def test_exact_duplicate_detected(dup_svc, tmp_path):
    dup_svc.storage_file = str(tmp_path / "cache.json")
    dup_svc.add_ticket("t-001", "VPN is not working")
    result = dup_svc.check_duplicate("VPN is not working")
    assert result is not None
    assert result["duplicate_ticket_id"] == "t-001"
    assert result["similarity_score"] >= 0.99

# ─── 3. Below-threshold text returns None ───────────────────────────────────
def test_below_threshold_returns_none(dup_svc, tmp_path):
    dup_svc.storage_file = str(tmp_path / "cache.json")
    dup_svc.add_ticket("t-001", "VPN is not working")
    result = dup_svc.check_duplicate("The printer has no paper")
    assert result is None

# ─── 4. Picks highest similarity among multiple tickets ──────────────────────
def test_picks_best_match_among_multiple(dup_svc, tmp_path):
    dup_svc.storage_file = str(tmp_path / "cache.json")
    dup_svc.add_ticket("t-001", "I cannot connect to WiFi")
    dup_svc.add_ticket("t-002", "VPN authentication fails repeatedly")
    dup_svc.add_ticket("t-003", "VPN connection keeps dropping")
    result = dup_svc.check_duplicate("VPN keeps disconnecting")
    assert result is not None
    assert result["duplicate_ticket_id"] in ("t-002", "t-003")

# ─── 5. Unavailable service returns None ────────────────────────────────────
def test_unavailable_returns_none(dup_svc):
    dup_svc._loaded = False
    result = dup_svc.check_duplicate("test")
    assert result is None

# ─── 6. Thread safety — concurrent add+check does not raise ─────────────────
def test_concurrent_add_check_no_exception(dup_svc, tmp_path):
    import threading
    dup_svc.storage_file = str(tmp_path / "cache.json")
    errors = []
    def add(i):
        try:
            dup_svc.add_ticket(f"t-{i}", f"ticket text {i}")
        except Exception as e:
            errors.append(e)
    def check():
        try:
            dup_svc.check_duplicate("ticket text 5")
        except Exception as e:
            errors.append(e)
    threads = [threading.Thread(target=add, args=(i,)) for i in range(20)]
    threads += [threading.Thread(target=check) for _ in range(10)]
    for t in threads: t.start()
    for t in threads: t.join()
    assert not errors, f"Thread safety violation: {errors}"
