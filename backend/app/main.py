from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import users, agents, gateway, credentials, auth, tasks

app = FastAPI(
    title="AgentOS Platform",
    description="Multi-tenant platform for hiring AI employees",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(agents.router)
app.include_router(credentials.router)
app.include_router(gateway.router)
app.include_router(auth.router)
app.include_router(tasks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
