from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import current_user
from ..database import get_db
from ..models import Alert, AuditLog, Incident
from ..schemas import AuditOut

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db), user: dict = Depends(current_user)):
    def count_where(*conditions):
        return db.scalar(select(func.count()).select_from(Alert).where(*conditions))

    total = await count_where()
    open_alerts = await count_where(Alert.status.in_(["new", "investigating"]))
    escalated = await count_where(Alert.status == "escalated")
    dismissed = await count_where(Alert.status == "dismissed")

    by_band_rows = (await db.execute(
        select(Alert.severity_band, func.count()).group_by(Alert.severity_band)
    )).all()
    by_status_rows = (await db.execute(
        select(Alert.status, func.count()).group_by(Alert.status)
    )).all()

    top_rules = (await db.execute(
        select(Alert.rule_description, func.count().label("n"))
        .group_by(Alert.rule_description).order_by(func.count().desc()).limit(5)
    )).all()

    open_incidents = await db.scalar(
        select(func.count()).select_from(Incident).where(Incident.status == "open")
    )

    # Alerts per hour, last 24h
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = (await db.execute(
        select(Alert.received_at, Alert.severity_band).where(Alert.received_at >= since)
    )).all()
    buckets: dict[str, int] = {}
    for received_at, _band in recent:
        ts = received_at if received_at.tzinfo else received_at.replace(tzinfo=timezone.utc)
        key = ts.strftime("%H:00")
        buckets[key] = buckets.get(key, 0) + 1
    now = datetime.now(timezone.utc)
    timeline = []
    for i in range(23, -1, -1):
        hour = (now - timedelta(hours=i)).strftime("%H:00")
        timeline.append({"hour": hour, "count": buckets.get(hour, 0)})

    avg_score = await db.scalar(select(func.avg(Alert.severity_score))) or 0

    return {
        "total_alerts": total,
        "open_alerts": open_alerts,
        "escalated": escalated,
        "dismissed": dismissed,
        "open_incidents": open_incidents,
        "avg_severity": round(float(avg_score), 1),
        "by_band": {band: n for band, n in by_band_rows},
        "by_status": {status: n for status, n in by_status_rows},
        "top_rules": [{"rule": r, "count": n} for r, n in top_rules],
        "timeline": timeline,
    }


@router.get("/audit", response_model=list[AuditOut])
async def audit_log(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(current_user),
    limit: int = 100,
):
    rows = (await db.execute(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    )).scalars().all()
    return [AuditOut.model_validate(r) for r in rows]
