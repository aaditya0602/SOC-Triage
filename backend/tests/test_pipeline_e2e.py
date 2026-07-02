"""End-to-end pipeline test against an in-memory DB with mock intel + mock LLM."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app import database
from app.correlation.engine import correlate
from app.database import Base
from app.enrichment import service as enrichment_service
from app.enrichment.mock import MockProvider
from app.ingest.normalizer import normalize
from app.scoring.engine import score_alert
from tests.test_normalizer import WAZUH_ALERT


@pytest_asyncio.fixture
async def db_session(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(database, "SessionLocal", factory)
    monkeypatch.setattr(enrichment_service, "_providers", [MockProvider("virustotal")])
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_full_pipeline_stages(db_session):
    alert = normalize(WAZUH_ALERT)
    db_session.add(alert)
    await db_session.commit()

    # enrich — 185.220.101.45 is in the mock KNOWN_BAD list
    alert.enrichment = await enrichment_service.enrich_iocs(db_session, alert.iocs)
    ip_results = alert.enrichment["185.220.101.45"]["results"]
    assert ip_results["virustotal"]["verdict"] == "malicious"

    # score
    alert.severity_score, alert.severity_band, alert.score_breakdown = score_alert(
        alert.rule_level, alert.rule_groups, alert.enrichment
    )
    assert alert.severity_band in ("P1", "P2")

    # correlate — same key groups into one incident
    incident1 = await correlate(db_session, alert)
    alert2 = normalize(WAZUH_ALERT)
    db_session.add(alert2)
    await db_session.flush()
    incident2 = await correlate(db_session, alert2)
    assert incident1.id == incident2.id
    assert incident2.alert_count == 2


@pytest.mark.asyncio
async def test_enrichment_cache_hit(db_session):
    iocs = [{"type": "ip", "value": "185.220.101.45"}]
    first = await enrichment_service.enrich_iocs(db_session, iocs)
    second = await enrichment_service.enrich_iocs(db_session, iocs)
    assert not first["185.220.101.45"]["results"]["virustotal"].get("cached")
    assert second["185.220.101.45"]["results"]["virustotal"]["cached"] is True
