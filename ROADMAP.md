# SOCTriage — Roadmap & Positioning

This document covers three things: where the project can go next (specifically
gaps the security industry *complains about but few products actually solve*),
what differentiates each idea, and a polished resume entry for the work built
so far.

---

## 1. Future expansion — unsolved problems worth building for

Ranked roughly by (industry pain × how few solutions exist × feasibility on
this codebase).

### 1.1 Grounded AI — hallucination guards for security verdicts
**The gap:** every vendor is bolting LLMs onto SOC tooling, but almost none
verify the model's claims against the alert's actual facts. An LLM that
invents an IP or misquotes an intel verdict is worse than no LLM — analysts
stop trusting the whole panel.
**The build:** post-generation validator that cross-checks every IOC, IP,
username, and intel verdict mentioned in the LLM summary against the alert
record; flag or strip unsupported claims; show a per-analysis "grounding
score" chip in the AI panel. Cheap to build here because the pipeline already
holds structured ground truth next to the generated text.
**Why it interviews well:** demonstrates you understand LLM failure modes,
not just LLM integration.

### 1.2 Alert-fatigue feedback loop → auto-tuning proposals
**The gap:** SIEMs generate noise; SOARs route noise faster. Nobody closes
the loop back to detection engineering. Analysts dismiss the same rule 50
times and the rule never changes.
**The build:** already storing every dismissal with a reason. Aggregate them:
when a rule's dismiss-rate crosses a threshold, auto-draft a tuning proposal
(suppress condition, threshold bump, or allowlist entry) with evidence
attached, and queue it for human approval. This turns the existing
`past_verdicts` feature into a detection-engineering copilot.

### 1.3 Attack-story reconstruction (kill-chain narratives)
**The gap:** correlation engines group alerts; they don't *explain* them.
Analysts still manually reconstruct "recon → brute force → login → privilege
escalation → C2" across incidents. Graph-based attack-story tools are mostly
locked inside expensive XDR suites.
**The build:** graph layer over existing incidents — nodes are entities
(hosts, users, IPs), edges are alerts; walk time-ordered paths and have the
LLM narrate the chain with MITRE tactic progression. Render as an interactive
timeline/graph view in the dashboard.

### 1.4 Human-in-the-loop response actions with blast-radius preview
**The gap:** full auto-response scares SOCs (one bad block = outage), so most
"SOAR playbooks" ship disabled. What's missing is the middle ground: proposed
actions with a *preview of what they'd affect* before an analyst clicks
approve.
**The build:** action framework (block IP, disable account, isolate host)
where every action runs a dry-run first — "blocking 10.0.1.20 would affect 3
active sessions and 1 service account" — then executes on approval and logs
to the audit trail. Simulate the integrations (mock firewall/AD APIs) the
same way the alert simulator works; swap real APIs later.

### 1.5 Detection regression testing (replay CI for the SOC)
**The gap:** detection rules break silently — a log format changes and a rule
stops firing, and nobody notices until a pentest. "Detection-as-code" is
talked about everywhere and shipped almost nowhere.
**The build:** the simulator already encodes attack scenarios. Formalize it:
scenario suite runs on a schedule / in CI, asserts expected severity bands and
incident groupings, and diffs against the last run. A failing detection is a
failing test.

### 1.6 Analyst copilot with case context (RAG over the audit trail)
**The gap:** chat-with-your-SIEM products answer generic questions; they
don't know *this* team's history — past incidents, what was dismissed and
why, which hosts are chronically noisy.
**The build:** RAG index over alerts, triage notes, and audit log; a chat
panel scoped to the open alert ("have we seen this IP before?", "who
dismissed this rule last time and why?"). Local embedding model keeps it
fully on-prem.

### 1.7 Fully-local AI guarantee as a feature
**The gap:** regulated SOCs (banks, telecom, government) can't send alert
data to cloud LLMs at all. Most AI-SOC products are cloud-only; "sovereign
SOC AI" is a real procurement checkbox with few credible offerings.
**The build:** already Ollama-first. Harden it into a stated guarantee: an
"air-gapped mode" flag that disables every outbound call (cloud LLM + intel
APIs), local intel mirrors (MISP feeds), and a model-quality benchmark
comparing local models on triage accuracy so buyers can pick a model with
evidence.

### Smaller, high-polish additions
- SLA timers + escalation policies (P1 untouched for 15 min → notify).
- Analyst performance view: median time-to-triage, verdict agreement with AI.
- Shift-handoff report: LLM-generated summary of the last 8 hours.
- Webhook/Slack notifier for P1 completions.
- Multi-analyst roles (read-only viewer, senior approver for response actions).

---

## 2. Resume entry

> **AI-Assisted SOC Triage Platform (mini-SOAR)** — *FastAPI, React, Ollama/Claude, Docker*
>
> - Architected and built an end-to-end SOC triage pipeline that ingests Wazuh SIEM alerts via webhook, enriches IOCs across 3 threat-intelligence APIs (VirusTotal, OTX, AbuseIPDB) with rate-limit-aware caching, and applies a local-LLM analysis layer producing incident summaries, MITRE ATT&CK mappings, and recommended response actions — processing 70+ live-streamed alerts end-to-end with 100% pipeline completion under provider outages via layered graceful degradation.
> - Designed a hybrid severity engine combining deterministic scoring (rule level + intel verdicts + context) with an analyst feedback loop that feeds past triage verdicts into subsequent LLM analyses; diagnosed and fixed production-class concurrency failures found in live testing (SQLite write-lock contention under 16-second rate-limited API calls, local-LLM thundering-herd fallbacks).
> - Shipped a real-time analyst console (React, TypeScript, shadcn/ui, WebSocket) with live alert streaming, one-click triage workflows, alert-to-incident correlation, full audit logging, and a re-analysis action — deployed as a 3-container Docker Compose stack (Postgres, FastAPI, nginx) with a 16-test pytest suite.

Trim to 2 bullets for tight resumes by merging the last two. Numbers to keep
handy for interviews: ~2,700 lines of application code (excl. generated UI
components), 6 simulated attack scenarios spanning 5 MITRE tactics, alert →
analyst-ready verdict in ~35–60 s on consumer hardware (16 GB, local 7B
model), enrichment cache cuts repeat intel lookups to zero API calls.

---

## 3. Positioning line (for the project README / LinkedIn)

*"SOCTriage is a self-hosted, AI-assisted alert triage platform: SIEM alerts
in, analyst-ready verdicts out — enriched with live threat intel, scored
deterministically, explained by a local LLM, and never leaving your
infrastructure."*
