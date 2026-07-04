# Hosting a live demo

The app has two deployable pieces with different constraints:

| Piece | Needs | Vercel-compatible? |
|---|---|---|
| React frontend | static hosting | ✅ perfect fit |
| FastAPI backend | long-running process, WebSockets, background pipelines | ❌ Vercel serverless can't hold WebSockets or run multi-minute pipelines |
| Ollama LLM | a GPU/CPU box with ~5 GB RAM | ❌ no cloud free tier runs it |

So "host it on Vercel" really means: **frontend on Vercel, backend on a
free long-running host, LLM strategy swapped for the cloud**. Two options,
pick one:

---

## Option A (recommended): single host on Render — one URL, zero CORS

The backend already serves the built frontend from `backend/static/`, so one
container = the whole demo. Simplest to keep alive, and the WebSocket works
because it's the same origin.

1. Push the repo to GitHub.
2. Build the frontend into the backend image — the root `Dockerfile.demo`
   (below) does this in one multi-stage build.
3. On [render.com](https://render.com): **New → Web Service → connect repo**,
   runtime *Docker*, dockerfile path `Dockerfile.demo`, instance type *Free*.
4. Add a free Postgres on Render (or [neon.tech](https://neon.tech)) and set
   env vars:
   - `DATABASE_URL=postgresql+asyncpg://…` (from the Postgres dashboard)
   - `JWT_SECRET=<long random string>`
   - `ANALYST_PASSWORD=<demo password you're happy to share>`
   - `INGEST_API_KEY=<random>`
   - `VIRUSTOTAL_API_KEY / OTX_API_KEY / ABUSEIPDB_API_KEY` — your real keys
     (or leave empty → mock intel, demo still works)
   - `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (Haiku ≈ $0.001/alert),
     **or** `LLM_PROVIDER=mock` for zero cost
5. Seed data for visitors: log in, then `POST /api/demo/seed` (button-friendly;
   the UI docs mention it) — runs all six attack scenarios through the real
   pipeline. Repeat anytime.

Result: `https://soctriage.onrender.com` — login page, live pipeline, one URL.
Free-tier caveat: Render spins the container down after ~15 idle minutes;
first visit takes ~40 s to wake. Fine for a portfolio link, mention it on the
page or keep it warm with a cron ping (cron-job.org, free).

## Option B: Vercel frontend + Render backend (two URLs)

Use this if you specifically want the `vercel.app` domain / Vercel analytics.

1. Deploy the backend exactly as in Option A (skip the frontend baking).
2. In Vercel: **Add New Project → import repo**, root directory `frontend`,
   framework *Vite*. Set env var `VITE_API_BASE=https://<your-backend>.onrender.com`
   (the code already routes REST and WebSocket calls through it).
3. On the backend service set
   `CORS_ORIGINS=https://<your-project>.vercel.app` so the browser can call it.

WebSockets connect directly from the browser to Render (not proxied through
Vercel), which is why `VITE_API_BASE` matters — Vercel rewrites can't carry
WebSocket upgrades.

## LLM strategy for the cloud demo

Ollama stays local-only. For the hosted demo, order of preference:

1. **Anthropic API, Haiku** — real AI analyses for pennies; `LLM_PROVIDER=anthropic`.
2. **Mock provider** — free, deterministic, still demonstrates the full flow;
   the AI panel labels it honestly and the Regenerate button works the moment
   you add a key.
3. Groq / OpenRouter free tiers — possible third provider; the `LLMProvider`
   interface makes it a ~30-line addition.

## Demo hygiene

- Never commit `.env`; set secrets in the host's dashboard.
- Use a throwaway `ANALYST_PASSWORD` — the demo is public.
- Free VirusTotal keys are rate-limited (4 req/min): seed sparingly or rely
  on the enrichment cache (a re-seed reuses cached verdicts and costs zero
  API calls).
