# Local Development Setup

Run the full OpenClaw platform and agent containers locally on your Mac for testing.

---

## Prerequisites

- **Docker Desktop for Mac** (includes Docker Compose)
- **Python 3.12+** (for running tests outside Docker)
- A **Supabase** project (free tier works)

## 1. Install Docker Desktop

Download from https://www.docker.com/products/docker-desktop/ and install. Verify:

```bash
docker --version
docker compose version
```

## 2. Clone the repo

```bash
git clone https://github.com/michaelzwang13/AgentOS.git
cd AgentOS
```

## 3. Set up environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
ENCRYPTION_KEY=<see below>
LLM_API_KEY=your-anthropic-or-openai-key
PLATFORM_GATEWAY_URL=http://host.docker.internal:8000/gateway
```

Generate the encryption key:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Note: `host.docker.internal` lets agent containers reach the platform when running it directly on the host. If running everything in Docker Compose, use `http://platform:8000/gateway` instead.

## 4. Set up Supabase tables

Go to your Supabase dashboard -> SQL Editor and run the contents of:

```
backend/migrations/001_initial_schema.sql
```

## 5. Build the agent runtime image

```bash
docker build -t openclaw/agent:latest backend/agent-runtime/
```

## 6. Option A: Run platform directly (recommended for development)

This gives you hot-reload and easier debugging.

```bash
cd backend

# Install dependencies
pip install -e ".[dev]"

# Start the platform
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The platform uses the Docker socket on your Mac to spin up agent containers. Make sure Docker Desktop is running.

## 6. Option B: Run everything in Docker Compose

```bash
cd backend
docker compose up -d
```

If using this option, change `PLATFORM_GATEWAY_URL` in `.env` to `http://platform:8000/gateway`.

## 7. Verify it's working

Open a new terminal:

```bash
# Health check
curl http://localhost:8000/health
# -> {"status":"ok"}

# Create a user
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'
# -> save the api_key from the response

# Hire an agent
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{"role":"secretary"}'
# -> save the agent id from the response

# Check agent container is running
docker ps
# -> should show openclaw-agent-XXXXXXXX container

# Assign a task
curl -X POST http://localhost:8000/agents/AGENT_ID/tasks \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{"instruction":"Draft an email to the team about the Q2 roadmap"}'

# Check task status
curl http://localhost:8000/agents/AGENT_ID/tasks/status \
  -H "X-Api-Key: YOUR_API_KEY"

# Cancel a task
curl -X POST http://localhost:8000/agents/AGENT_ID/tasks/cancel \
  -H "X-Api-Key: YOUR_API_KEY"
```

## 8. Run tests

```bash
cd backend
pip install -e ".[dev]"
pytest tests/ -v
```

All 59 tests run with mocked dependencies — no Docker or Supabase needed.

## 9. Useful commands

```bash
# See running agent containers
docker ps --filter "label=openclaw.role"

# View agent container logs
docker logs openclaw-agent-XXXXXXXX

# Stop all agent containers
docker ps --filter "label=openclaw.role" -q | xargs docker stop

# Rebuild agent image after changes
docker build -t openclaw/agent:latest backend/agent-runtime/
```

## Troubleshooting

**"Cannot connect to Docker daemon"**
- Make sure Docker Desktop is running

**Agent container starts but task dispatch fails**
- Check the agent container is on the `openclaw-agents` network: `docker network inspect openclaw-agents`
- Check the container has an IP: `docker inspect openclaw-agent-XXXXXXXX | grep IPAddress`

**Platform can't create containers**
- Docker Desktop must have the Docker socket enabled (Settings -> Advanced -> check "Allow the default Docker socket to be used")

**Tests fail with ModuleNotFoundError**
- Run `pip install -e ".[dev]"` from the `backend/` directory
