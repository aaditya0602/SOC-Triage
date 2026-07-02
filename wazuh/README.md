# Wazuh SIEM — deployment + pipeline hookup

The pipeline accepts alerts from any Wazuh manager via webhook. This guide stands up a
real single-node Wazuh stack in Docker and wires it to the triage pipeline.

> **RAM note:** the Wazuh stack (manager + indexer + dashboard) needs ~4 GB. With the
> pipeline + Ollama on a 16 GB machine, close other heavy apps first. For demos without
> Wazuh, `python scripts/simulator.py --stream 30` produces identical-format alerts.

## 1. Deploy Wazuh single-node

```bash
git clone https://github.com/wazuh/wazuh-docker.git -b v4.9.2 --depth 1
cd wazuh-docker/single-node

# generate TLS certs (one-time)
docker compose -f generate-indexer-certs.yml run --rm generator

docker compose up -d
```

Dashboard: https://localhost — user `admin`, password in `docker-compose.yml`
(`INDEXER_PASSWORD`, default `SecretPassword`).

## 2. Install the pipeline integration

Copy the integration script into the manager container:

```bash
docker cp ../../Airtel/wazuh/integrations/custom-soar     single-node-wazuh.manager-1:/var/ossec/integrations/custom-soar
docker cp ../../Airtel/wazuh/integrations/custom-soar.py  single-node-wazuh.manager-1:/var/ossec/integrations/custom-soar.py
docker exec single-node-wazuh.manager-1 chmod 750 /var/ossec/integrations/custom-soar /var/ossec/integrations/custom-soar.py
docker exec single-node-wazuh.manager-1 chown root:wazuh /var/ossec/integrations/custom-soar /var/ossec/integrations/custom-soar.py
```

Add the `<integration>` block from [ossec.conf.snippet.xml](ossec.conf.snippet.xml) to
`/var/ossec/etc/ossec.conf` inside the container (inside `<ossec_config>`):

```bash
docker exec -it single-node-wazuh.manager-1 bash -c "vi /var/ossec/etc/ossec.conf"
docker exec single-node-wazuh.manager-1 /var/ossec/bin/wazuh-control restart
```

Make sure `api_key` matches `INGEST_API_KEY` in the pipeline's `.env`, and `hook_url`
points at the pipeline backend (`host.docker.internal:8000` when both run in Docker
Desktop on the same machine).

## 3. Verify

Trigger a test alert (e.g. 5 failed SSH logins against any Wazuh agent, or lower
`<level>` temporarily to 3 and log in somewhere). The alert appears in the pipeline UI
within seconds, enriched and LLM-analyzed.

## 4. Enroll agents (optional but recommended)

Install a Wazuh agent on any VM/host and point it at the manager:

```bash
WAZUH_MANAGER=<your-host-ip> apt install ./wazuh-agent.deb   # or MSI on Windows
```

Windows agent MSI: https://packages.wazuh.com/4.x/windows/wazuh-agent-4.9.2-1.msi
