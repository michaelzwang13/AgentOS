import asyncio
import logging
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.ratelimit import limiter
from app.routers import (
    users, agents, gateway, credentials, tasks, roles, auth, chat,
    watched_repos,
)
from app.services.feed_poller import FeedPoller
from app.services.pr_watcher import PRWatcher

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("agentos")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the platform's background workers and cancel them cleanly on
    shutdown. Each worker is individually env-gated so the test suite (and
    ad-hoc debug runs) can disable them; defaults are all enabled.

    Workers:
    - PRWatcher        — autonomous PR review trigger (PR_WATCHER_ENABLED)
    - FeedPoller       — keeps Signal Feed cache warm (FEED_POLLER_ENABLED)
    """
    background_tasks: list[asyncio.Task] = []

    if os.getenv("PR_WATCHER_ENABLED", "true").lower() != "false":
        background_tasks.append(asyncio.create_task(PRWatcher().run_forever()))
    if os.getenv("FEED_POLLER_ENABLED", "true").lower() != "false":
        background_tasks.append(asyncio.create_task(FeedPoller().run_forever()))

    try:
        yield
    finally:
        # Cancel all tasks first, then await each — order matters: if we
        # awaited inside the cancel loop the second worker would run for a
        # tick or two after the first was already gone.
        for task in background_tasks:
            task.cancel()
        for task in background_tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="AgentOS Platform",
    description="Multi-tenant platform for hiring AI employees",
    version="0.1.0",
    lifespan=lifespan,
)

# ── Rate limiting ────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────────
# The hire-flow UI runs on a separate origin. Defaults cover local Vite dev;
# production MUST set CORS_ALLOWED_ORIGINS to the real frontend origin(s).
_cors_env = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174",
)
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Api-Key"],
)


# ── Exception handlers ───────────────────────────────────────────────────────
# Internal errors are logged in full server-side but never echoed to the
# client — responses carry only a generic message.

@app.exception_handler(httpx.HTTPStatusError)
@app.exception_handler(httpx.RequestError)
async def upstream_error_handler(request: Request, exc: Exception):
    logger.warning("Upstream call failed on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(status_code=502, content={"detail": "Upstream service error"})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(users.router)
app.include_router(agents.router)
app.include_router(credentials.router)
app.include_router(gateway.router)
app.include_router(tasks.router)
app.include_router(roles.router)
app.include_router(auth.router)
app.include_router(auth.compat_router)
app.include_router(chat.router)
app.include_router(watched_repos.router)


@app.get("/health")
def health():
    return {"status": "ok"}
