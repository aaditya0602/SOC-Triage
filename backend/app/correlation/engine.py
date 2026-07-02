"""Group related alerts into incidents.

Correlation key: source IP (or agent) + primary rule group. Alerts sharing a
key within the correlation window attach to the same open incident.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Alert, Incident


def correlation_key(alert: Alert) -> str:
    actor = alert.src_ip or alert.agent_name or "unknown"
    group = alert.rule_groups[0] if alert.rule_groups else (alert.rule_id or "misc")
    return f"{actor}:{group}"


async def correlate(db: AsyncSession, alert: Alert) -> Incident:
    key = correlation_key(alert)
    window = timedelta(minutes=get_settings().correlation_window_minutes)
    cutoff = datetime.now(timezone.utc) - window

    incident = await db.scalar(
        select(Incident)
        .where(Incident.correlation_key == key, Incident.status == "open", Incident.last_seen >= cutoff)
        .order_by(Incident.last_seen.desc())
        .limit(1)
    )
    if incident is None:
        actor = alert.src_ip or alert.agent_name or "unknown source"
        incident = Incident(
            correlation_key=key,
            title=f"{alert.rule_description[:180]} — {actor}",
            first_seen=alert.event_time,
            status="open",
            alert_count=0,
            max_severity=0.0,
        )
        db.add(incident)

    incident.last_seen = datetime.now(timezone.utc)
    incident.alert_count += 1
    incident.max_severity = max(incident.max_severity, alert.severity_score)
    alert.incident = incident
    await db.flush()
    return incident
