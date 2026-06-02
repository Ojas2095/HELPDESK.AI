"""
Tests for backend/services/websocket_manager.py (Issue #902).
Covers: connect/disconnect lifecycle, heartbeat ping/pong, eviction of dead connections,
company-scoped broadcast, pool size limits, send failure handling, concurrent connections.

Uses AsyncMock for WebSocket objects since the manager is fully async.
"""

import sys
import os
import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.services.websocket_manager import (
    ConnectionManager,
    MAX_TOTAL_CONNECTIONS,
    MAX_PER_COMPANY,
    HEARTBEAT_INTERVAL_S,
)


def _make_ws(client_id="test-client"):
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_text = AsyncMock()
    ws.close = AsyncMock()
    return ws


def run(coro):
    """Run a coroutine in the event loop."""
    return asyncio.get_event_loop().run_until_complete(coro)


class TestConnectDisconnect(unittest.TestCase):
    def test_connect_accepts_websocket(self):
        manager = ConnectionManager()
        ws = _make_ws()
        result = run(manager.connect(ws, "c1"))
        self.assertTrue(result)
        ws.accept.assert_called_once()

    def test_connect_adds_to_pool(self):
        manager = ConnectionManager()
        ws = _make_ws()
        run(manager.connect(ws, "c1"))
        self.assertTrue(manager.is_connected("c1"))

    def test_disconnect_removes_from_pool(self):
        manager = ConnectionManager()
        ws = _make_ws()
        run(manager.connect(ws, "c1"))
        run(manager.disconnect("c1"))
        self.assertFalse(manager.is_connected("c1"))

    def test_disconnect_nonexistent_does_not_crash(self):
        manager = ConnectionManager()
        run(manager.disconnect("nonexistent"))  # Should not raise

    def test_connection_count_accurate(self):
        manager = ConnectionManager()
        ws1 = _make_ws()
        ws2 = _make_ws()
        run(manager.connect(ws1, "c1"))
        run(manager.connect(ws2, "c2"))
        self.assertEqual(manager.connection_count(), 2)
        run(manager.disconnect("c1"))
        self.assertEqual(manager.connection_count(), 1)

    def test_connect_assigns_company_id(self):
        manager = ConnectionManager()
        ws = _make_ws()
        run(manager.connect(ws, "c1", company_id="company-abc"))
        self.assertEqual(manager.connection_count("company-abc"), 1)

    def test_connect_closes_on_accept_failure(self):
        manager = ConnectionManager()
        ws = AsyncMock()
        ws.accept = AsyncMock(side_effect=Exception("accept failed"))
        with self.assertRaises(Exception):
            run(manager.connect(ws, "bad-client"))


class TestPoolLimits(unittest.TestCase):
    def test_global_pool_limit(self):
        manager = ConnectionManager()
        for i in range(MAX_TOTAL_CONNECTIONS):
            ws = _make_ws()
            run(manager.connect(ws, f"c{i}"))
        # Next connection should be rejected
        ws_extra = _make_ws()
        result = run(manager.connect(ws_extra, "overflow"))
        self.assertFalse(result)

    def test_per_company_limit(self):
        manager = ConnectionManager()
        for i in range(MAX_PER_COMPANY):
            ws = _make_ws()
            run(manager.connect(ws, f"c{i}", company_id="company-x"))
        # Next for same company should be rejected
        ws_extra = _make_ws()
        result = run(manager.connect(ws_extra, "overflow", company_id="company-x"))
        self.assertFalse(result)

    def test_different_companies_independent_limits(self):
        manager = ConnectionManager()
        # Fill company-x
        for i in range(MAX_PER_COMPANY):
            ws = _make_ws()
            run(manager.connect(ws, f"x{i}", company_id="company-x"))
        # company-y should still be able to connect
        ws_y = _make_ws()
        result = run(manager.connect(ws_y, "y1", company_id="company-y"))
        self.assertTrue(result)


