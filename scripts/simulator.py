"""Attack-scenario simulator: emits realistic Wazuh-format alerts to the ingest webhook.

Usage:
    python scripts/simulator.py                 # one random scenario
    python scripts/simulator.py --scenario brute_force
    python scripts/simulator.py --all           # every scenario once (demo seed)
    python scripts/simulator.py --stream 30     # continuous, ~every 30s

Scenarios mirror real Wazuh rule IDs/levels so the pipeline sees production-shaped data.
"""

import argparse
import json
import os
import random
import time
import urllib.request
import uuid
from datetime import datetime, timezone

INGEST_URL = os.environ.get("INGEST_URL", "http://localhost:8000/api/ingest/wazuh")
API_KEY = os.environ.get("INGEST_API_KEY", "wazuh-ingest-secret")

AGENTS = [
    {"id": "001", "name": "web-server-01", "ip": "10.0.1.10"},
    {"id": "002", "name": "db-server-01", "ip": "10.0.1.20"},
    {"id": "003", "name": "hr-workstation-07", "ip": "10.0.2.45"},
    {"id": "004", "name": "dc-01", "ip": "10.0.1.5"},
]

# Curated bad IOCs matching enrichment/mock.py KNOWN_BAD (also genuinely dirty on real intel feeds)
BAD_IPS = ["185.220.101.45", "45.155.205.233", "91.240.118.172", "194.26.29.156"]
BAD_HASH = "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f"  # EICAR
BAD_DOMAIN = "malware-c2.badactor.xyz"
BENIGN_IPS = ["8.8.8.8", "140.82.114.4", "52.84.150.39"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def base(agent: dict) -> dict:
    return {
        "id": f"{int(time.time())}.{uuid.uuid4().hex[:8]}",
        "timestamp": now(),
        "agent": agent,
        "manager": {"name": "wazuh-manager"},
        "_simulator": True,
    }


def brute_force() -> dict:
    agent = AGENTS[0]
    src = random.choice(BAD_IPS)
    user = random.choice(["root", "admin", "ubuntu", "oracle"])
    return {
        **base(agent),
        "rule": {
            "id": "5763", "level": 10,
            "description": "sshd: brute force attack detected (multiple authentication failures)",
            "groups": ["syslog", "sshd", "authentication_failures"],
            "mitre": {"id": ["T1110"], "tactic": ["Credential Access"], "technique": ["Brute Force"]},
        },
        "data": {"srcip": src, "srcuser": user, "srcport": str(random.randint(40000, 65000))},
        "full_log": f"{now()} sshd[2571]: Failed password for {user} from {src} port 48213 ssh2 (8 failures in 120s)",
    }


def malware_hash() -> dict:
    agent = AGENTS[2]
    path = "C:\\\\Users\\\\jsmith\\\\Downloads\\\\invoice_scan.exe"
    return {
        **base(agent),
        "rule": {
            "id": "554", "level": 12,
            "description": "File added to the system: known-malicious hash detected by FIM",
            "groups": ["ossec", "syscheck", "malware"],
            "mitre": {"id": ["T1204.002"], "tactic": ["Execution"], "technique": ["Malicious File"]},
        },
        "syscheck": {"path": path, "sha256_after": BAD_HASH, "event": "added"},
        "data": {},
        "full_log": f"File '{path}' added. SHA256: {BAD_HASH}",
    }


def c2_beacon() -> dict:
    agent = AGENTS[1]
    dst = random.choice(BAD_IPS)
    return {
        **base(agent),
        "rule": {
            "id": "100201", "level": 13,
            "description": "Outbound connection to known C2 infrastructure (repeated beaconing pattern)",
            "groups": ["firewall", "command_and_control", "malware"],
            "mitre": {"id": ["T1071.001"], "tactic": ["Command and Control"], "technique": ["Web Protocols"]},
        },
        "data": {"srcip": agent["ip"], "dstip": dst, "dstport": "443", "protocol": "tcp"},
        "full_log": f"Firewall: ALLOW TCP {agent['ip']}:49732 -> {dst}:443 dns={BAD_DOMAIN} (62 connections/hour, uniform 58s interval)",
    }


def privilege_escalation() -> dict:
    agent = AGENTS[3]
    user = random.choice(["jsmith", "svc_backup", "tmp_contractor"])
    return {
        **base(agent),
        "rule": {
            "id": "60110", "level": 12,
            "description": "User added to Domain Admins security group",
            "groups": ["windows", "account_manipulation", "privilege_escalation"],
            "mitre": {"id": ["T1098"], "tactic": ["Privilege Escalation"], "technique": ["Account Manipulation"]},
        },
        "data": {"srcuser": user, "dstuser": user},
        "full_log": f"Microsoft-Windows-Security-Auditing EventID 4728: Member '{user}' added to group 'Domain Admins' by 'DC-01$'",
    }


def web_attack() -> dict:
    agent = AGENTS[0]
    src = random.choice(BAD_IPS + BENIGN_IPS)
    return {
        **base(agent),
        "rule": {
            "id": "31103", "level": 7,
            "description": "SQL injection attempt in web request",
            "groups": ["web", "attack", "sql_injection", "web_attack"],
            "mitre": {"id": ["T1190"], "tactic": ["Initial Access"], "technique": ["Exploit Public-Facing Application"]},
        },
        "data": {"srcip": src, "url": "/products?id=1' UNION SELECT username,password FROM users--", "id": "404"},
        "full_log": f'{src} - - [{now()}] "GET /products?id=1%27%20UNION%20SELECT%20username,password%20FROM%20users-- HTTP/1.1" 404 162',
    }


def benign_noise() -> dict:
    agent = random.choice(AGENTS)
    src = random.choice(BENIGN_IPS)
    return {
        **base(agent),
        "rule": {
            "id": "5715", "level": 3,
            "description": "sshd: authentication success",
            "groups": ["syslog", "sshd", "authentication_success"],
            "mitre": {},
        },
        "data": {"srcip": src, "srcuser": "deploy"},
        "full_log": f"{now()} sshd[1024]: Accepted publickey for deploy from {src} port 51234 ssh2",
    }


SCENARIOS = {
    "brute_force": brute_force,
    "malware_hash": malware_hash,
    "c2_beacon": c2_beacon,
    "privilege_escalation": privilege_escalation,
    "web_attack": web_attack,
    "benign_noise": benign_noise,
}


def send(alert: dict) -> None:
    req = urllib.request.Request(
        INGEST_URL,
        data=json.dumps(alert).encode(),
        headers={"Content-Type": "application/json", "X-API-Key": API_KEY},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = json.loads(resp.read())
    print(f"sent {alert['rule']['id']} '{alert['rule']['description'][:60]}' -> alert id {body['id']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Wazuh alert simulator")
    parser.add_argument("--scenario", choices=SCENARIOS.keys())
    parser.add_argument("--all", action="store_true", help="send every scenario once")
    parser.add_argument("--stream", type=int, metavar="SECONDS", help="continuous mode, average interval")
    args = parser.parse_args()

    if args.all:
        for fn in SCENARIOS.values():
            send(fn())
            time.sleep(1)
    elif args.stream:
        weights = {"benign_noise": 5, "web_attack": 2, "brute_force": 2,
                   "c2_beacon": 1, "malware_hash": 1, "privilege_escalation": 1}
        names = list(weights)
        while True:
            name = random.choices(names, weights=[weights[n] for n in names])[0]
            send(SCENARIOS[name]())
            time.sleep(max(2, random.gauss(args.stream, args.stream / 3)))
    else:
        name = args.scenario or random.choice(list(SCENARIOS))
        send(SCENARIOS[name]())


if __name__ == "__main__":
    main()
