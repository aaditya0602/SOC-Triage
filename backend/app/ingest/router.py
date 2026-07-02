from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..config import get_settings
from ..database import get_db
from ..pipeline import process_alert
from ..schemas import AlertOut
from ..ws import manager
from .normalizer import normalize

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


def _check_key(x_api_key: str | None) -> None:
    if x_api_key != get_settings().ingest_api_key:
        raise HTTPException(status_code=401, detail="Invalid ingest API key")


@router.post("/wazuh", status_code=202)
async def ingest_wazuh(
    payload: dict,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_api_key: str | None = Header(default=None),
):
    """Webhook target for the Wazuh integrator (and the simulator)."""
    _check_key(x_api_key)
    source = "simulator" if payload.get("_simulator") else "wazuh"
    payload.pop("_simulator", None)

    alert = normalize(payload, source=source)
    db.add(alert)
    await db.commit()
    await record(db, actor=source, action="alert.ingested", target_type="alert", target_id=alert.id,
                 details={"rule_id": alert.rule_id, "rule_level": alert.rule_level})

    await manager.broadcast("alert.created", AlertOut.model_validate(alert).model_dump(mode="json"))
    background.add_task(process_alert, alert.id)
    return {"id": alert.id, "status": "accepted"}
