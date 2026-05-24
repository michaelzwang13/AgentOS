# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
AgentOS — "Fiverr for OpenClaw." Managed platform that packages OpenClaw instances as specialized, containerized AI employees. See `README.md`, `ROADMAP.md`, and `PROJECT_CONTEXT.md` for product context; `LOCAL_SETUP.md` is the authoritative setup guide.

**Status: hackathon mode, post-hackathon depth in progress.** Demo bar was "hired and running"; the Code Review Engineer is now also a differentiated, trust-moated, memory-backed employee. Three of the four "make one employee real" phases have shipped (A: template-driven runtime; B: enforced action policy; D: agent memory + work log). Phase C (autonomous PR-watcher) is next. LLM execution is live end-to-end via OpenClaw + Kimi K2.5.

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
- **Template-driven container shape (Phase A).** The orchestrator base64-encodes the resolved role template into `AGENT_TEMPLATE_B64`; `entrypoint.sh` decodes it, writes `SOUL.md` from the template's `system_prompt`, and installs only the skills the template lists. `resource_limits` from the template cap the Docker container.
- **Agent-side auth + action policy (Phase B).** The orchestrator mints a per-agent bearer token and persists it on `agents.agent_token` while the container runs. Agent-authed gateway endpoints (currently the 4 GitHub ones) use `get_current_agent` (`backend/app/agent_auth.py`) instead of `get_current_user`, and call `require_action` (`backend/app/services/policy.py`) before doing work. Denied-by-default against the role template's `allowed_actions`.
- **Memory + audit log (Phase D).** Per-agent key/value memory (`agent_memory` table) the agent writes via the `update-memory` skill and reads back as injected `role_context` on every dispatch — survives container restarts. Every agent-authed gateway call writes a row to `agent_action_log` (allow + deny). `reviewed_prs` is the dedup table Phase C's watcher will read.
- **LLM** is Kimi (Moonshot AI) — `moonshot/kimi-k2.5` — wired via `openclaw.json` inside the agent image. The chat-completions endpoint must be explicitly enabled in that config.
- **Persistence** is Supabase only (users, hired employees, encrypted credentials, per-agent memory + action log + reviewed PRs). User credentials are Fernet-encrypted at rest in `backend/app/services/credential_store.py`; agent tokens are stored plaintext (rotated on stop).
- **OAuth fidelity (hackathon):** GitHub is real OAuth; Slack/Gmail use a simulated consent screen that writes a placeholder token via `POST /credentials`.
- **Frontend → backend** is via the Vite dev proxy: `/api/*` → `http://localhost:8000/*` (see `app/vite.config.ts`). Do not bake `BACKEND_URL` into the build.

Backend layout under `backend/app/`:
- `routers/` — `users`, `auth` (+ `compat_router`), `agents`, `roles`, `credentials`, `tasks`, `gateway`, `chat`
- `services/` — `orchestrator` (Docker spawn/teardown), `dispatcher` (task routing + memory injection), `credential_store` (Fernet vault), `gateway` (OAuth URL build + token exchange), `template_loader` (YAML role templates), `policy` (action-policy check + audit write)
- `models/` — Supabase data access. User-scoped: `user`, `agent`, `credential`. Agent-scoped (Phase D): `agent_memory`, `action_log`, `reviewed_pr`
- `schemas/` — Pydantic request/response models
- `auth.py` — user-side `get_current_user` (X-Api-Key). `agent_auth.py` — agent-side `get_current_agent` (Bearer agent token, Phase B)
- Role templates live in `backend/agent-config/templates/` (`secretary`, `code-review-engineer`, `customer-support`). The template's `skills` list selects which skill folders from `backend/agent-runtime/skills/` install into the container (Phase A); `allowed_actions` are enforced server-side (Phase B). The agent's `SOUL.md` is written from each template's `system_prompt` at container boot — there is no shared base prompt.
- Migrations live in `backend/migrations/`. `001`–`003` are the original user/credentials/password schema. `004_code_review_engineer.sql` is shared across Phases B (agent_token column) and D (memory + action log + reviewed_prs tables) of the Code Review Engineer epic. `schema.sql` is the consolidated fresh-install snapshot.

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

Backend tests (125 tests):
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

**Trust moat conventions (Phase B+).** Gateway endpoints that an agent skill calls must (1) use `agent: dict = Depends(get_current_agent)` instead of `user: dict = Depends(get_current_user)`, and (2) call `require_action(agent, "<action.id>")` before doing work — denied-by-default against the role template's `allowed_actions`. The action id is the audit-log row's `action` field; choose stable, dot-namespaced strings (e.g. `github.review.submit`, `agent.memory.write`). Skills authenticate with `Authorization: Bearer ${AGENT_TOKEN}`, never `X-Api-Key`.

**Memory conventions (Phase D+).** Agent-side memory persistence lives in `agent_memory` and is exposed via `GET`/`POST /gateway/memory`. The dispatcher injects all of an agent's memory keys into `role_context` on every dispatch — compaction strategies (LRU / LLM reflection) are tracked in issue #23, not yet built. Keep memory keys stable and namespaced; the agent's `update-memory` skill is the *write* path, the dispatcher is the *read* path.

**Git.** Commit after every meaningful fix. Keep messages short and reflective of intent.

**Docs.** When behavior or setup changes, update the relevant md (`README.md`, `LOCAL_SETUP.md`, `ROADMAP.md`, this file) in the same change.
