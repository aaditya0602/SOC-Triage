import json

from fastapi import WebSocket


class ConnectionManager:
    """Broadcasts pipeline events to connected dashboard clients."""

    def __init__(self) -> None:
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, event: str, data: dict) -> None:
        message = json.dumps({"event": event, "data": data}, default=str)
        for ws in list(self.connections):
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()
