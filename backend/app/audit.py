from sqlalchemy.ext.asyncio import AsyncSession

from .models import AuditLog


async def record(
    db: AsyncSession,
    actor: str,
    action: str,
    target_type: str,
    target_id: str | int,
    details: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            details=details or {},
        )
    )
    await db.commit()
