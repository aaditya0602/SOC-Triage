import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Alert, AuditLog
from .anthropic_provider import AnthropicProvider
from .base import LLMProvider, parse_analysis
from .mock_provider import MockLLMProvider
from .ollama_provider import OllamaProvider
from .prompts import SYSTEM_PROMPT, build_user_prompt

log = logging.getLogger(__name__)

_provider: LLMProvider | None = None

# Local models serve one request well but degrade badly under concurrency:
# simultaneous pipeline tasks queue inside Ollama until they blow the HTTP
# timeout and everything falls back to mock. Serialize instead.
_llm_gate = asyncio.Semaphore(1)


def get_llm() -> LLMProvider:
    global _provider
    if _provider is None:
        settings = get_settings()
        if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
            _provider = AnthropicProvider(settings.anthropic_api_key, settings.anthropic_model)
        elif settings.llm_provider == "ollama":
            _provider = OllamaProvider(settings.ollama_base_url, settings.ollama_model)
        else:
            _provider = MockLLMProvider()
    return _provider


def reset_llm() -> None:
    global _provider
    _provider = None


async def _past_verdicts(db: AsyncSession, alert: Alert, limit: int = 3) -> list[dict]:
    """Feedback loop: past triage decisions on the same rule inform the analysis."""
    if not alert.rule_id:
        return []
    rows = (
        await db.execute(
            select(Alert.status, Alert.triaged_by, Alert.triage_note)
            .where(
                Alert.rule_id == alert.rule_id,
                Alert.id != alert.id,
                Alert.triaged_by.is_not(None),
            )
            .order_by(Alert.triaged_at.desc())
            .limit(limit)
        )
    ).all()
    return [{"action": r[0], "actor": r[1], "note": r[2] or ""} for r in rows]


async def analyze_alert(db: AsyncSession, alert: Alert) -> dict:
    provider = get_llm()
    alert_ctx = {
        "rule_id": alert.rule_id,
        "rule_level": alert.rule_level,
        "rule_description": alert.rule_description,
        "rule_groups": alert.rule_groups,
        "agent_name": alert.agent_name,
        "agent_ip": alert.agent_ip,
        "src_ip": alert.src_ip,
        "dst_ip": alert.dst_ip,
        "src_user": alert.src_user,
        "mitre": alert.mitre,
        "full_log": alert.full_log,
    }
    past = await _past_verdicts(db, alert)
    user_prompt = build_user_prompt(alert_ctx, alert.enrichment, alert.severity_score, alert.severity_band, past)

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            async with _llm_gate:
                raw = await provider.complete(SYSTEM_PROMPT, user_prompt)
            analysis = parse_analysis(raw)
            analysis["provider"] = provider.name
            analysis["past_verdicts_considered"] = len(past)
            return analysis
        except Exception as exc:
            last_error = exc
            log.warning("LLM analysis attempt %d failed (%s): %s", attempt + 1, provider.name, exc)

    # Final fallback: mock provider never fails
    log.error("LLM provider %s unavailable, using mock analysis: %s", provider.name, last_error)
    raw = await MockLLMProvider().complete(SYSTEM_PROMPT, user_prompt)
    analysis = parse_analysis(raw)
    analysis["provider"] = f"mock (fallback from {provider.name})"
    analysis["past_verdicts_considered"] = len(past)
    return analysis
