"""Convert raw Wazuh alert JSON into a normalized Alert row and extract IOCs."""

import ipaddress
import re
from datetime import datetime, timezone

from ..models import Alert

_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_SHA256_RE = re.compile(r"\b[a-fA-F0-9]{64}\b")
_MD5_RE = re.compile(r"\b[a-fA-F0-9]{32}\b")
_DOMAIN_RE = re.compile(
    r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|info|io|ru|cn|xyz|top|biz|cc|pw|su|onion|zip|mov)\b",
    re.IGNORECASE,
)


def _is_public_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        return False
    return not (ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_multicast or ip.is_link_local)


def extract_iocs(alert_data: dict, full_log: str) -> list[dict]:
    """Pull observable indicators out of the alert for enrichment."""
    iocs: dict[tuple[str, str], dict] = {}

    def add(ioc_type: str, value: str, public_only: bool = False) -> None:
        value = value.strip()
        if not value:
            return
        if ioc_type == "ip" and public_only and not _is_public_ip(value):
            return
        iocs[(ioc_type, value.lower())] = {"type": ioc_type, "value": value}

    data = alert_data.get("data", {})
    for key in ("srcip", "src_ip"):
        if data.get(key):
            add("ip", data[key], public_only=True)
    for key in ("dstip", "dst_ip"):
        if data.get(key):
            add("ip", data[key], public_only=True)

    # Syscheck (FIM) file hashes
    syscheck = alert_data.get("syscheck", {})
    for field in ("sha256_after", "sha256_before"):
        if syscheck.get(field):
            add("hash", syscheck[field])
    for field in ("md5_after", "md5_before"):
        if syscheck.get(field):
            add("hash", syscheck[field])

    # Free-text scan of the log line
    for ip in _IP_RE.findall(full_log):
        add("ip", ip, public_only=True)
    for h in _SHA256_RE.findall(full_log):
        add("hash", h)
    for h in _MD5_RE.findall(full_log):
        add("hash", h)
    for domain in _DOMAIN_RE.findall(full_log):
        add("domain", domain)

    return list(iocs.values())


def _parse_timestamp(value: str | None) -> datetime:
    if value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def normalize(payload: dict, source: str = "wazuh") -> Alert:
    """Map a Wazuh alert document to our Alert model."""
    rule = payload.get("rule", {})
    agent = payload.get("agent", {})
    data = payload.get("data", {})
    full_log = payload.get("full_log", "") or ""

    mitre_raw = rule.get("mitre", {})
    mitre = {
        "ids": mitre_raw.get("id", []),
        "tactics": mitre_raw.get("tactic", []),
        "techniques": mitre_raw.get("technique", []),
    }

    src_ip = data.get("srcip") or data.get("src_ip")
    dst_ip = data.get("dstip") or data.get("dst_ip")

    return Alert(
        external_id=payload.get("id"),
        source=source,
        rule_id=str(rule.get("id", "")) or None,
        rule_level=int(rule.get("level", 0)),
        rule_description=rule.get("description", ""),
        rule_groups=rule.get("groups", []),
        mitre=mitre,
        agent_name=agent.get("name"),
        agent_ip=agent.get("ip"),
        src_ip=src_ip,
        dst_ip=dst_ip,
        src_user=data.get("srcuser") or data.get("dstuser") or data.get("user"),
        full_log=full_log,
        raw=payload,
        event_time=_parse_timestamp(payload.get("timestamp")),
        iocs=extract_iocs(payload, full_log),
    )
