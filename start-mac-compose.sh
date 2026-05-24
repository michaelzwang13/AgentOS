#!/usr/bin/env bash
set -euo pipefail

# Mac (Apple Silicon) — Compose-mode start.
# Runs the platform INSIDE Docker on the openclaw-agents bridge network so
# task dispatch to agent containers actually works. start-mac.sh runs the
# platform natively (faster --reload iteration) but can't dispatch on Mac
# because Docker Desktop blocks the host from reaching container bridge IPs.
# Use this script for full end-to-end (hire → subscribe → dispatch → review).

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

cleanup() {
    echo ""
    warn "Shutting down..."
    [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null && log "Frontend stopped"
    (cd "$BACKEND" && docker compose down) >/dev/null 2>&1 && log "Platform container stopped"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}   AgentOS — Start (Compose mode)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# ─── Preflight ──────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    err "Docker not found. Install Docker Desktop: https://docker.com/products/docker-desktop"
    exit 1
fi
if ! docker info &>/dev/null 2>&1; then
    err "Docker daemon not running. Start Docker Desktop first."
    exit 1
fi
log "Docker is running"

if [ ! -f "$BACKEND/.env" ]; then
    err "Missing backend/.env — copy backend/.env.example and fill in your keys"
    exit 1
fi
log "Backend .env found"

if ! command -v node &>/dev/null; then
    err "Node.js not found. Install Node 18+: https://nodejs.org"
    exit 1
fi
log "Node found: $(node --version)"

# ─── Docker network ─────────────────────────────────────────────────
# The compose file marks this as external, so we have to create it first
# if it doesn't already exist. Same network used by spawned agent
# containers, so it's the shared fabric.
if ! docker network inspect openclaw-agents &>/dev/null 2>&1; then
    docker network create openclaw-agents >/dev/null
    log "Created Docker network: openclaw-agents"
else
    log "Docker network exists: openclaw-agents"
fi

# ─── Agent runtime image ────────────────────────────────────────────
# Must exist before any agent is hired. Rebuilt every start so changes
# under backend/agent-runtime/ (skills, entrypoint, etc.) land.
info "Building agent container image..."
docker build -t openclaw/agent:latest "$BACKEND/agent-runtime/" -q
log "Agent image built: openclaw/agent:latest"

# ─── Platform (Compose) ─────────────────────────────────────────────
# docker-compose.yml places the platform on the openclaw-agents bridge
# network, mounts the Docker socket, and publishes :8000 to the host.
# --build picks up any changes to backend/app/ since the last start.
info "Building and starting platform via Compose..."
cd "$BACKEND"
docker compose up -d --build
log "Platform container starting"

info "Waiting for platform /health..."
for i in {1..30}; do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        log "Platform is up"
        break
    fi
    if [ "$i" -eq 30 ]; then
        err "Platform failed to become healthy after 30s. Last logs:"
        docker compose logs platform | tail -50
        exit 1
    fi
    sleep 1
done

# ─── Frontend (native) ──────────────────────────────────────────────
# Stays native — it just needs to reach :8000, which is published.
info "Installing frontend dependencies..."
cd "$FRONTEND"
if command -v bun &>/dev/null; then
    bun install --silent 2>/dev/null || bun install
    log "Frontend dependencies installed (bun)"
    info "Starting frontend on http://localhost:5173 ..."
    bun run dev &
elif command -v npm &>/dev/null; then
    npm install --silent 2>/dev/null || npm install
    log "Frontend dependencies installed (npm)"
    info "Starting frontend on http://localhost:5173 ..."
    npm run dev &
else
    err "Neither bun nor npm found. Install one of them."
    exit 1
fi
FRONTEND_PID=$!

for i in {1..20}; do
    if curl -sf http://localhost:5173 >/dev/null 2>&1; then
        log "Frontend is up"
        break
    fi
    if [ "$i" -eq 20 ]; then
        warn "Frontend still starting..."
    fi
    sleep 1
done

# ─── Ready ──────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}   AgentOS is running (Compose mode)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend:       ${CYAN}http://localhost:5173${NC}"
echo -e "  Backend API:    ${CYAN}http://localhost:8000${NC}"
echo -e "  API docs:       ${CYAN}http://localhost:8000/docs${NC}"
echo -e "  Platform logs:  ${CYAN}cd backend && docker compose logs -f platform${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop everything"
echo ""

wait
