# Backend Handoff

What's been built, how it works, and what's left.

---

## What's Done

### Platform Backend (FastAPI)
Fully working backend with these API endpoints:

| Endpoint | Method | What it does |
|---|---|---|
| `/health` | GET | Platform health check |
| `/users` | POST | Create a user (returns API key) |
| `/users` | GET | List users |
| `/users/{id}` | GET/DELETE | Get or delete a user |
| `/agents` | POST | Hire an agent (spins up a Docker container) |
| `/agents` | GET | List your agents |
| `/agents/{id}` | GET | Get agent status |
| `/agents/{id}` | DELETE | Fire an agent (stops + removes container) |
| `/agents/{id}/tasks` | POST | Assign a task to an agent |
| `/agents/{id}/tasks/status` | GET | Check task progress |
| `/agents/{id}/tasks/cancel` | POST | Cancel a running task |
| `/credentials` | POST | Store an OAuth token (encrypted) |
| `/credentials` | GET | List stored credentials |
| `/credentials/{service}` | DELETE | Remove a credential |
| `/gateway/email/send` | POST | Send email via stored Gmail token |
| `/gateway/slack/message` | POST | Send Slack message via stored token |
| `/gateway/discord/message` | POST | Send Discord message via stored token |

All endpoints require `X-Api-Key` header (except `/users` POST and `/health`).

### Agent Runtime (OpenClaw + Kimi)
Each agent container runs:
1. **OpenClaw gateway** (port 18789) — the open-source AI agent engine, configured with Kimi K2.5 as the LLM
2. **Task server** (port 8080) — our FastAPI sidecar that receives tasks from the platform and forwards them to OpenClaw

The `entrypoint.sh` bootstraps everything:
- Writes `openclaw.json` with Moonshot/Kimi provider config
- Generates `SOUL.md` (agent persona) and `AGENTS.md` (operating instructions) from the role env vars
- Starts OpenClaw in the background, waits for it, then starts the task server

### Test Suite
68 tests, all passing. Run with:
```bash
cd backend
pip install -e ".[dev]"
pytest tests/ -v
```

Covers: all routers, orchestrator, dispatcher, schemas, crypto, agent runtime, OpenClaw integration.

---

## Architecture

```
User → Platform API (:8000)
         │
         ├── Supabase (users, agents, credentials tables)
         ├── Docker socket (create/stop agent containers)
         │
         └── Agent Container (on openclaw-agents network)
               ├── OpenClaw Gateway (:18789) → Kimi K2.5 API
               └── Task Server (:8080) ← platform dispatches here
```

All communication between platform and agents happens over the Docker bridge network. No agent ports are exposed externally.

---

## Key Files

| File | Purpose |
|---|---|
| `backend/app/main.py` | FastAPI app entry point, includes all routers |
| `backend/app/services/orchestrator.py` | Creates/stops Docker containers, resolves container IPs |
| `backend/app/services/dispatcher.py` | Sends tasks to agent containers via HTTP |
| `backend/app/routers/tasks.py` | Task assignment API endpoints |
| `backend/app/routers/agents.py` | Agent hire/fire/list API endpoints |
| `backend/app/services/gateway.py` | Proxies requests to Gmail/Slack/Discord APIs |
| `backend/app/services/credential_store.py` | Encrypts and stores OAuth tokens |
| `backend/agent-runtime/server.py` | Task server inside each agent container |
| `backend/agent-runtime/entrypoint.sh` | Bootstraps OpenClaw config + starts both services |
| `backend/agent-runtime/Dockerfile` | Extends official OpenClaw image with our sidecar |
| `backend/agent-config/templates/secretary.yaml` | Role definition for the secretary agent |
| `backend/docker-compose.yml` | Platform service definition |

---

## How to Run Locally

See `LOCAL_SETUP.md` for full instructions. Quick version:

```bash
# 1. Make sure Docker Desktop is running

# 2. Build the agent image
docker build -t openclaw/agent:latest backend/agent-runtime/

# 3. Set up env
cp backend/.env.example backend/.env
# Edit backend/.env with your Supabase + Kimi API keys

# 4. Run Supabase migration (SQL editor or psql)

# 5. Start the platform
cd backend
pip install -e .
uvicorn app.main:app --reload --port 8000

# 6. Test it
curl http://localhost:8000/health
```

---

## Environment Variables

Set in `backend/.env`:

| Var | What |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `ENCRYPTION_KEY` | Fernet key for encrypting OAuth tokens |
| `LLM_API_KEY` | Kimi/Moonshot API key (passed to agent containers as `MOONSHOT_API_KEY`) |
| `PLATFORM_GATEWAY_URL` | How agent containers reach the platform (`http://host.docker.internal:8000/gateway` locally) |

---

## What's Left

### Backend
- [ ] Add `code-review-engineer.yaml` and `customer-support.yaml` role templates
- [ ] Add `GET /roles` endpoint so the frontend can list available roles dynamically
- [ ] Wire real GitHub OAuth redirect/callback flow
- [ ] Deploy to VPS (see `VPS_SETUP.md`)

### Frontend
- [ ] Hire flow: landing → talent directory → employee profile → hire wizard → confirmation
- [ ] Wire to backend API (create user, hire agent, connect credentials)

### Post-Hackathon
- [ ] Billing (Stripe subscriptions per agent)
- [ ] Enforcement layer (tool lockdown, output validation, scoped memory)
- [ ] More agent roles from the 10-employee list in `PROJECT_CONTEXT.md`
- [ ] Work log / performance review UI

---

## Quick API Test Flow

```bash
# Create user
curl -s -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","name":"Test"}' | jq .

# Save the api_key, then:
export API_KEY="oc_..."

# Hire an agent
curl -s -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d '{"role":"secretary"}' | jq .

# Save the agent id, then:
export AGENT_ID="..."

# Assign a task
curl -s -X POST http://localhost:8000/agents/$AGENT_ID/tasks \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d '{"instruction":"Draft a welcome email for new team members"}' | jq .

# Check status
curl -s http://localhost:8000/agents/$AGENT_ID/tasks/status \
  -H "X-Api-Key: $API_KEY" | jq .
```
