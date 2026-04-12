from fastapi import FastAPI
from app.routers import users, agents, gateway, credentials, tasks, roles

app = FastAPI(
    title="OpenClaw Platform",
    description="Multi-tenant platform for hiring OpenClaw agents as specialized roles",
    version="0.1.0",
)

app.include_router(users.router)
app.include_router(agents.router)
app.include_router(credentials.router)
app.include_router(gateway.router)
app.include_router(tasks.router)
app.include_router(roles.router)


@app.get("/health")
def health():
    return {"status": "ok"}
