#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/app"

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
    # Kill background processes
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
$PYTHON -m pip install -e ".[dev]" -q 2>/dev/null || $PYTHON -m pip install -e . -q
log "Backend dependencies installed"

info "Starting backend on http://localhost:8000 ..."
cd "$BACKEND"
$PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
for i in {1..15}; do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
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
if [ -f "package-lock.json" ]; then
    npm ci --silent 2>/dev/null || npm install --silent
else
    npm install --silent
fi
log "Frontend dependencies installed"

info "Starting frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend
for i in {1..30}; do
    if curl -sf http://localhost:3000 >/dev/null 2>&1; then
        log "Frontend is up"
        break
    fi
    if [ "$i" -eq 30 ]; then
        warn "Frontend still starting (may take a moment with Next.js compilation)"
    fi
    sleep 1
done

# ─── Ready ──────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Platform is running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Backend API:  ${CYAN}http://localhost:8000${NC}"
echo -e "  API docs:     ${CYAN}http://localhost:8000/docs${NC}"
echo -e "  Frontend:     ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop everything"
echo ""

# Keep script alive
wait
