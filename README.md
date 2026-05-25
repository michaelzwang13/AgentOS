# AgentOS

A managed platform for hiring, onboarding, and running specialized AI employees. Think "Fiverr for OpenClaw" — each employee is a containerized OpenClaw instance with a defined role, persistent memory, and scoped access to your tools (GitHub, Slack, Gmail).

Built as a hackathon MVP, now growing depth. The original demo bar was "hired and running"; the Code Review Engineer is now a genuinely differentiated AI employee with a role-shaped container, a server-side action policy (provably unable to merge/push), and persistent memory that survives container restarts. A user can browse the talent directory, onboard an employee through a 4-step hire flow, and dispatch tasks that execute inside a live Docker container backed by Kimi K2.5 through the OpenClaw gateway.

---

## Architecture

```
Host (your Mac)
├── Frontend (app)           http://localhost:5173   Vite + React 19
└── Docker Desktop
    └── openclaw-agents (bridge network)
        ├── Platform API     http://localhost:8000   FastAPI, Docker socket mounted
        └── Agent containers 172.x.x.x:8080          OpenClaw gateway + task server sidecar
```

- Platform backend dispatches tasks to agent containers over the Docker bridge network via HTTP POST.
- Each agent container runs the official OpenClaw gateway alongside a FastAPI task server (`backend/agent-runtime/server.py`) on port 8080.
- LLM inference uses Kimi (Moonshot AI) via OpenClaw's OpenAI-compatible `/v1/chat/completions` endpoint.
- The role template shapes the container: `system_prompt` becomes the agent's `SOUL.md`, the `skills` list filters which skills install, and `resource_limits` caps the container.
- Skills that need to call the platform back (e.g., GitHub review, memory writes) authenticate with a per-agent bearer token; a server-side action policy enforces the role template's `allowed_actions` (denied-by-default) and writes an audit row per call.
- Supabase is the only external dependency — it holds users, hired employees, encrypted credentials, per-agent memory, the action log, and the reviewed-PR dedup index.

---

## Repository layout

```
AgentOS/
├── backend/                  FastAPI platform API
│   ├── app/
│   │   ├── routers/          users, agents, tasks, credentials, gateway, chat, auth, roles
│   │   ├── services/         orchestrator, dispatcher, credential_store, gateway, template_loader, policy
│   │   ├── models/           Supabase data access (users, agents, credentials, agent_memory, action_log, reviewed_pr)
│   │   ├── schemas/          Pydantic request/response models
│   │   ├── utils/            crypto helpers
│   │   ├── auth.py           user-side auth (X-Api-Key)
│   │   └── agent_auth.py     agent-side auth (Bearer agent token)
│   ├── agent-runtime/        OpenClaw + task server sidecar (Dockerfile, entrypoint, server.py)
│   │   └── skills/           github-list-prs, github-pr-review, update-memory, send-email, send-slack-message
│   ├── agent-config/
│   │   └── templates/        Role templates (secretary, code-review-engineer, customer-support)
│   ├── migrations/           Supabase SQL migrations (001–004 + schema.sql)
│   └── tests/                Pytest unit tests
│
├── app/                      Vite + React 19 frontend (started by start.sh)
│   └── src/pages/            Home, Login, Agents, Page1-5
│
├── start.sh                  One-shot local dev bootstrapper
├── LOCAL_SETUP.md            Authoritative local setup guide
├── ROADMAP.md                Hackathon scope + post-hackathon phases
├── PROJECT_CONTEXT.md        Product brainstorming + design decisions
└── CLAUDE.md                 Conventions for Claude Code collaborators
```

---

## Backend

FastAPI app mounted at `backend/app/main.py`. Router surface:

| Router         | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| `users`        | Account creation and lookup                                     |
| `auth`         | Session auth + legacy compat routes                             |
| `agents`       | Hire, list, offboard AI employees                               |
| `roles`        | Role template discovery                                         |
| `credentials`  | OAuth + simulated credential storage (AES-encrypted at rest)    |
| `tasks`        | Dispatch tasks to running agent containers                      |
| `gateway`      | OAuth callback surface (GitHub real; Slack/Gmail simulated)     |
| `chat`         | Chat passthrough to OpenClaw's `/v1/chat/completions`           |

Key services:

- `orchestrator` — provisions and tears down agent containers via the Docker SDK; base64-encodes the role template into the container env; mints and persists the per-agent bearer token.
- `dispatcher` — routes tasks from platform to agent container internal IPs; injects each agent's persisted memory into `role_context` at dispatch.
- `credential_store` — Fernet-encrypted credential vault.
- `template_loader` — reads YAML role templates from `agent-config/templates/`.
- `gateway` — builds OAuth URLs and handles token exchange.
- `policy` — server-side action-policy check (`require_action`). Denied-by-default against the role template's `allowed_actions`; persists allow + deny rows to `agent_action_log` (best-effort).

Stack: Python 3.12, FastAPI, Supabase, Docker SDK, cryptography (Fernet), httpx, PyYAML.

---

## Frontend

