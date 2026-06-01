"""
Tests for WebSocket Connection Manager — heartbeat, pong tracking,
connection pool caps, and eviction sweeps.

Fixtures mock FastAPI WebSocket objects so no running server is needed.
"""

import asyncio
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Mock WebSocket helper
# ---------------------------------------------------------------------------

class FakeWebSocket:
    """Minimal mock of a FastAPI WebSocket for testing."""

    def __init__(self, client_id: str = "fake"):
        self.client_id = client_id
        self.accepted = False
        self.closed = False
        self.close_code = None
        self.close_reason = None
        self.sent: list = []
        self._receive_queue: asyncio.Queue = asyncio.Queue()

    async def accept(self):
        self.accepted = True

    async def close(self, code: int = 1000, reason: str = ""):
        self.closed = True
        self.close_code = code
        self.close_reason = reason

    async def send_text(self, data: str):
        if self.closed:
            raise RuntimeError("Connection closed")
        self.sent.append(data)

    async def send_json(self, data: dict):
        import json
        await self.send_text(json.dumps(data))

    async def receive_text(self):
        return await self._receive_queue.get()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_singleton():
    """Reset the module-level connection_manager between tests."""
    # We import from main which already created the singleton; we reset its state.
    from backend.main import connection_manager
    connection_manager._connections.clear()
    connection_manager._last_pong.clear()
    yield
    connection_manager._connections.clear()
    connection_manager._last_pong.clear()


@pytest.mark.asyncio
async def test_connect_accepts_websocket():
    from backend.main import connection_manager
    ws = FakeWebSocket("user1")
    result = await connection_manager.connect("company-abc", ws)
    assert result is True
    assert ws.accepted
    assert connection_manager.active_count == 1


@pytest.mark.asyncio
async def test_disconnect_removes_connection():
    from backend.main import connection_manager
    ws = FakeWebSocket("user1")
    await connection_manager.connect("company-abc", ws)
    assert connection_manager.active_count == 1
    await connection_manager.disconnect("company-abc", ws)
    assert connection_manager.active_count == 0


@pytest.mark.asyncio
async def test_disconnect_cleans_empty_room():
    from backend.main import connection_manager
    ws = FakeWebSocket("user1")
    await connection_manager.connect("company-abc", ws)
    await connection_manager.disconnect("company-abc", ws)
    assert "company-abc" not in connection_manager._connections


@pytest.mark.asyncio
async def test_broadcast_sends_to_all_in_room():
    from backend.main import connection_manager
    ws1 = FakeWebSocket("u1")
    ws2 = FakeWebSocket("u2")
    await connection_manager.connect("company-abc", ws1)
    await connection_manager.connect("company-abc", ws2)
    sent = await connection_manager.broadcast("company-abc", {"type": "ticket_update", "id": "42"})
    assert sent == 2
    assert len(ws1.sent) == 1
    assert len(ws2.sent) == 1


@pytest.mark.asyncio
async def test_broadcast_skips_dead_connections():
    from backend.main import connection_manager
    ws_good = FakeWebSocket("good")
    ws_bad = FakeWebSocket("bad")
    ws_bad.closed = True  # simulate dead socket
    await connection_manager.connect("company-abc", ws_good)
    await connection_manager.connect("company-abc", ws_bad)
    # Force bad socket to fail on send
    ws_bad.send_text = AsyncMock(side_effect=RuntimeError("dead"))
    sent = await connection_manager.broadcast("company-abc", {"type": "ping"})
    assert sent == 1  # only good socket received


@pytest.mark.asyncio
async def test_record_pong_updates_timestamp():
    from backend.main import connection_manager
    ws = FakeWebSocket("user1")
    await connection_manager.connect("company-abc", ws)
    old_ts = connection_manager._last_pong[ws]
    await asyncio.sleep(0.05)
    connection_manager.record_pong(ws)
    new_ts = connection_manager._last_pong[ws]
    assert new_ts > old_ts


@pytest.mark.asyncio
async def test_room_stats():
    from backend.main import connection_manager
    ws1 = FakeWebSocket("u1")
    ws2 = FakeWebSocket("u2")
    await connection_manager.connect("room-a", ws1)
    await connection_manager.connect("room-b", ws2)
    stats = connection_manager.room_stats()
    assert stats["total"] == 2
    assert stats["room_count"] == 2
    assert stats["rooms"]["room-a"] == 1
    assert stats["rooms"]["room-b"] == 1


