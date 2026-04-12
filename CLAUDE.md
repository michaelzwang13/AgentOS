# CLAUDE.md

## Project
AI Employee Platform — "Fiverr for OpenClaw." Managed platform that packages OpenClaw instances as specialized, containerized AI employees.

## Status
**Hackathon mode.** Platform backend scaffold complete with task dispatch (platform → agent HTTP). Frontend scaffold reset for handoff: hire flow is the v1 scope. See PROJECT_CONTEXT.md for brainstorming context, ROADMAP.md for the hackathon scope callout + post-hackathon phase plan.

## Key Decisions Made
- Building on top of OpenClaw, not building agent runtime from scratch
- Auth handled via OAuth gateway pattern (containers never hold raw tokens)
- Employees differentiated from workflows by persistent memory, initiative, judgment, and role boundaries
- **Hackathon MVP: 2 starter employees** — Code Review Engineer (GitHub) and Customer Support (Slack + Gmail). Full 10-employee list preserved in PROJECT_CONTEXT.md as the post-hackathon candidate pool.
- **Hackathon OAuth fidelity:** real OAuth for GitHub only; Slack and Gmail use a simulated consent screen that writes a placeholder token via `POST /credentials`.
- **Hackathon billing:** out of scope. No Stripe, no payment gate, no trial logic. Phase 6 is post-hackathon work.
- **Frontend scope:** hire flow end-to-end (landing → talent directory → employee profile → 4-step hire wizard → confirm). Post-hire surfaces (work log, team page, performance review) are post-hackathon.
- **Hackathon demo bar:** "hired and running is enough." Demo ends at the confirmation screen; real LLM task execution is post-hackathon.
- Target: 20-80 person teams (Series A-C)
- Platform → agent communication via HTTP POST to container internal IPs on Docker bridge network
- Agent runtime runs FastAPI on port 8080 inside each container
- All containers on a single VPS, communicating over `openclaw-agents` Docker network
- **OpenClaw is the agent engine** — each container runs the official OpenClaw gateway with our task server as a sidecar
- **Kimi (Moonshot AI) is the backend LLM** — configured via `openclaw.json` with the `moonshot/kimi-k2.5` model

## Backend Structure
```
backend/
  app/
    routers/       — API endpoints (users, agents, tasks, credentials, gateway)
    services/      — Business logic (orchestrator, dispatcher, credential_store, gateway)
    models/        — Supabase data access (user, agent, credential)
    schemas/       — Pydantic models (user, agent, credential, task)
    utils/         — Helpers (crypto)
  agent-runtime/   — OpenClaw + task server sidecar (Dockerfile, entrypoint, server.py)
  agent-config/    — Role templates (secretary.yaml today; code-review-engineer + customer-support needed for hackathon)
  tests/           — Unit tests (68 tests, all passing)
```

## Frontend
Frontend lives in `app/` (Next.js 16, shadcn, Tailwind v4). See `app/HANDOFF.md` for the hire flow build brief. Hackathon scope is hire flow only — do not scaffold post-hire surfaces until the hire flow is working end-to-end.

## Terminology
Always use: "AI employees", "talent directory", "onboarding", "work style", "performance review", "offboarding"
Never use: "agents", "marketplace", "configuration", "prompt", "dashboard", "teardown"

# md Practices
Consistently update whatever skill and context files for up to date information and practices

# Git Practices
Commit after every fix
do whatever is right
edit this claude.md too to what is good for you
