"""Provider contract: each returns a normalized verdict dict for one IOC.

Normalized result shape:
{
    "provider": "virustotal",
    "verdict": "malicious" | "suspicious" | "clean" | "unknown",
    "score": 0-100,          # provider-native maliciousness, normalized
    "summary": "human-readable one-liner",
    "details": {...},        # trimmed provider-specific payload
    "link": "https://...",   # pivot link for the analyst
}
"""

import asyncio
import time
from abc import ABC, abstractmethod


class RateLimiter:
    """Simple min-interval limiter for free-tier API quotas."""

    def __init__(self, min_interval_seconds: float) -> None:
        self.min_interval = min_interval_seconds
        self._last = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            now = time.monotonic()
            delta = now - self._last
            if delta < self.min_interval:
                await asyncio.sleep(self.min_interval - delta)
            self._last = time.monotonic()


class IntelProvider(ABC):
    name: str = "base"
    supported_types: set[str] = set()

    def supports(self, ioc_type: str) -> bool:
        return ioc_type in self.supported_types

    @abstractmethod
    async def lookup(self, ioc_type: str, value: str) -> dict:
        ...
