"""Demo seeding for hosted environments where the CLI simulator can't run.

Guarded by the same analyst auth as everything else; generates one round of
the standard attack scenarios through the real pipeline.
"""

import importlib.util
import sys
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..auth import current_user
from ..database import get_db
from ..ingest.normalizer import normalize
from ..pipeline import process_alert
from ..schemas import AlertOut
from ..ws import manager

router = APIRouter(prefix="/api/demo", tags=["demo"])


def _scenarios():
    """Load scenario builders from scripts/simulator.py without duplicating them."""
    here = Path(__file__).resolve()
    # repo layout: backend/app/api/demo.py -> ../../../scripts
    # demo image:  /app/app/api/demo.py    -> ../../scripts
    path = next(
        (p / "scripts" / "simulator.py"
         for p in (here.parents[3], here.parents[2])
         if (p / "scripts" / "simulator.py").is_file()),
        None,
    )
    if path is None:
        raise HTTPException(status_code=503, detail="Simulator scenarios not bundled in this deployment")
    spec = importlib.util.spec_from_file_location("soc_simulator", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("soc_simulator", module)
    spec.loader.exec_module(module)
    return module.SCENARIOS


@router.post("/seed", status_code=202)
async def seed_demo(
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(current_user),
):
    created = []
    for build in _scenarios().values():
        payload = build()
        payload.pop("_simulator", None)
        alert = normalize(payload, source="simulator")
        db.add(alert)
        await db.commit()
        created.append(alert.id)
        await manager.broadcast("alert.created", AlertOut.model_validate(alert).model_dump(mode="json"))
        background.add_task(process_alert, alert.id)
    await record(db, actor=user["username"], action="demo.seed", target_type="alert",
                 target_id=",".join(map(str, created)), details={"count": len(created)})
    return {"created": created}
