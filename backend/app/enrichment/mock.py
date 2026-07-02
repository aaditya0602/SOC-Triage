"""Deterministic fake intel — used when no API keys configured (demo mode).

Verdict derives from a hash of the IOC value so results are stable across runs,
with a curated list of "known bad" indicators used by the simulator.
"""

import hashlib

from .base import IntelProvider

KNOWN_BAD = {
    "185.220.101.45", "45.155.205.233", "91.240.118.172", "194.26.29.156",
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f",
    "malware-c2.badactor.xyz", "update-checker.evil-domain.ru",
}


class MockProvider(IntelProvider):
    supported_types = {"ip", "hash", "domain"}

    def __init__(self, name: str) -> None:
        self.name = name

    async def lookup(self, ioc_type: str, value: str) -> dict:
        if value.lower() in KNOWN_BAD or value in KNOWN_BAD:
            score = 85 + int(hashlib.sha256((value + self.name).encode()).hexdigest(), 16) % 15
            verdict = "malicious"
            summary = f"[MOCK] Known-bad indicator, score {score}"
        else:
            bucket = int(hashlib.sha256((value + self.name).encode()).hexdigest(), 16) % 100
            if bucket < 70:
                verdict, score = "clean", bucket % 10
                summary = f"[MOCK] No adverse reports"
            elif bucket < 90:
                verdict, score = "unknown", 0
                summary = "[MOCK] Indicator not found"
            else:
                verdict, score = "suspicious", 30 + bucket % 30
                summary = f"[MOCK] Some suspicious activity, score {score}"
        return {
            "provider": self.name,
            "verdict": verdict,
            "score": score,
            "summary": summary,
            "details": {"mock": True},
            "link": "",
        }
