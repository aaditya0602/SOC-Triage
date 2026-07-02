"""Template-based analysis when no LLM is reachable — keeps the pipeline flowing."""

import json

from .base import LLMProvider


class MockLLMProvider(LLMProvider):
    name = "mock"

    async def complete(self, system: str, user: str) -> str:
        # Crude signal extraction from the prompt itself
        malicious = "malicious" in user
        high_level = any(f"level {n}" in user for n in range(10, 16))

        if malicious and high_level:
            analysis = {
                "summary": "[MOCK ANALYSIS] High-severity rule fired and threat intelligence confirms at least one "
                           "indicator is known-malicious. This alert warrants immediate analyst attention.",
                "attack_stage": "initial-access",
                "mitre_techniques": ["T1110 Brute Force"],
                "false_positive_likelihood": "low",
                "recommended_actions": [
                    "Review the source IP's full activity in the SIEM for the last 24h",
                    "Block the confirmed-malicious indicator at the perimeter",
                    "Check the target account for successful logins after the alert window",
                    "Escalate to incident response if compromise is confirmed",
                ],
                "confidence": "medium",
            }
        elif malicious:
            analysis = {
                "summary": "[MOCK ANALYSIS] Low-level rule but threat intel flags an indicator as malicious. "
                           "Possible early-stage activity; verify before dismissing.",
                "attack_stage": "reconnaissance",
                "mitre_techniques": [],
                "false_positive_likelihood": "medium",
                "recommended_actions": [
                    "Pivot on the flagged indicator across other hosts",
                    "Check firewall logs for related connections",
                    "Monitor the source for repeat activity",
                ],
                "confidence": "low",
            }
        else:
            analysis = {
                "summary": "[MOCK ANALYSIS] No threat-intelligence hits and rule severity is moderate. "
                           "Likely benign or routine noise, but review the log context to confirm.",
                "attack_stage": "benign",
                "mitre_techniques": [],
                "false_positive_likelihood": "high",
                "recommended_actions": [
                    "Verify the activity matches expected behavior for this host",
                    "Dismiss if consistent with known-good patterns",
                    "Consider tuning the rule if this fires frequently",
                ],
                "confidence": "low",
            }
        return json.dumps(analysis)
