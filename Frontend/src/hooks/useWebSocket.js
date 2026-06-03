/**
 * useWebSocket — auto-reconnecting WebSocket hook with bidirectional heartbeat.
 *
 * Heartbeat protocol (client-initiated):
 *   Client sends  {"type": "ping"}  every PING_INTERVAL_MS.
 *   Server echoes {"type": "pong"}  immediately.
 *   If no pong arrives within PONG_TIMEOUT_MS the hook treats the connection
 *   as dead and triggers exponential-backoff reconnection.
 *
 * Heartbeat protocol (server-initiated):
 *   Server sends  {"type": "ping"}  every ~30 s.
 *   Client echoes {"type": "pong"}  immediately.
 *   If the server receives no pong it disconnects the client.
 *
 * Usage:
 *   const { isConnected, sendMessage, lastMessage, connectionError } =
 *     useWebSocket(companyId);
 *
 *   useEffect(() => {
 *     if (lastMessage?.type === "ticket_update") {
 *       store.addTicket(lastMessage.ticket);
 *     }
 *   }, [lastMessage]);
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_BASE_URL = import.meta.env.VITE_WS_URL || "ws://localhost:7860";
const PING_INTERVAL_MS = 25_000;     // slightly < server-side 30 s so pong arrives first
const PONG_TIMEOUT_MS = 12_000;      // if no pong within 12 s, treat connection as dead
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useWebSocket(companyId) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  const wsRef = useRef(null);
  const pingTimerRef = useRef(null);
  const pongTimeoutRef = useRef(null);  // armed after each outgoing ping, cancelled on pong
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const companyIdRef = useRef(companyId);

  // ---- Cleanup helpers ---------------------------------------------------

  const clearTimers = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearTimers]);

  // ---- Reconnect scheduling ---------------------------------------------

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || !companyIdRef.current) return;

    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY_MS
    );
    reconnectAttemptRef.current = attempt + 1;

    setConnectionError(`Reconnecting in ${Math.round(delay / 1000)}s…`);

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current && connectRef.current) connectRef.current();
    }, delay);
  }, []);

  // ---- Heartbeat ---------------------------------------------------------

  /**
   * Start the client-side heartbeat loop.
   *
   * Every PING_INTERVAL_MS:
   *  1. Send {"type": "ping"} to the server.
   *  2. Arm a PONG_TIMEOUT_MS deadline timer.
   *  3. When the server echoes {"type": "pong"} (handled in onmessage),
   *     the deadline is cancelled.
   *  4. If the deadline fires, the connection is dead — force a reconnect.
   */
  const startHeartbeat = useCallback((socket) => {
    pingTimerRef.current = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      // Send the keepalive ping
      socket.send(JSON.stringify({ type: "ping" }));

      // Arm the pong deadline
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
      }
      pongTimeoutRef.current = setTimeout(() => {
        // No pong received within PONG_TIMEOUT_MS — connection is silently dead
        pongTimeoutRef.current = null;
        if (mountedRef.current) {
          setIsConnected(false);
          clearTimers();
          if (socket) {
            socket.onclose = null; // prevent double-reconnect from onclose
            socket.close();
          }
          scheduleReconnect();
        }
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }, [clearTimers, scheduleReconnect]);

  // ---- WebSocket lifecycle -----------------------------------------------

  const connectRef = useRef(null);

  const connect = useCallback(() => {
    cleanup();

    const cid = companyIdRef.current;
    if (!cid) return;

    const url = `${WS_BASE_URL}/ws/${encodeURIComponent(cid)}`;
    setConnectionError(null);

    let socket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      setConnectionError(err.message || "Failed to create WebSocket");
      scheduleReconnect();
      return;
    }
    wsRef.current = socket;

    socket.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptRef.current = 0;
      startHeartbeat(socket);
    };

    socket.onmessage = (event) => {
      if (!mountedRef.current) return;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // ignore malformed frames
      }

      // Server echoes our ping — cancel the pong deadline timer
      if (data.type === "pong") {
        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = null;
        }
        return;
      }

      // Server-initiated ping — echo back immediately so server records liveness
      if (data.type === "ping") {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "pong" }));
        }
        return;
      }

      setLastMessage(data);
    };

    socket.onclose = (event) => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      clearTimers();

      // Don't reconnect on clean closes (1000 = normal, 400x = intentional server policy)
      if (event.code === 1000 || (event.code >= 4000 && event.code < 5000)) {
        return;
      }

      scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose fires immediately after onerror; reconnect is handled there
    };
  }, [cleanup, clearTimers, startHeartbeat, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // ---- Send helper -------------------------------------------------------

  const sendMessage = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  }, []);

  // ---- Main effect -------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    companyIdRef.current = companyId;

    if (companyId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [companyId, connect, cleanup]);

  return { isConnected, lastMessage, connectionError, sendMessage };
}