`app/` — Vite + React 19 + React Router + Tailwind. Started by `start.sh` on `:5173`. Pages: Home, Login, Agents, and a numbered Page1-5 flow for hire/onboarding. The backend is reached via the Vite dev proxy (`/api/*` → `http://localhost:8000/*`), so no `BACKEND_URL` env var is needed at build time.

---

## Agent runtime

Each hired employee runs as a Docker container built from `backend/agent-runtime/Dockerfile`:

- Base: OpenClaw gateway image.
- Sidecar: a FastAPI task server (`server.py`) on port 8080 that accepts `POST /task` from the platform.
- Config: `openclaw.json` wires the gateway to Kimi (`moonshot/kimi-k2.5`) and enables the OpenAI-compatible chat completions endpoint.
- Auth: task server is protected by a token (`openclaw-internal` by default) so only the platform can dispatch.
- Role: the resolved role template is passed in as a base64-encoded env var. The entrypoint decodes it and writes `SOUL.md` from `system_prompt`, installs only the skills the template lists, and applies its `resource_limits`. Skills that hit the platform's gateway authenticate with the per-agent bearer token.

Containers are spawned on demand by the platform orchestrator and attached to the `openclaw-agents` bridge network.

---

## Starter employees (hackathon MVP)

Two roles ship with the demo; the full candidate pool lives in `PROJECT_CONTEXT.md`.

1. **Code Review Engineer** — GitHub. Real OAuth.
2. **Customer Support** — Slack + Gmail. Simulated consent screen writes a placeholder token to `POST /credentials`.

A third `secretary.yaml` template is included as a reference role.

---

## Running it locally

Full walkthrough is in `LOCAL_SETUP.md`. The short version:

1. Install Docker Desktop, Node 20+, Python 3.12+, and create a Supabase project.
2. Copy `backend/.env.example` to `backend/.env` and fill in your keys (Supabase, encryption key, Moonshot/Kimi API key, OAuth client credentials).
3. Run the platform and the primary frontend together:

   ```bash
   ./start.sh           # Linux / Intel Mac
   ./start-mac.sh       # Apple Silicon Mac (forces arm64 for Python deps)
   ```

   This script will:
   - Build the agent container image (`openclaw/agent:latest`).
   - Create the `openclaw-agents` Docker bridge network.
   - Install backend Python deps into `backend/.venv` and start FastAPI on `:8000`.
   - Install frontend deps in `app/` and start the Vite dev server on `:5173`.

4. Open `http://localhost:5173/login` to create an account, then `http://localhost:5173/agents` for the Signal Feed. Click CONNECT on any tab to link Slack/Gmail/GitHub.

5. Backend API docs: `http://localhost:8000/docs`.

---

## Tests

Backend has 143 passing unit tests:

```bash
cd backend
source .venv/bin/activate
pytest
```

On Apple Silicon use `arch -arm64 .venv/bin/python -m pytest` instead — see `CLAUDE.md`.

---

## Scope and status

**Platform foundation — done**
- Platform backend scaffold with task dispatch wired end-to-end.
- LLM execution inside containers via OpenClaw + Kimi.
- Hardening pass merged (real password login, OAuth state signing, rate limiting, CORS, error handling, frontend route guards + minimal Vitest suite).

**Code Review Engineer specialization — all 4 phases shipped**
- **Phase A — Template-driven runtime.** The role template shapes the container (system_prompt → SOUL.md, skills filter, resource_limits applied). PR #19.
- **Phase B — Enforced action policy.** Per-agent bearer token + denied-by-default `allowed_actions` check at the gateway. The Code Review Engineer is provably unable to merge/close/push. PR #20.
- **Phase D — Memory & work log.** Per-agent key/value memory (writes via the `update-memory` skill, reads back via dispatch-time injection), full audit log of every agent-authed call (allow + deny), `reviewed_prs` dedup index. PR #25.
- **Phase C — Autonomous PR-watcher.** `lifespan`-driven 120s asyncio poll loop scans every running CRE's `watched_repos`, dedups against `reviewed_prs`, and dispatches a review task per unreviewed open PR. PR #29.

**Backlog (post-hackathon)**
- AWS deployment via CDK (#11), frontend do-over (#12), agent memory compaction via LLM reflection (#23), other roles brought up to A/B/D parity (#17), hire/offboard UI (#13), CI for backend + frontend tests (#14).

See `ROADMAP.md` for the longer phase plan.

---

## Terminology

This codebase uses product-facing language consistently. When contributing, use:

> AI employees, talent directory, onboarding, work style, performance review, offboarding

Avoid: agents, marketplace, configuration, prompt, dashboard, teardown.

---

## Further reading

- [OpenClaw](https://github.com/openclaw/openclaw) — the local-first personal AI assistant framework this platform is built on (gateway on `:18789`, SOUL.md-driven config, OpenAI-compatible chat completions endpoint)
- `LOCAL_SETUP.md` — authoritative local setup and networking notes
- `ROADMAP.md` — hackathon scope and post-hackathon phases
- `PROJECT_CONTEXT.md` — product brainstorming and design decisions
- `CLAUDE.md` — conventions for Claude Code collaborators