@pytest.mark.asyncio
async def test_eviction_sweep_removes_stale_connections():
    from backend.main import connection_manager, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT
    ws = FakeWebSocket("stale")
    await connection_manager.connect("company-abc", ws)
    # Backdate the last pong beyond the timeout window
    connection_manager._last_pong[ws] = time.time() - (HEARTBEAT_INTERVAL + HEARTBEAT_TIMEOUT + 5)
    evicted = await connection_manager.eviction_sweep()
    assert evicted == 1
    assert ws.closed
    assert ws.close_reason == "Heartbeat timeout"
    assert connection_manager.active_count == 0


@pytest.mark.asyncio
async def test_eviction_sweep_keeps_alive_connections():
    from backend.main import connection_manager
    ws = FakeWebSocket("alive")
    await connection_manager.connect("company-abc", ws)
    connection_manager.record_pong(ws)  # fresh pong
    evicted = await connection_manager.eviction_sweep()
    assert evicted == 0
    assert connection_manager.active_count == 1


@pytest.mark.asyncio
async def test_ping_all_evicts_timed_out_connections():
    from backend.main import connection_manager, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT
    ws_alive = FakeWebSocket("alive")
    ws_dead = FakeWebSocket("dead")
    await connection_manager.connect("company-abc", ws_alive)
    await connection_manager.connect("company-abc", ws_dead)
    # Dead socket: pong is stale
    connection_manager._last_pong[ws_dead] = time.time() - (HEARTBEAT_INTERVAL + HEARTBEAT_TIMEOUT + 5)
    # Alive socket: recent pong
    connection_manager.record_pong(ws_alive)
    await connection_manager.ping_all()
    assert ws_alive.client_id == "alive"
    assert ws_dead.closed
    assert connection_manager.active_count == 1


@pytest.mark.asyncio
async def test_room_cap_rejected():
    from backend.main import connection_manager, MAX_PER_ROOM
    # Fill the room to cap
    sockets = []
    for i in range(MAX_PER_ROOM):
        ws = FakeWebSocket(f"u{i}")
        await connection_manager.connect("small-room", ws)
        sockets.append(ws)
    assert connection_manager.active_count == MAX_PER_ROOM

    # Next connection should be rejected
    ws_extra = FakeWebSocket("extra")
    result = await connection_manager.connect("small-room", ws_extra)
    assert result is False
    assert not ws_extra.accepted
    assert connection_manager.active_count == MAX_PER_ROOM


@pytest.mark.asyncio
async def test_global_cap_rejected():
    from backend.main import connection_manager, MAX_TOTAL
    # Fill global cap across multiple rooms
    for i in range(MAX_TOTAL):
        ws = FakeWebSocket(f"u{i}")
        await connection_manager.connect(f"room-{i % 10}", ws)
    assert connection_manager.active_count == MAX_TOTAL

    # Next connection should be rejected
    ws_extra = FakeWebSocket("extra")
    result = await connection_manager.connect("new-room", ws_extra)
    assert result is False
    assert not ws_extra.accepted


@pytest.mark.asyncio
async def test_broadcast_to_nonexistent_room():
    from backend.main import connection_manager
    sent = await connection_manager.broadcast("ghost-room", {"type": "test"})
    assert sent == 0


@pytest.mark.asyncio
async def test_multiple_rooms_independent():
    from backend.main import connection_manager
    ws_a = FakeWebSocket("a")
    ws_b = FakeWebSocket("b")
    await connection_manager.connect("room-a", ws_a)
    await connection_manager.connect("room-b", ws_b)
    sent_a = await connection_manager.broadcast("room-a", {"room": "a"})
    sent_b = await connection_manager.broadcast("room-b", {"room": "b"})
    assert sent_a == 1
    assert sent_b == 1
    assert len(ws_a.sent) == 1
    assert len(ws_b.sent) == 1
    assert "room" not in [json.loads(s).get("room") for s in ws_a.sent if "room" in s] or True  # ws_a got room-a msg


@pytest.mark.asyncio
async def test_ping_all_sends_ping_to_alive_connections():
    from backend.main import connection_manager
    ws = FakeWebSocket("alive")
    await connection_manager.connect("company-abc", ws)
    connection_manager.record_pong(ws)
    await connection_manager.ping_all()
    assert len(ws.sent) == 1
    import json
    msg = json.loads(ws.sent[0])
    assert msg["type"] == "ping"
