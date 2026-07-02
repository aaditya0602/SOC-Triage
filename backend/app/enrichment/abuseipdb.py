import httpx

from .base import IntelProvider, RateLimiter


class AbuseIPDBProvider(IntelProvider):
    name = "abuseipdb"
    supported_types = {"ip"}

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.limiter = RateLimiter(min_interval_seconds=1.0)

    async def lookup(self, ioc_type: str, value: str) -> dict:
        await self.limiter.wait()
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                params={"ipAddress": value, "maxAgeInDays": 90},
                headers={"Key": self.api_key, "Accept": "application/json"},
            )
        resp.raise_for_status()
        data = resp.json()["data"]
        confidence = data.get("abuseConfidenceScore", 0)

        verdict = "malicious" if confidence >= 75 else "suspicious" if confidence >= 25 else "clean"
        return {
            "provider": self.name,
            "verdict": verdict,
            "score": confidence,
            "summary": f"Abuse confidence {confidence}%, {data.get('totalReports', 0)} reports",
            "details": {
                "abuse_confidence": confidence,
                "total_reports": data.get("totalReports"),
                "country": data.get("countryCode"),
                "isp": data.get("isp"),
                "usage_type": data.get("usageType"),
                "is_tor": data.get("isTor"),
            },
            "link": f"https://www.abuseipdb.com/check/{value}",
        }
