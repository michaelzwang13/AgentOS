# Local Development Setup

Run the full OpenClaw platform, agent containers, and hire-flow frontend on your Mac. This is the authoritative setup guide for the hackathon — the MVP demo runs **entirely locally** on Docker Desktop, no VPS.

> Retiring note: `VPS_SETUP.md` is retired as of 2026-04-12. VPS deploy is post-hackathon.

---

## What runs where

```
Host (your Mac)
├── Frontend: Next.js dev server  → http://localhost:3000
│   (app/, npm run dev)
└── Docker Desktop
    └── openclaw-agents bridge network
        ├── Platform container     → localhost:8000
        │   (backend/, FastAPI, has Docker socket mounted)
        └── Agent containers       → 172.x.x.x:8080 (internal only)
            (spawned on demand by the platform per hire)
```

- **Frontend** runs natively on the host so you get fast reloads.
- **Platform + agents** both live inside Docker on the same bridge network, which is what makes platform→agent task dispatch work on Mac without any port-publishing tricks (see the networking section at the bottom for why).
- **Supabase** stays cloud-hosted — it's the one external dependency.

---

## Prerequisites

- **Docker Desktop for Mac** — https://www.docker.com/products/docker-desktop/
- **Node 20+** and **npm** (for the frontend)
- **Python 3.12+** (only if you want to run the backend test suite outside Docker)
- A **Supabase** project (free tier is fine)

Verify Docker:

```bash
docker --version
docker compose version
```

---

## 1. Clone the repo

```bash
git clone https://github.com/michaelzwang13/AgentOS.git
cd AgentOS
```

## 2. Configure backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
ENCRYPTION_KEY=<generate with the command below>
LLM_API_KEY=your-anthropic-or-openai-key
# PLATFORM_GATEWAY_URL is already correct for Docker Compose — leave it.
```

Generate the encryption key:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## 3. Create the Supabase tables

In your Supabase project → **SQL Editor** → **New query** → paste the contents of `backend/migrations/001_initial_schema.sql` → **Run**.

If you skip this, `POST /users` fails on first call with a `relation "users" does not exist` error.

## 4. Build the agent runtime image

```bash
docker build -t openclaw/agent:latest backend/agent-runtime/
```

**Do not skip this.** If this image is missing, `docker compose up` still starts the platform, but the first `POST /agents` fails at runtime with `No such image: openclaw/agent:latest`.

## 5. Start the platform

```bash
cd backend
docker compose up -d
```

This boots the platform container at `localhost:8000` and creates the `openclaw-agents` bridge network. From now on, every hire the platform receives spawns a new agent container on this network.

Tail logs if you want to see what's happening:

```bash
docker compose logs -f platform
```

## 6. Smoke test the backend

```bash
# Platform alive?
curl http://localhost:8000/health
# -> {"status":"ok"}

# Roles available?
curl http://localhost:8000/roles
# -> includes code-review-engineer, customer-support, secretary

# Create a user (save the returned api_key)
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"Admin"}'

# Hire an agent
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{"role":"code-review-engineer"}'

# Verify the container is live
docker ps --filter "label=openclaw.role"
# -> openclaw-agent-XXXXXXXX on openclaw-agents network
```

If all four commands work, the backend side of the demo bar is reached.

## 7. Start the frontend

In a second terminal:

```bash
cd app
npm install          # first time only
npm run dev
```

Open `http://localhost:3000`. The frontend hits the platform at `http://localhost:8000` via its Next.js API routes. If your `NEXT_PUBLIC_PLATFORM_URL` is unset, add it to `app/.env.local`:

```
NEXT_PUBLIC_PLATFORM_URL=http://localhost:8000
```

For GitHub OAuth (the one real OAuth provider), also set:

```
GITHUB_OAUTH_CLIENT_ID=<from github.com/settings/developers>
GITHUB_OAUTH_CLIENT_SECRET=<from github.com/settings/developers>
```

See `app/HANDOFF.md` for the full frontend env + OAuth split — the backend does not own the OAuth dance.

