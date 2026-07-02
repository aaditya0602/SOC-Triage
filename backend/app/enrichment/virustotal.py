import httpx

from .base import IntelProvider, RateLimiter


class VirusTotalProvider(IntelProvider):
    name = "virustotal"
    supported_types = {"ip", "hash", "domain"}

    _paths = {"ip": "ip_addresses", "hash": "files", "domain": "domains"}

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        # Free tier: 4 requests/minute
        self.limiter = RateLimiter(min_interval_seconds=16.0)

    async def lookup(self, ioc_type: str, value: str) -> dict:
        await self.limiter.wait()
        url = f"https://www.virustotal.com/api/v3/{self._paths[ioc_type]}/{value}"
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, headers={"x-apikey": self.api_key})
        if resp.status_code == 404:
            return {"provider": self.name, "verdict": "unknown", "score": 0,
                    "summary": "Not found in VirusTotal", "details": {}, "link": ""}
        resp.raise_for_status()
        attrs = resp.json()["data"]["attributes"]
        stats = attrs.get("last_analysis_stats", {})
        malicious = stats.get("malicious", 0)
        suspicious = stats.get("suspicious", 0)
        total = sum(stats.values()) or 1

        score = min(100, round(100 * (malicious + 0.5 * suspicious) / max(total * 0.4, 1)))
        verdict = "malicious" if malicious >= 3 else "suspicious" if malicious + suspicious >= 1 else "clean"
        return {
            "provider": self.name,
            "verdict": verdict,
            "score": score,
            "summary": f"{malicious}/{total} engines flag malicious",
            "details": {
                "stats": stats,
                "reputation": attrs.get("reputation"),
                "tags": attrs.get("tags", [])[:10],
                "country": attrs.get("country"),
                "as_owner": attrs.get("as_owner"),
                "meaningful_name": attrs.get("meaningful_name"),
            },
            "link": f"https://www.virustotal.com/gui/search/{value}",
        }
