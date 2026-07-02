from app.ingest.normalizer import extract_iocs, normalize

WAZUH_ALERT = {
    "id": "1719958800.12345",
    "timestamp": "2026-07-02T10:00:00.000+0000",
    "rule": {
        "id": "5763",
        "level": 10,
        "description": "sshd: brute force attack",
        "groups": ["syslog", "sshd", "authentication_failures"],
        "mitre": {"id": ["T1110"], "tactic": ["Credential Access"], "technique": ["Brute Force"]},
    },
    "agent": {"id": "001", "name": "web-01", "ip": "10.0.1.10"},
    "data": {"srcip": "185.220.101.45", "srcuser": "root"},
    "full_log": "Failed password for root from 185.220.101.45 port 48213 ssh2",
}


def test_normalize_maps_fields():
    alert = normalize(WAZUH_ALERT)
    assert alert.rule_id == "5763"
    assert alert.rule_level == 10
    assert alert.src_ip == "185.220.101.45"
    assert alert.src_user == "root"
    assert alert.mitre["ids"] == ["T1110"]
    assert alert.agent_name == "web-01"


def test_extract_public_ip_only():
    iocs = extract_iocs(WAZUH_ALERT, WAZUH_ALERT["full_log"])
    values = {i["value"] for i in iocs}
    assert "185.220.101.45" in values
    assert "10.0.1.10" not in values  # private, never enriched


def test_extract_hash_and_domain():
    log = "dropped 275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f contacting evil.badactor.xyz"
    iocs = extract_iocs({}, log)
    types = {i["type"] for i in iocs}
    assert "hash" in types
    assert "domain" in types


def test_syscheck_hash_extracted():
    payload = {"syscheck": {"sha256_after": "a" * 64}}
    iocs = extract_iocs(payload, "")
    assert any(i["type"] == "hash" and i["value"] == "a" * 64 for i in iocs)