---

## Architecture and networking — how the arrows actually work

The flow for one hire:

```
Browser ──► Next.js API route ──► Platform ──► Docker SDK ──► Agent container
(localhost:3000)  (localhost:3000)  (localhost:8000 host ─┐
                                     platform:8000 bridge) │
                                                           ▼
                                             172.x.x.x:8080 on bridge
```

**Browser → Platform.** The browser never hits `localhost:8000` directly. All backend calls go through the Next.js API routes under `app/api/`, which then forward to the platform. This keeps the frontend's contract stable even if the platform URL changes.

**Platform → Agent (task dispatch).** The platform runs *inside* the `openclaw-agents` Docker network, so when it spawns an agent container via the Docker SDK and resolves the agent's bridge IP (e.g., `172.18.0.5`), it can POST directly to `http://172.18.0.5:8080/task`. This only works because both containers sit on the same bridge network — **this is why the platform must run in Compose and not natively on the host.** Docker Desktop Mac blocks the host from reaching container bridge IPs by default, so a native-uvicorn platform would successfully *create* agent containers but fail to *dispatch tasks* to them.

**Agent → Platform (gateway callbacks).** When an agent needs to call an external API (GitHub, Slack, Gmail) it POSTs to the platform's gateway at `http://platform:8000/gateway`. The hostname `platform` resolves via Docker's built-in DNS — it's the Compose service name. This is why `PLATFORM_GATEWAY_URL=http://platform:8000/gateway` is the committed default in `backend/.env.example`.

**Frontend → Agent: never.** The browser and agents have no direct connection. Port 8080 is never published to the host. Everything the frontend sees about an agent comes from the platform's responses.

### Why this setup is robust on Mac

- No need to publish agent ports (`-p 18080:8080` × N agents).
- No `host.docker.internal` hacks.
- The bridge network is the shared fabric; service-name DNS does the rest.
- To tear everything down, `docker compose down` plus stopping orphan agent containers:
  ```bash
  docker ps --filter "label=openclaw.role" -q | xargs -r docker stop
  ```

---

## Optional: native backend for hot-reload dev

If you're iterating on `backend/app/` and want reload-on-save, you can skip step 5 and run:

```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Caveat:** in this mode the platform can *hire* agents but cannot *dispatch tasks* to them on Docker Desktop Mac — the host can't reach bridge IPs. This is fine for iterating on routers, schemas, or orchestration logic, but you cannot exercise the full hire→dispatch loop. For that, use step 5's Compose mode.

---

## Running the test suite

```bash
cd backend
pip install -e ".[dev]"
pytest
```

All 68 tests run with mocked Supabase and Docker — no live infra required.

---

## Useful commands

```bash
# See running agent containers
docker ps --filter "label=openclaw.role"

# View an agent container's logs
docker logs openclaw-agent-XXXXXXXX

# Stop every agent container
docker ps --filter "label=openclaw.role" -q | xargs -r docker stop

# Rebuild the agent image after editing agent-runtime/
docker build -t openclaw/agent:latest backend/agent-runtime/

# Restart the platform after editing backend/app/ in Compose mode
docker compose restart platform
```

## Troubleshooting

**"Cannot connect to Docker daemon"**
Docker Desktop isn't running. Start it.

**`POST /agents` returns 500 with "No such image: openclaw/agent:latest"**
You skipped step 4. Run the agent image build.

**`POST /users` returns a 500 with "relation ... does not exist"**
You skipped step 3. Run the Supabase migration.

**Agent container starts but task dispatch hangs/fails**
You're running the platform natively (hot-reload mode). Task dispatch only works when the platform runs in Compose. Go back to step 5.

**Frontend shows "network error" on Hire**
Check `NEXT_PUBLIC_PLATFORM_URL` in `app/.env.local` and confirm `curl http://localhost:8000/health` works from your terminal.

**Docker Desktop can't bind to Docker socket**
Docker Desktop → Settings → Advanced → **Allow the default Docker socket to be used**.
