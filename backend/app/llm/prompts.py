import json

SYSTEM_PROMPT = """You are a senior SOC (Security Operations Center) analyst assisting with alert triage.
Given a security alert with threat-intelligence enrichment, produce a JSON object with EXACTLY these keys:

{
  "summary": "2-4 sentence plain-English explanation of what happened and why it matters",
  "attack_stage": "one of: reconnaissance, initial-access, execution, persistence, privilege-escalation, lateral-movement, exfiltration, command-and-control, impact, benign",
  "mitre_techniques": ["T1110 Brute Force", ...],
  "false_positive_likelihood": "low | medium | high",
  "recommended_actions": ["ordered, specific next steps for the analyst", ...],
  "confidence": "low | medium | high"
}

Rules:
- false_positive_likelihood measures how likely the alert is BENIGN NOISE, not the threat level:
  "low" = almost certainly a REAL attack (e.g. confirmed-malicious IOC, C2 traffic, malware hash);
  "high" = almost certainly harmless (e.g. routine successful login, clean indicators, low-severity rule).
  A high-severity alert with malicious threat intel MUST be "low".
- Be specific: reference the actual IPs, users, hashes from the alert.
- recommended_actions: 3-5 concrete steps (e.g. "Block 1.2.3.4 at the perimeter firewall", not "investigate further").
- If threat intel shows the indicator is clean and the rule is low-severity, say so and mark false_positive_likelihood high.
- If past analyst verdicts are provided, weigh them: repeated dismissals of the same rule suggest a false positive pattern.
- Output ONLY the JSON object, no markdown fences, no commentary."""


def build_user_prompt(alert_ctx: dict, enrichment: dict, score: float, band: str,
                      past_verdicts: list[dict]) -> str:
    intel_lines = []
    for ioc_value, entry in enrichment.items():
        for provider, result in entry.get("results", {}).items():
            intel_lines.append(
                f"- {entry['type']} {ioc_value} [{provider}]: {result.get('verdict')} — {result.get('summary')}"
            )
    intel_block = "\n".join(intel_lines) or "- No threat intel results (no external IOCs found)"

    verdict_block = ""
    if past_verdicts:
        lines = [
            f"- {v['action']} by {v['actor']}: \"{v.get('note', '')}\""
            for v in past_verdicts
        ]
        verdict_block = "\nPast analyst verdicts on similar alerts (same rule):\n" + "\n".join(lines)

    return f"""ALERT
Rule: [{alert_ctx['rule_id']}] level {alert_ctx['rule_level']} — {alert_ctx['rule_description']}
Groups: {', '.join(alert_ctx['rule_groups'])}
Agent: {alert_ctx['agent_name']} ({alert_ctx['agent_ip']})
Source IP: {alert_ctx['src_ip']}  Dest IP: {alert_ctx['dst_ip']}  User: {alert_ctx['src_user']}
Wazuh MITRE hints: {json.dumps(alert_ctx['mitre'])}
Computed severity: {score}/100 ({band})

Log line:
{alert_ctx['full_log'][:1500]}

Threat intelligence:
{intel_block}
{verdict_block}

Respond with the JSON object only."""
