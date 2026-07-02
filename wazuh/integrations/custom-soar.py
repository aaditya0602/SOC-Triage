#!/usr/bin/env python3
"""Wazuh integratord script: forwards each alert to the SOC triage pipeline.

Install (on the Wazuh manager / in the wazuh.manager container):
    cp custom-soar     /var/ossec/integrations/custom-soar
    cp custom-soar.py  /var/ossec/integrations/custom-soar.py
    chmod 750 /var/ossec/integrations/custom-soar*
    chown root:wazuh /var/ossec/integrations/custom-soar*

Wazuh invokes it as:  custom-soar <alert_file> <api_key> <hook_url>
"""

import json
import sys
import urllib.request


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: custom-soar.py <alert_file> <api_key> <hook_url>", file=sys.stderr)
        return 1

    alert_file, api_key, hook_url = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(alert_file, encoding="utf-8") as fh:
        alert = json.load(fh)

    req = urllib.request.Request(
        hook_url,
        data=json.dumps(alert).encode(),
        headers={"Content-Type": "application/json", "X-API-Key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        print(f"custom-soar: forwarded alert, pipeline responded {resp.status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
