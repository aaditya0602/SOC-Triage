"""Pipeline orchestrator: normalize -> enrich -> score -> correlate -> LLM -> broadcast.

Runs as a background task per alert so the ingest webhook returns immediately.
"""

import logging

from .correlation.engine import correlate
from .database import SessionLocal
from .enrichment.service import enrich_iocs
from .llm.service import analyze_alert
from .models import Alert
from .schemas import AlertOut
from .scoring.engine import score_alert
from .ws import manager

log = logging.getLogger(__name__)


async def _broadcast_alert(alert: Alert, event: str) -> None:
    await manager.broadcast(event, AlertOut.model_validate(alert).model_dump(mode="json"))


async def process_alert(alert_id: int) -> None:
    async with SessionLocal() as db:
        alert = await db.get(Alert, alert_id)
        if alert is None:
            log.error("Pipeline: alert %s vanished", alert_id)
            return
        try:
            alert.pipeline_status = "enriching"
            await db.commit()
            await _broadcast_alert(alert, "alert.updated")

            alert.enrichment = await enrich_iocs(db, alert.iocs)

            score, band, breakdown = score_alert(alert.rule_level, alert.rule_groups, alert.enrichment)
            alert.severity_score = score
            alert.severity_band = band
            alert.score_breakdown = breakdown

            await correlate(db, alert)

            alert.pipeline_status = "analyzing"
            await db.commit()
            await _broadcast_alert(alert, "alert.updated")

            alert.llm_analysis = await analyze_alert(db, alert)
            alert.pipeline_status = "complete"
            await db.commit()
            await _broadcast_alert(alert, "alert.completed")
            log.info("Pipeline complete alert=%s score=%s band=%s", alert.id, score, band)
        except Exception:
            log.exception("Pipeline failed for alert %s", alert_id)
            alert.pipeline_status = "failed"
            await db.commit()
            await _broadcast_alert(alert, "alert.updated")
