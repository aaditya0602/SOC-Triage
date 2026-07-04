from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..auth import current_user
from ..database import get_db
from ..llm.service import analyze_alert
from ..models import Alert, Incident
from ..schemas import AlertListOut, AlertOut, TriageRequest
from ..ws import manager

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

TRIAGE_ACTIONS = {"escalate": "escalated", "dismiss": "dismissed",
                  "investigate": "investigating", "reopen": "new"}


@router.get("", response_model=AlertListOut)
async def list_alerts(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(current_user),
    status: str | None = None,
    band: str | None = None,
    search: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    query = select(Alert)
    if status:
        query = query.where(Alert.status == status)
    if band:
        query = query.where(Alert.severity_band == band)
    if search:
        like = f"%{search}%"
        query = query.where(or_(
            Alert.rule_description.ilike(like),
            Alert.src_ip.ilike(like),
            Alert.agent_name.ilike(like),
            Alert.rule_id.ilike(like),
        ))
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = (await db.execute(
        query.order_by(Alert.received_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return AlertListOut(total=total or 0, items=[AlertOut.model_validate(a) for a in rows])


@router.get("/{alert_id}", response_model=AlertOut)
async def get_alert(alert_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(current_user)):
    alert = await db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertOut.model_validate(alert)


@router.post("/{alert_id}/reanalyze", response_model=AlertOut)
async def reanalyze_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(current_user),
):
    """Re-run the LLM analysis — used when an alert got a mock fallback or the
    analyst wants a second opinion after new triage context accumulated."""
    alert = await db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.llm_analysis = await analyze_alert(db, alert)
    await db.commit()
    await record(db, actor=user["username"], action="alert.reanalyze", target_type="alert",
                 target_id=alert.id, details={"provider": alert.llm_analysis.get("provider")})
    await manager.broadcast("alert.updated", AlertOut.model_validate(alert).model_dump(mode="json"))
    return AlertOut.model_validate(alert)


@router.post("/{alert_id}/triage", response_model=AlertOut)
async def triage_alert(
    alert_id: int,
    body: TriageRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(current_user),
):
    if body.action not in TRIAGE_ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown action. Valid: {list(TRIAGE_ACTIONS)}")
    alert = await db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = TRIAGE_ACTIONS[body.action]
    alert.triage_note = body.note
    alert.triaged_by = user["username"]
    alert.triaged_at = datetime.now(timezone.utc)

    # Close the incident if every alert in it is resolved
    if alert.incident_id:
        incident = await db.get(Incident, alert.incident_id)
        if incident:
            open_count = await db.scalar(
                select(func.count()).select_from(Alert).where(
                    Alert.incident_id == incident.id,
                    Alert.status.in_(["new", "investigating"]),
                    Alert.id != alert.id,
                )
            )
            still_open = (open_count or 0) > 0 or alert.status in ("new", "investigating")
            incident.status = "open" if still_open else "closed"

    await db.commit()
    await record(db, actor=user["username"], action=f"alert.{body.action}", target_type="alert",
                 target_id=alert.id, details={"note": body.note, "rule_id": alert.rule_id})
    await manager.broadcast("alert.updated", AlertOut.model_validate(alert).model_dump(mode="json"))
    return AlertOut.model_validate(alert)