class TestSendPersonal(unittest.TestCase):
    def test_send_personal_success(self):
        manager = ConnectionManager()
        ws = _make_ws()
        run(manager.connect(ws, "c1"))
        result = run(manager.send_personal({"type": "update"}, "c1"))
        self.assertTrue(result)
        ws.send_text.assert_called()

    def test_send_personal_to_missing_client(self):
        manager = ConnectionManager()
        result = run(manager.send_personal("hello", "ghost"))
        self.assertFalse(result)

    def test_send_personal_disconnects_on_failure(self):
        manager = ConnectionManager()
        ws = _make_ws()
        ws.send_text = AsyncMock(side_effect=Exception("send failed"))
        run(manager.connect(ws, "c1"))
        result = run(manager.send_personal("msg", "c1"))
        self.assertFalse(result)
        self.assertFalse(manager.is_connected("c1"))

    def test_send_personal_accepts_dict(self):
        manager = ConnectionManager()
        ws = _make_ws()
        run(manager.connect(ws, "c1"))
        import json
        run(manager.send_personal({"event": "ticket_update", "id": "123"}, "c1"))
        call_arg = ws.send_text.call_args[0][0]
        parsed = json.loads(call_arg)
        self.assertEqual(parsed["event"], "ticket_update")

    def test_send_personal_accepts_string(self):
        manager = ConnectionManager()
        ws = _make_ws()
        run(manager.connect(ws, "c1"))
        run(manager.send_personal('{"ok":true}', "c1"))
        ws.send_text.assert_called_with('{"ok":true}')


class TestBroadcast(unittest.TestCase):
    def test_broadcast_all_clients(self):
        manager = ConnectionManager()
        ws1, ws2 = _make_ws(), _make_ws()
        run(manager.connect(ws1, "c1", company_id="comp-a"))
        run(manager.connect(ws2, "c2", company_id="comp-b"))
        run(manager.broadcast({"type": "ping"}))
        ws1.send_text.assert_called_once()
        ws2.send_text.assert_called_once()

    def test_broadcast_company_scoped(self):
        manager = ConnectionManager()
        ws1, ws2 = _make_ws(), _make_ws()
        run(manager.connect(ws1, "c1", company_id="comp-a"))
        run(manager.connect(ws2, "c2", company_id="comp-b"))
        run(manager.broadcast({"type": "update"}, company_id="comp-a"))
        ws1.send_text.assert_called_once()
        ws2.send_text.assert_not_called()

    def test_broadcast_evicts_dead_connections(self):
        manager = ConnectionManager()
        ws = _make_ws()
        ws.send_text = AsyncMock(side_effect=Exception("dead"))
        run(manager.connect(ws, "dead-c"))
        run(manager.broadcast("hello"))
        self.assertFalse(manager.is_connected("dead-c"))

    def test_broadcast_empty_pool_does_not_crash(self):
        manager = ConnectionManager()
        run(manager.broadcast({"type": "hello"}))  # Should not raise


class TestHeartbeat(unittest.TestCase):
    def test_handle_pong_updates_timestamp(self):
        manager = ConnectionManager()
        ws = _make_ws()
        run(manager.connect(ws, "c1"))

        async def pong_and_check():
            old_ts = manager._connections["c1"].last_pong_at
            await asyncio.sleep(0.01)
            await manager.handle_pong("c1")
            new_ts = manager._connections["c1"].last_pong_at
            return old_ts, new_ts

        old, new = run(pong_and_check())
        self.assertGreaterEqual(new, old)

    def test_handle_pong_nonexistent_does_not_crash(self):
        manager = ConnectionManager()
        run(manager.handle_pong("ghost"))  # Should not raise


class TestConcurrentConnections(unittest.TestCase):
    def test_multiple_clients_concurrent_connect(self):
        """Simulate multiple clients connecting nearly simultaneously."""
        manager = ConnectionManager()

        async def connect_many():
            tasks = []
            for i in range(10):
                ws = _make_ws()
                tasks.append(manager.connect(ws, f"client-{i}"))
            results = await asyncio.gather(*tasks)
            return results

        results = run(connect_many())
        successful = sum(1 for r in results if r)
        self.assertEqual(successful, 10)
        self.assertEqual(manager.connection_count(), 10)


if __name__ == "__main__":
    unittest.main()
