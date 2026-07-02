"""Deterministic severity scoring.

score = rule component (0-55)   — Wazuh rule level 0-15 scaled
      + intel component (0-35)  — worst threat-intel verdict across IOCs
      + context bonus (0-10)    — multiple malicious IOCs, sensitive rule groups

Bands: P1 >= 80 (critical), P2 >= 60 (high), P3 >= 35 (medium), P4 < 35 (low).
"""

from ..enrichment.service import max_intel_score

SENSITIVE_GROUPS = {
    "authentication_failed", "authentication_failures", "ransomware",
    "rootkit", "malware", "exploit", "web_attack", "sql_injection",
    "privilege_escalation", "account_manipulation", "lateral_movement",
}


def score_alert(rule_level: int, rule_groups: list, enrichment: dict) -> tuple[float, str, dict]:
    rule_component = min(55.0, (rule_level / 15.0) * 55.0)

    intel_max, malicious_count, suspicious_count = max_intel_score(enrichment)
    # A malicious verdict matters even when the provider's numeric score is low
    # (e.g. VT "4/91 engines" scores ~11 but the IP is confirmed bad) — floor it.
    effective_intel = intel_max
    if malicious_count >= 1:
        effective_intel = max(effective_intel, 60)
    elif suspicious_count >= 1:
        effective_intel = max(effective_intel, 30)
    intel_component = (effective_intel / 100.0) * 35.0

    bonus = 0.0
    if malicious_count >= 2:
        bonus += 5.0
    if any(g in SENSITIVE_GROUPS for g in rule_groups):
        bonus += 5.0
    bonus = min(10.0, bonus)

    total = round(min(100.0, rule_component + intel_component + bonus), 1)

    if total >= 80:
        band = "P1"
    elif total >= 60:
        band = "P2"
    elif total >= 35:
        band = "P3"
    else:
        band = "P4"

    breakdown = {
        "rule_component": round(rule_component, 1),
        "intel_component": round(intel_component, 1),
        "context_bonus": round(bonus, 1),
        "intel_max_score": intel_max,
        "effective_intel_score": effective_intel,
        "malicious_ioc_count": malicious_count,
        "suspicious_ioc_count": suspicious_count,
    }
    return total, band, breakdown
