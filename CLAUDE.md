# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
AgentOS — "Fiverr for OpenClaw." Managed platform that packages OpenClaw instances as specialized, containerized AI employees. See `README.md`, `ROADMAP.md`, and `PROJECT_CONTEXT.md` for product context; `LOCAL_SETUP.md` is the authoritative setup guide.

**Status: hackathon mode.** Demo bar is "hired and running." Hire flow is the v1 frontend scope. LLM execution is live end-to-end via OpenClaw + Kimi K2.5.

## Architecture (read this before editing)

```
Host (Mac)
├── Frontend  app/         :5173   Vite + React 19 + Tailwind 4
└── Docker Desktop
    └── openclaw-agents (bridge network)
        ├── Platform API   :8000   FastAPI, Docker socket mounted
        └── Agent containers       OpenClaw gateway + task-server sidecar :8080
```

- **Platform → agent dispatch** is HTTP POST to the container's internal IP on the `openclaw-agents` Docker bridge network. The platform finds the IP via the Docker SDK. There is no message bus.
- **Each agent container** runs the official OpenClaw gateway as the engine plus a FastAPI sidecar (`backend/agent-runtime/server.py`) on port 8080. The sidecar accepts `POST /task` with a token (`openclaw-internal` by default) and proxies to OpenClaw's OpenAI-compatible `/v1/chat/completions`.
- **LLM** is Kimi (Moonshot AI) — `moonshot/kimi-k2.5` — wired via `openclaw.json` inside the agent image. The chat-completions endpoint must be explicitly enabled in that config.
- **Persistence** is Supabase only (users, hired employees, encrypted credentials). Credentials are Fernet-encrypted at rest in `backend/app/services/credential_store.py`.
- **OAuth fidelity (hackathon):** GitHub is real OAuth; Slack/Gmail use a simulated consent screen that writes a placeholder token via `POST /credentials`.
- **Frontend → backend** is via the Vite dev proxy: `/api/*` → `http://localhost:8000/*` (see `app/vite.config.ts`). Do not bake `BACKEND_URL` into the build.

Backend layout under `backend/app/`:
- `routers/` — `users`, `auth` (+ `compat_router`), `agents`, `roles`, `credentials`, `tasks`, `gateway`, `chat`
- `services/` — `orchestrator` (Docker spawn/teardown), `dispatcher` (task routing), `credential_store` (Fernet vault), `gateway` (OAuth URL build + token exchange), `template_loader` (YAML role templates)
- `models/` — Supabase data access
- `schemas/` — Pydantic request/response models
- Role templates live in `backend/agent-config/templates/` (`secretary`, `code-review-engineer`, `customer-support`). `AGENT_SYSTEM_PROMPT.md` is the base system prompt mounted into containers.

## Common commands

Bring up the whole stack (Docker image build + network + backend + frontend):
```bash
./start-mac.sh   # Apple Silicon — forces arm64 for Python deps (use this on this machine)
./start.sh       # Linux / Intel Mac
```

Backend only — **on Apple Silicon, always use `arch -arm64` for the venv Python** or `pydantic-core` / native wheels will fail to import:
```bash
cd backend
arch -arm64 .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend only:
```bash
cd app && bun run dev          # or: npm run dev
bun run build                  # tsc -b && vite build
bun run lint                   # eslint .
```

Backend tests (97 tests):
```bash
cd backend
arch -arm64 .venv/bin/python -m pytest                              # all
arch -arm64 .venv/bin/python -m pytest tests/test_dispatcher.py     # one file
arch -arm64 .venv/bin/python -m pytest tests/test_agents.py::test_hire_agent -v   # one test
```

Agent image (rebuild after changes to `backend/agent-runtime/`):
```bash
docker build -t openclaw/agent:latest backend/agent-runtime/
```

Docker bridge network (created by `start.sh`, but if running pieces manually):
```bash
docker network create openclaw-agents
```

API docs: `http://localhost:8000/docs`. Health: `GET /health`.

## Conventions

**Terminology — the codebase uses product-facing language; keep it consistent.**
- Use: "AI employees", "talent directory", "onboarding", "work style", "performance review", "offboarding"
- Avoid: "agents", "marketplace", "configuration", "prompt", "dashboard", "teardown"
- Internal Python identifiers (`agents` router, `orchestrator`, etc.) are grandfathered — don't churn those, but prefer the product terms in new UI copy, docs, and user-facing strings.

**Scope discipline (hackathon).** Post-hire surfaces (work log, team page, performance review), billing/Stripe, and VPS deploy are explicitly post-hackathon. Don't scaffold them unless asked. The full post-hackathon candidate pool of 10 employees lives in `PROJECT_CONTEXT.md` — the MVP ships 2 (Code Review Engineer, Customer Support) plus `secretary.yaml` as a reference template.

**Git.** Commit after every meaningful fix. Keep messages short and reflective of intent.

**Docs.** When behavior or setup changes, update the relevant md (`README.md`, `LOCAL_SETUP.md`, `ROADMAP.md`, this file) in the same change.
