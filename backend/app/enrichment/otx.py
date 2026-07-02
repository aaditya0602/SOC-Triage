import httpx

from .base import IntelProvider, RateLimiter


class OTXProvider(IntelProvider):
    name = "otx"
    supported_types = {"ip", "hash", "domain"}

    _paths = {"ip": "IPv4", "hash": "file", "domain": "domain"}

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.limiter = RateLimiter(min_interval_seconds=1.0)

    async def lookup(self, ioc_type: str, value: str) -> dict:
        await self.limiter.wait()
        url = f"https://otx.alienvault.com/api/v1/indicators/{self._paths[ioc_type]}/{value}/general"
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, headers={"X-OTX-API-KEY": self.api_key})
        if resp.status_code == 404:
            return {"provider": self.name, "verdict": "unknown", "score": 0,
                    "summary": "Not found in OTX", "details": {}, "link": ""}
        resp.raise_for_status()
        data = resp.json()
        pulses = data.get("pulse_info", {}).get("count", 0)
        pulse_names = [p.get("name", "") for p in data.get("pulse_info", {}).get("pulses", [])[:5]]

        # Pulse counts are noisy for common infrastructure (cloud/DNS IPs land in
        # bulk IOC dumps), so require more corroboration than other providers.
        score = min(100, pulses * 8)
        verdict = "malicious" if pulses >= 10 else "suspicious" if pulses >= 3 else "clean"
        return {
            "provider": self.name,
            "verdict": verdict,
            "score": score,
            "summary": f"Appears in {pulses} OTX threat pulses",
            "details": {"pulse_count": pulses, "pulses": pulse_names},
            "link": f"https://otx.alienvault.com/indicator/{self._paths[ioc_type].lower()}/{value}",
        }
