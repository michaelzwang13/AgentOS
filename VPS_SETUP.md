# VPS Setup Guide

Step-by-step instructions for deploying the OpenClaw platform and agent containers on a single VPS.

---

## 1. Provision a VPS

- **Recommended:** 2+ vCPU, 4GB+ RAM (each agent container uses up to 512MB)
- **Providers:** DigitalOcean, Hetzner, Linode, Vultr
- **OS:** Ubuntu 22.04 or 24.04 LTS

## 2. Install Docker

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install docker-compose-plugin

# Verify
docker --version
docker compose version
```

## 3. Clone the repo

```bash
git clone https://github.com/michaelzwang13/AgentOS.git
cd AgentOS
```

## 4. Set up environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your real values:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
ENCRYPTION_KEY=<generate with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
LLM_API_KEY=your-anthropic-or-openai-key
PLATFORM_GATEWAY_URL=http://platform:8000/gateway
```

The `PLATFORM_GATEWAY_URL` uses `platform` (the Docker Compose service name) so agent containers can reach the platform over the Docker network.

## 5. Build the agent runtime image

```bash
docker build -t openclaw/agent:latest backend/agent-runtime/
```

This is the image the platform spins up for each hired agent. **Do not skip this step** — if this image is missing, `docker compose up` still starts the platform, but the first `POST /agents` fails at runtime with `No such image: openclaw/agent:latest`.

## 6. Start the platform

```bash
cd backend
docker compose up -d
```

This starts the platform on port 8000 and creates the `openclaw-agents` bridge network.

## 7. Set up Supabase tables

Run the migration against your Supabase project. Easiest path:

1. Open your Supabase project → **SQL Editor** → **New query**
2. Paste the contents of `backend/migrations/001_initial_schema.sql`
3. Click **Run**

This creates the `users`, `agents`, and `credentials` tables with the RLS policies the platform expects. If you skip this, `POST /users` will fail on first call with a "relation does not exist" error.

## 8. Verify it's working

```bash
# Health check
curl http://localhost:8000/health
# -> {"status":"ok"}

# Create a user
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"Admin"}'
# -> returns user with api_key

# List available roles (should include code-review-engineer and customer-support)
curl http://localhost:8000/roles

# Hire an agent (use the api_key from above)
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: oc_your-api-key" \
  -d '{"role":"code-review-engineer"}'
# -> returns agent with id

# Assign a task
curl -X POST http://localhost:8000/agents/AGENT_ID/tasks \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: oc_your-api-key" \
  -d '{"instruction":"Review the latest PR for correctness and readability"}'

# Check task status
curl http://localhost:8000/agents/AGENT_ID/tasks/status \
  -H "X-Api-Key: oc_your-api-key"
```

## 9. (Optional) Reverse proxy with HTTPS

```bash
# Install Caddy (auto-HTTPS)
apt install -y caddy
```

Configure `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:8000
}
```

Then restart:

```bash
systemctl restart caddy
```

## 10. (Optional) Firewall

```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

Port 8080 (agent containers) is **not** exposed — it's internal to the Docker network only.

---

## Architecture on the VPS

```
VPS (your-domain.com)
|-- Caddy (ports 80/443) -> reverse proxy
|   +-- Platform container (port 8000)
|       |-- Mounts /var/run/docker.sock
|       |-- Creates agent containers on demand
|       +-- Talks to agents via Docker bridge IPs
|-- Agent container 1 (172.18.0.x:8080)
|-- Agent container 2 (172.18.0.x:8080)
+-- ... (all on openclaw-agents network)
```

The platform manages agent containers through the Docker socket. When you hire an agent, it `docker run`s a new container. When you assign a task, it resolves the container's internal IP and POSTs to `:8080/task`. Everything stays on the private Docker network — no agent ports are exposed to the internet.
