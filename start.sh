#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/design-ui"

# Colors
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
    [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null && log "Backend stopped"
    [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null && log "Frontend stopped"
    exit 0
}
trap cleanup SIGINT SIGTERM

# ─── Preflight checks ───────────────────────────────────────────────

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}   OpenClaw AI Employee Platform — Start${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
    err "Docker not found. Install Docker Desktop: https://docker.com/products/docker-desktop"
    exit 1
fi
if ! docker info &>/dev/null 2>&1; then
    err "Docker daemon not running. Start Docker Desktop first."
    exit 1
fi
log "Docker is running"

# Check Python
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    err "Python 3 not found. Install Python 3.12+."
    exit 1
fi
PYVER=$($PYTHON --version 2>&1)
log "Python found: $PYVER"

# Check Node
if ! command -v node &>/dev/null; then
    err "Node.js not found. Install Node 18+: https://nodejs.org"
    exit 1
fi
NODEVER=$(node --version)
log "Node found: $NODEVER"

# Check .env
if [ ! -f "$BACKEND/.env" ]; then
    err "Missing backend/.env — copy backend/.env.example and fill in your keys"
    exit 1
fi
log "Backend .env found"

# ─── Docker: build agent image + create network ─────────────────────

info "Building agent container image..."
docker build -t openclaw/agent:latest "$BACKEND/agent-runtime/" -q
log "Agent image built: openclaw/agent:latest"

if ! docker network inspect openclaw-agents &>/dev/null 2>&1; then
    docker network create openclaw-agents >/dev/null
    log "Created Docker network: openclaw-agents"
else
    log "Docker network exists: openclaw-agents"
fi

# ─── Backend: install deps + start ──────────────────────────────────

info "Installing backend dependencies..."
cd "$BACKEND"
if [ ! -d ".venv" ]; then
    $PYTHON -m venv .venv
    log "Created Python virtual environment"
fi
source .venv/bin/activate
pip install fastapi uvicorn httpx "pydantic[email]" pydantic-settings cryptography supabase anthropic docker pyyaml email-validator -q 2>/dev/null || \
    pip install fastapi uvicorn httpx "pydantic[email]" pydantic-settings cryptography supabase anthropic docker pyyaml email-validator
log "Backend dependencies installed"

BACKEND_PORT="${BACKEND_PORT:-8000}"
info "Starting backend on http://localhost:$BACKEND_PORT ..."
python -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

# Wait for backend to be ready
for i in {1..15}; do
    if curl -sf "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        log "Backend is up"
        break
    fi
    if [ "$i" -eq 15 ]; then
        err "Backend failed to start after 15s"
        exit 1
    fi
    sleep 1
done

# ─── Frontend: install deps + start ─────────────────────────────────

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

# Wait for frontend
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
echo -e "${GREEN}   Platform is running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend:     ${CYAN}http://localhost:5173${NC}"
echo -e "  Backend API:  ${CYAN}http://localhost:8000${NC}"
echo -e "  API docs:     ${CYAN}http://localhost:8000/docs${NC}"
echo ""
echo -e "  1. Go to ${CYAN}http://localhost:5173/login${NC} to create an account"
echo -e "  2. Then open ${CYAN}http://localhost:5173/agents${NC} for the Signal Feed"
echo -e "  3. Click CONNECT on any tab to link Slack/Gmail/GitHub"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop everything"
echo ""

# Keep script alive
wait
