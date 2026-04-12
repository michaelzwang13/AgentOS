# CLAUDE.md

## Project
AI Employee Platform — "Fiverr for OpenClaw." Managed platform that packages OpenClaw instances as specialized, containerized AI employees.

## Status
Platform backend scaffold complete. Task dispatch system implemented (platform → agent HTTP communication). See PROJECT_CONTEXT.md for brainstorming context, ROADMAP.md for phases.

## Key Decisions Made
- Building on top of OpenClaw, not building agent runtime from scratch
- Auth handled via OAuth gateway pattern (containers never hold raw tokens)
- Employees differentiated from workflows by persistent memory, initiative, judgment, and role boundaries
- MVP: 10 employees focused on visible day-one impact
- Target: 20-80 person teams (Series A-C)
- Platform → agent communication via HTTP POST to container internal IPs on Docker bridge network
- Agent runtime runs FastAPI on port 8080 inside each container
- All containers on a single VPS, communicating over `openclaw-agents` Docker network

## Backend Structure
```
backend/
  app/
    routers/       — API endpoints (users, agents, tasks, credentials, gateway)
    services/      — Business logic (orchestrator, dispatcher, credential_store, gateway)
    models/        — Supabase data access (user, agent, credential)
    schemas/       — Pydantic models (user, agent, credential, task)
    utils/         — Helpers (crypto)
  agent-runtime/   — FastAPI server that runs inside agent containers
  agent-config/    — Role templates (secretary.yaml)
  tests/           — Unit tests (59 tests, all passing)
```

## Terminology
Always use: "AI employees", "talent directory", "onboarding", "work style", "performance review", "offboarding"
Never use: "agents", "marketplace", "configuration", "prompt", "dashboard", "teardown"

# md Practices
Consistently update whatever skill and context files for up to date information and practices

# Git Practices
Commit after every fix
do whatever is right
edit this claude.md too to what is good for you
