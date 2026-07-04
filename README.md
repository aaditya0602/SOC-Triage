# SOC Triage Pipeline (mini-SOAR)

AI-assisted SOC alert triage: ingests alerts from a **Wazuh SIEM**, enriches IOCs with
**VirusTotal / AlienVault OTX / AbuseIPDB**, computes a deterministic **severity score**,
correlates related alerts into **incidents**, and runs an **LLM analysis layer** (Ollama or  
Claude API) that produces plain-English summaries, MITRE ATT&CK mappings, and recommended response actions — all surfaced in a real-time **React analyst dashboard** with triage workflows and a full audit log.

```
┌─────────────────┐  webhook   ┌──────────────────────────────────────────────┐
│ Wazuh manager    │──────────▶│                FastAPI backend                │
│ (integratord)    │           │                                              │
├─────────────────┤           │  normalize ─▶ extract IOCs                    │
│ Alert simulator  │──────────▶│      │                                        │
└─────────────────┘           │      ▼                                        │
                              │  enrich ──▶ VirusTotal / OTX / AbuseIPDB      │
                              │      │      (async, cached, rate-limited)     │
                              │      ▼                                        │
                              │  score ──▶ rule level + intel + context       │
                              │      │      → 0-100, P1-P4                    │
                              │      ▼                                        │
                              │  correlate ─▶ alerts → incidents              │
                              │      │                                        │
                              │      ▼                                        │
                              │  LLM analyst ─▶ Ollama / Claude / mock        │
                              │      │  summary · MITRE · actions · FP-score  │
                              │      ▼                                        │
                              │  PostgreSQL + audit log                       │
                              └──────┬───────────────────────────────────────┘
                                     │ REST + WebSocket (live)
                              ┌──────▼───────────────────────────────────────┐
                              │  React dashboard — queue · incident view ·   │
                              │  triage (escalate/dismiss/investigate) ·     │
                              │  audit trail · severity analytics            │
                              └──────────────────────────────────────────────┘
```

## Key design points

- **Graceful degradation everywhere** — no intel keys → deterministic mock intel; LLM down
→ template analysis; pipeline never blocks ingestion (runs as background task per alert).
- **Deterministic scoring + AI narrative** — severity comes from an explainable formula
(rule level 0-55 + worst intel verdict 0-35 + context 0-10); the LLM explains and
recommends, it does not decide severity. Score breakdown shown in the UI.
- **Analyst feedback loop** — triage notes are stored and fed into future LLM prompts for
the same rule, so repeated false positives get flagged as such.
- **Free-tier aware** — per-provider rate limiting (VT: 4 req/min) + 24 h DB cache.
- **Audit everything** — ingest, login, every triage decision → immutable audit log.

## Quick start (local dev)

```powershell
# backend
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy ..\.env.example .env        # then edit: add API keys or leave blank for mock mode
.venv\Scripts\python -m uvicorn app.main:app --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                      # http://localhost:5173 — login analyst / changeme

# generate alerts (third terminal)
python scripts/simulator.py --all          # one of each scenario
python scripts/simulator.py --stream 30    # continuous demo stream
```

## LLM options


| Provider           | Setup                                                         | Notes                      |
| ------------------ | ------------------------------------------------------------- | -------------------------- |
| `ollama` (default) | `ollama pull qwen2.5:3b` (or `qwen2.5:7b` — better)           | free, local                |
| `anthropic`        | set `ANTHROPIC_API_KEY` (pay-per-token; Haiku ≈ $0.001/alert) | best quality               |
| `mock`             | nothing                                                       | template output, demo-safe |


Set `LLM_PROVIDER` in `.env`. Anthropic API billing is separate from a Claude Pro
subscription — Pro does not include an API key.

## Threat intel keys (all free tiers)

- VirusTotal: [https://www.virustotal.com/gui/join-us](https://www.virustotal.com/gui/join-us) → `VIRUSTOTAL_API_KEY`
- AlienVault OTX: [https://otx.alienvault.com](https://otx.alienvault.com) → `OTX_API_KEY`
- AbuseIPDB: [https://www.abuseipdb.com/register](https://www.abuseipdb.com/register) → `ABUSEIPDB_API_KEY`

Blank keys → automatic mock mode (deterministic, demo-safe).

## Docker (full stack: Postgres + backend + frontend)

```bash
docker compose up -d --build     # UI at http://localhost:8080
```

Ollama stays on the host (backend reaches it via `host.docker.internal`).

## Live Wazuh SIEM

See [wazuh/README.md](wazuh/README.md) — deploys a real single-node Wazuh stack in Docker
and installs the `custom-soar` integration that forwards every level ≥ 7 alert to the
pipeline webhook.

## Tests

```powershell
cd backend
.venv\Scripts\python -m pytest
```

Covers: Wazuh normalization + IOC extraction, scoring bands, LLM output parsing,
end-to-end pipeline (enrich → score → correlate) with cache-hit verification.

## Project layout

```
backend/app/
  ingest/        webhook + normalizer (IOC extraction)
  enrichment/    VT / OTX / AbuseIPDB clients, cache, rate limiting, mock
  scoring/       deterministic severity engine
  correlation/   alert → incident grouping
  llm/           provider abstraction (ollama/anthropic/mock), prompts, feedback loop
  api/           REST routers (alerts, incidents, stats, audit, auth)
  pipeline.py    background orchestrator
frontend/src/    React + TS + Tailwind dashboard (live via WebSocket)
wazuh/           SIEM deployment + custom-soar integration
scripts/         attack-scenario simulator
```

## Security notes

- JWT auth on all analyst endpoints; shared-secret header on the ingest webhook.
- Passwords hashed with PBKDF2-HMAC-SHA256 (200k iterations).
- Change `JWT_SECRET`, `ANALYST_PASSWORD`, `INGEST_API_KEY` before any non-local deploy.
- Private/loopback IPs are never sent to external intel APIs.

