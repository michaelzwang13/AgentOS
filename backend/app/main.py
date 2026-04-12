import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import users, agents, gateway, credentials, tasks, roles, auth

app = FastAPI(
    title="AgentOS Platform",
    description="Multi-tenant platform for hiring AI employees",
    version="0.1.0",
)

# The Next.js hire-flow UI runs on a different origin (localhost:3000 in dev,
# configurable for deploys via CORS_ALLOWED_ORIGINS=comma,separated).
_cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(agents.router)
app.include_router(credentials.router)
app.include_router(gateway.router)
app.include_router(tasks.router)
app.include_router(roles.router)
app.include_router(auth.router)


@app.get("/health")
def health():
    return {"status": "ok"}
