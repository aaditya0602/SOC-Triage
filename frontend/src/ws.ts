import { useEffect, useRef } from "react";
import { API_BASE, getToken } from "./api";
import type { Alert } from "./types";

export type WSEvent = {
  event: "alert.created" | "alert.updated" | "alert.completed";
  data: Alert;
};

/** Subscribe to live pipeline events. Reconnects with backoff. */
export function useAlertStream(
  onEvent: (e: WSEvent) => void,
  onStatus?: (connected: boolean) => void
) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const status = useRef(onStatus);
  status.current = onStatus;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 1000;

    function connect() {
      const token = getToken();
      if (!token || closed) return;
      const base = API_BASE
        ? API_BASE.replace(/^http/, "ws")
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
      ws = new WebSocket(`${base}/ws/alerts?token=${token}`);
      ws.onmessage = (msg) => {
        try {
          handler.current(JSON.parse(msg.data));
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onopen = () => {
        retry = 1000;
        status.current?.(true);
      };
      ws.onclose = () => {
        status.current?.(false);
        if (!closed) {
          setTimeout(connect, retry);
          retry = Math.min(retry * 2, 15000);
        }
      };
    }

    connect();
    const ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send("ping"), 30000);
    return () => {
      closed = true;
      clearInterval(ping);
      ws?.close();
    };
  }, []);
}
