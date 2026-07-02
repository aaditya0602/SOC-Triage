from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(128), index=True)
    source: Mapped[str] = mapped_column(String(32), default="wazuh")  # wazuh | simulator
    rule_id: Mapped[str | None] = mapped_column(String(32), index=True)
    rule_level: Mapped[int] = mapped_column(Integer, default=0)
    rule_description: Mapped[str] = mapped_column(Text, default="")
    rule_groups: Mapped[list] = mapped_column(JSON, default=list)
    mitre: Mapped[dict] = mapped_column(JSON, default=dict)  # {ids: [], tactics: [], techniques: []}
    agent_name: Mapped[str | None] = mapped_column(String(128))
    agent_ip: Mapped[str | None] = mapped_column(String(64))
    src_ip: Mapped[str | None] = mapped_column(String(64), index=True)
    dst_ip: Mapped[str | None] = mapped_column(String(64))
    src_user: Mapped[str | None] = mapped_column(String(128))
    full_log: Mapped[str] = mapped_column(Text, default="")
    raw: Mapped[dict] = mapped_column(JSON, default=dict)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    iocs: Mapped[list] = mapped_column(JSON, default=list)  # [{type, value}]
    enrichment: Mapped[dict] = mapped_column(JSON, default=dict)  # {ioc_value: {provider: result}}
    severity_score: Mapped[float] = mapped_column(Float, default=0.0)
    severity_band: Mapped[str] = mapped_column(String(4), default="P4", index=True)
    score_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    llm_analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    pipeline_status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|enriching|analyzing|complete|failed

    status: Mapped[str] = mapped_column(String(16), default="new", index=True)  # new|investigating|escalated|dismissed
    triage_note: Mapped[str | None] = mapped_column(Text)
    triaged_by: Mapped[str | None] = mapped_column(String(64))
    triaged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id"), index=True)
    incident: Mapped["Incident | None"] = relationship(back_populates="alerts")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    correlation_key: Mapped[str] = mapped_column(String(256), index=True)
    title: Mapped[str] = mapped_column(String(256))
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)  # open|closed
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    alert_count: Mapped[int] = mapped_column(Integer, default=0)
    max_severity: Mapped[float] = mapped_column(Float, default=0.0)

    alerts: Mapped[list["Alert"]] = relationship(back_populates="incident")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(64), index=True)
    target_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[str] = mapped_column(String(64))
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class EnrichmentCache(Base):
    __tablename__ = "enrichment_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    ioc_type: Mapped[str] = mapped_column(String(16))
    ioc_value: Mapped[str] = mapped_column(String(512), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(16), default="analyst")
