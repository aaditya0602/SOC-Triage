from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import current_user
from ..database import get_db
from ..models import Alert, Incident
from ..schemas import AlertOut, IncidentOut

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentOut])
async def list_incidents(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(current_user),
    status: str | None = None,
    limit: int = 100,
):
    query = select(Incident).order_by(Incident.last_seen.desc()).limit(limit)
    if status:
        query = query.where(Incident.status == status)
    rows = (await db.execute(query)).scalars().all()
    return [IncidentOut.model_validate(i) for i in rows]


@router.get("/{incident_id}")
async def get_incident(incident_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(current_user)):
    incident = await db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    alerts = (await db.execute(
        select(Alert).where(Alert.incident_id == incident_id).order_by(Alert.received_at.desc())
    )).scalars().all()
    return {
        "incident": IncidentOut.model_validate(incident).model_dump(mode="json"),
        "alerts": [AlertOut.model_validate(a).model_dump(mode="json") for a in alerts],
    }
