from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class TriageRequest(BaseModel):
    action: str  # escalate | dismiss | investigate | reopen
    note: str = ""


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    correlation_key: str
    title: str
    status: str
    first_seen: datetime
    last_seen: datetime
    alert_count: int
    max_severity: float


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: str | None
    source: str
    rule_id: str | None
    rule_level: int
    rule_description: str
    rule_groups: list
    mitre: dict
    agent_name: str | None
    agent_ip: str | None
    src_ip: str | None
    dst_ip: str | None
    src_user: str | None
    full_log: str
    event_time: datetime
    received_at: datetime
    iocs: list
    enrichment: dict
    severity_score: float
    severity_band: str
    score_breakdown: dict
    llm_analysis: dict
    pipeline_status: str
    status: str
    triage_note: str | None
    triaged_by: str | None
    triaged_at: datetime | None
    incident_id: int | None


class AlertListOut(BaseModel):
    total: int
    items: list[AlertOut]


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    actor: str
    action: str
    target_type: str
    target_id: str
    details: dict
