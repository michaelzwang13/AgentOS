#!/usr/bin/env bash
set -euo pipefail

# Mac (Apple Silicon) variant of start.sh.
# Forces arm64 for all Python operations so native wheels (pydantic-core,
# mmh3, etc.) don't accidentally install as x86_64 under Rosetta. If you're
# on Intel Mac or Linux, use ./start.sh instead.

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
    [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null && log "Backend stopped"
    [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null && log "Frontend stopped"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}   AgentOS — Start (Mac / Apple Silicon)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# ─── Platform guard ─────────────────────────────────────────────────
if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
    warn "This script is for Apple Silicon Macs. On Intel Mac or Linux, use ./start.sh"
    warn "Detected: $(uname -s) $(uname -m) — continuing anyway, but arch -arm64 may fail."
fi

if ! command -v arch &>/dev/null; then
    err "arch command not found (expected on macOS)."
    exit 1
fi

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

if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    err "Python 3 not found. Install Python 3.12+."
    exit 1
fi
PYVER=$(arch -arm64 $PYTHON --version 2>&1)
log "Python found (arm64): $PYVER"

if ! command -v node &>/dev/null; then
    err "Node.js not found. Install Node 18+: https://nodejs.org"
    exit 1
fi
log "Node found: $(node --version)"

if [ ! -f "$BACKEND/.env" ]; then
    err "Missing backend/.env — copy backend/.env.example and fill in your keys"
    exit 1
fi
log "Backend .env found"

# ─── Docker image + network ─────────────────────────────────────────
info "Building agent container image..."
docker build -t openclaw/agent:latest "$BACKEND/agent-runtime/" -q
log "Agent image built: openclaw/agent:latest"

if ! docker network inspect openclaw-agents &>/dev/null 2>&1; then
    docker network create openclaw-agents >/dev/null
    log "Created Docker network: openclaw-agents"
else
    log "Docker network exists: openclaw-agents"
fi

# ─── Backend: arm64 venv + start ────────────────────────────────────
info "Setting up backend under arm64..."
cd "$BACKEND"

if [ ! -d ".venv" ]; then
    arch -arm64 "$PYTHON" -m venv .venv
    log "Created arm64 Python virtual environment"
fi

# Detect if the venv has any x86_64 wheels and warn (force-reinstall path).
if arch -arm64 .venv/bin/python -c "import pydantic_core" 2>/dev/null; then
    log "Existing venv looks arm64-clean"
else
    warn "Existing venv has missing or x86_64 deps — force-reinstalling under arm64"
    arch -arm64 .venv/bin/python -m pip install --force-reinstall --no-cache-dir \
        fastapi uvicorn httpx "pydantic[email]" pydantic-settings cryptography \
        supabase anthropic docker pyyaml email-validator -q
fi

# Ensure deps are at least present (cheap re-check).
arch -arm64 .venv/bin/python -m pip install -q \
    fastapi uvicorn httpx "pydantic[email]" pydantic-settings cryptography \
    supabase anthropic docker pyyaml email-validator
log "Backend dependencies installed (arm64)"

BACKEND_PORT="${BACKEND_PORT:-8000}"
info "Starting backend on http://localhost:$BACKEND_PORT ..."
arch -arm64 .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

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

# ─── Frontend ───────────────────────────────────────────────────────
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
echo -e "${GREEN}   AgentOS is running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend:     ${CYAN}http://localhost:5173${NC}"
echo -e "  Backend API:  ${CYAN}http://localhost:8000${NC}"
echo -e "  API docs:     ${CYAN}http://localhost:8000/docs${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop everything"
echo ""

wait
