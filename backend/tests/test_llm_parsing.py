import json

import pytest

from app.llm.base import parse_analysis

VALID = {
    "summary": "Brute force attack from known-bad IP.",
    "attack_stage": "initial-access",
    "mitre_techniques": ["T1110 Brute Force"],
    "false_positive_likelihood": "low",
    "recommended_actions": ["Block the IP"],
    "confidence": "high",
}


def test_parses_clean_json():
    result = parse_analysis(json.dumps(VALID))
    assert result["summary"].startswith("Brute force")


def test_strips_markdown_fences():
    result = parse_analysis(f"```json\n{json.dumps(VALID)}\n```")
    assert result["confidence"] == "high"


def test_extracts_json_from_chatter():
    text = "Here is my analysis:\n" + json.dumps(VALID) + "\nHope that helps!"
    result = parse_analysis(text)
    assert result["attack_stage"] == "initial-access"


def test_rejects_missing_keys():
    with pytest.raises(ValueError):
        parse_analysis(json.dumps({"summary": "incomplete"}))


def test_coerces_scalar_actions_to_list():
    payload = {**VALID, "recommended_actions": "Block the IP"}
    result = parse_analysis(json.dumps(payload))
    assert result["recommended_actions"] == ["Block the IP"]
