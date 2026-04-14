# AgentOS

A managed platform for hiring, onboarding, and running specialized AI employees. Think "Fiverr for OpenClaw" — each employee is a containerized OpenClaw instance with a defined role, persistent memory, and scoped access to your tools (GitHub, Slack, Gmail).

Built as a hackathon MVP. The current demo bar is "hired and running": a user can browse the talent directory, onboard an employee through a 4-step hire flow, and dispatch tasks that execute inside a live Docker container backed by Kimi K2.5 through the OpenClaw gateway.

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
- Supabase is the only external dependency — it holds users, hired employees, and encrypted credentials.

---

## Repository layout

```
AgentOS/
├── backend/                  FastAPI platform API
│   ├── app/
│   │   ├── routers/          users, agents, tasks, credentials, gateway, chat, auth, roles
│   │   ├── services/         orchestrator, dispatcher, credential_store, gateway, template_loader
│   │   ├── models/           Supabase data access
│   │   ├── schemas/          Pydantic request/response models
│   │   └── utils/            crypto helpers
│   ├── agent-runtime/        OpenClaw + task server sidecar (Dockerfile, entrypoint, server.py)
│   ├── agent-config/
│   │   └── templates/        Role templates (secretary, code-review-engineer, customer-support)
│   ├── migrations/           Supabase SQL migrations
│   └── tests/                Pytest unit tests
│
├── app/                      Vite + React 19 frontend (started by start.sh)
│   └── src/pages/            Home, Login, Agents, Page1-5
│
├── start.sh                  One-shot local dev bootstrapper
├── LOCAL_SETUP.md            Authoritative local setup guide
├── ROADMAP.md                Hackathon scope + post-hackathon phases
├── PROJECT_CONTEXT.md        Product brainstorming + design decisions
├── AGENT_SYSTEM_PROMPT.md    System prompt used by agent containers
└── HANDOFF.md                Frontend build brief
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

- `orchestrator` — provisions and tears down agent containers via the Docker SDK.
- `dispatcher` — routes tasks from platform to agent container internal IPs.
- `credential_store` — Fernet-encrypted credential vault.
- `template_loader` — reads YAML role templates from `agent-config/templates/`.
- `gateway` — builds OAuth URLs and handles token exchange.

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
- Role: the role template (e.g., `code-review-engineer.yaml`) is mounted in and used to build the system prompt.

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
   ./start.sh
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

Backend has 78 passing unit tests:

```bash
cd backend
source .venv/bin/activate
pytest
```

---

## Scope and status

- Platform backend scaffold: done, with task dispatch wired end-to-end.
- LLM execution inside containers: live via OpenClaw + Kimi.
- Hire flow: in-progress v1 scope for the hackathon.
- Post-hire surfaces (work log, team page, performance review): post-hackathon.
- Billing / Stripe / payment gating: post-hackathon.
- VPS deployment: post-hackathon. The MVP runs entirely on local Docker Desktop.

See `ROADMAP.md` for the full phase plan.

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
- `AGENT_SYSTEM_PROMPT.md` — system prompt the containers run with
- `HANDOFF.md` — backend handoff notes
- `CLAUDE.md` — conventions for Claude Code collaborators
