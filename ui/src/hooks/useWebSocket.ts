import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '../types';

/** Return value of the useWebSocket hook. */
export interface UseWebSocketReturn {
  /** Send a typed message to the server. Queued if not yet connected. */
  send: (msg: ClientMessage) => void;
  /** Whether the WebSocket handshake has completed. */
  connected: boolean;
}

/**
 * Manages the WebSocket connection to the Live Agent server.
 * Automatically reconnects on close. Forwards console output
 * to the extension host via `console_log` messages.
 */
export function useWebSocket(onMessage: (msg: ServerMessage) => void): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const queueRef = useRef<string[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // send helper — stable across renders
  const send = useCallback((msg: ClientMessage) => {
    const str = JSON.stringify(msg);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(str);
    } else {
      queueRef.current.push(str);
    }
  }, []);

  useEffect(() => {
    // Patch console to forward logs to extension host
    const origLog = console.log.bind(console);
    const origErr = console.error.bind(console);
    const origWarn = console.warn.bind(console);

    function bridgeLog(level: string, args: unknown[]) {
      const message = args
        .map((a) => {
          try {
            return typeof a === 'object' ? JSON.stringify(a) : String(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');
      send({ type: 'console_log', level, message });
      (level === 'error' ? origErr : origLog)('[webview]', message);
    }

    console.log = (...a: unknown[]) => bridgeLog('log', a);
    console.error = (...a: unknown[]) => bridgeLog('error', a);
    console.warn = (...a: unknown[]) => bridgeLog('warn', a);

    function connect() {
      const ws = new WebSocket(`ws://${location.host}/`);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setConnected(true);
        const queue = queueRef.current.splice(0);
        queue.forEach((m) => ws.send(m));
      });

      ws.addEventListener('message', (e: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(e.data) as ServerMessage;
          onMessageRef.current(msg);
        } catch {
          origErr('[webview] Failed to parse server message', e.data);
        }
      });

      ws.addEventListener('close', () => {
        setConnected(false);
        setTimeout(connect, 2000);
      });

      ws.addEventListener('error', () => ws.close());
    }

    connect();

    return () => {
      // Restore console on unmount (dev-mode HMR safety)
      console.log = origLog;
      console.error = origErr;
      console.warn = origWarn;
      wsRef.current?.close();
    };
  }, [send]);

  return { send, connected };
}
