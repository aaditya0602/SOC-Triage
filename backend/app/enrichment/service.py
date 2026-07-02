"""Enrichment orchestrator: fans IOCs out to providers, caches results in DB."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import EnrichmentCache
from .abuseipdb import AbuseIPDBProvider
from .base import IntelProvider
from .mock import MockProvider
from .otx import OTXProvider
from .virustotal import VirusTotalProvider

log = logging.getLogger(__name__)

# Providers hold rate-limiter state, so build once per process.
_providers: list[IntelProvider] | None = None


def get_providers() -> list[IntelProvider]:
    global _providers
    if _providers is None:
        settings = get_settings()
        if settings.mock_enrichment:
            _providers = [MockProvider("virustotal"), MockProvider("otx"), MockProvider("abuseipdb")]
        else:
            _providers = []
            if settings.virustotal_api_key:
                _providers.append(VirusTotalProvider(settings.virustotal_api_key))
            if settings.otx_api_key:
                _providers.append(OTXProvider(settings.otx_api_key))
            if settings.abuseipdb_api_key:
                _providers.append(AbuseIPDBProvider(settings.abuseipdb_api_key))
            if not _providers:
                log.warning("No threat-intel API keys configured — falling back to mock enrichment")
                _providers = [MockProvider("virustotal"), MockProvider("otx"), MockProvider("abuseipdb")]
    return _providers


def reset_providers() -> None:
    global _providers
    _providers = None


async def _cached(db: AsyncSession, provider: str, ioc_value: str) -> dict | None:
    ttl = timedelta(hours=get_settings().enrichment_cache_ttl_hours)
    cutoff = datetime.now(timezone.utc) - ttl
    row = await db.scalar(
        select(EnrichmentCache)
        .where(EnrichmentCache.provider == provider, EnrichmentCache.ioc_value == ioc_value)
        .order_by(EnrichmentCache.fetched_at.desc())
        .limit(1)
    )
    if row is None:
        return None
    fetched = row.fetched_at if row.fetched_at.tzinfo else row.fetched_at.replace(tzinfo=timezone.utc)
    if fetched < cutoff:
        await db.execute(delete(EnrichmentCache).where(EnrichmentCache.id == row.id))
        return None
    return {**row.result, "cached": True}


async def _lookup_one(db: AsyncSession, provider: IntelProvider, ioc: dict) -> dict | None:
    cached = await _cached(db, provider.name, ioc["value"])
    if cached is not None:
        return cached
    try:
        result = await provider.lookup(ioc["type"], ioc["value"])
    except Exception as exc:
        log.warning("Enrichment failed provider=%s ioc=%s: %s", provider.name, ioc["value"], exc)
        return {"provider": provider.name, "verdict": "unknown", "score": 0,
                "summary": f"Lookup failed: {type(exc).__name__}", "details": {}, "link": "", "error": True}
    db.add(EnrichmentCache(ioc_type=ioc["type"], ioc_value=ioc["value"], provider=provider.name, result=result))
    return result


async def enrich_iocs(db: AsyncSession, iocs: list[dict]) -> dict:
    """Returns {ioc_value: {"type": ..., "results": {provider: result}}}."""
    providers = get_providers()
    enrichment: dict[str, dict] = {}
    for ioc in iocs:
        # Sequential: one AsyncSession can't run concurrent statements, and
        # free-tier rate limits serialize the providers regardless.
        results: dict[str, dict] = {}
        for provider in providers:
            if not provider.supports(ioc["type"]):
                continue
            result = await _lookup_one(db, provider, ioc)
            if result is not None:
                results[provider.name] = result
        enrichment[ioc["value"]] = {"type": ioc["type"], "results": results}
    await db.commit()
    return enrichment


def max_intel_score(enrichment: dict) -> tuple[int, int]:
    """Returns (max provider score 0-100, count of malicious verdicts)."""
    max_score = 0
    malicious_count = 0
    for entry in enrichment.values():
        for result in entry.get("results", {}).values():
            max_score = max(max_score, result.get("score", 0))
            if result.get("verdict") == "malicious":
                malicious_count += 1
    return max_score, malicious_count
