import { useEffect, useRef } from "react";
import { getToken } from "./api";
import type { Alert } from "./types";

export type WSEvent = {
  event: "alert.created" | "alert.updated" | "alert.completed";
  data: Alert;
};

/** Subscribe to live pipeline events. Reconnects with backoff. */
export function useAlertStream(onEvent: (e: WSEvent) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 1000;

    function connect() {
      const token = getToken();
      if (!token || closed) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.host}/ws/alerts?token=${token}`);
      ws.onmessage = (msg) => {
        try {
          handler.current(JSON.parse(msg.data));
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onopen = () => {
        retry = 1000;
      };
      ws.onclose = () => {
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
