import json
import re
from abc import ABC, abstractmethod

REQUIRED_KEYS = {
    "summary", "attack_stage", "mitre_techniques",
    "false_positive_likelihood", "recommended_actions", "confidence",
}


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def complete(self, system: str, user: str) -> str:
        """Return raw model text for the given prompts."""


def parse_analysis(text: str) -> dict:
    """Extract and validate the JSON analysis object from model output."""
    # Strip markdown fences if the model added them anyway
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object in model output")
    data = json.loads(match.group(0))
    missing = REQUIRED_KEYS - data.keys()
    if missing:
        raise ValueError(f"Missing keys in analysis: {missing}")
    if not isinstance(data["recommended_actions"], list):
        data["recommended_actions"] = [str(data["recommended_actions"])]
    if not isinstance(data["mitre_techniques"], list):
        data["mitre_techniques"] = [str(data["mitre_techniques"])]
    return data
