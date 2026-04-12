"""Lightweight FastAPI server that runs inside each agent container.

Receives tasks from the platform, reports status, and supports cancellation.
"""

import asyncio
import os
import uuid

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ── Env config ──────────────────────────────────────────────────────────────

AGENT_ID = os.getenv("AGENT_ID", "unknown")
AGENT_ROLE = os.getenv("AGENT_ROLE", "generic")
USER_ID = os.getenv("USER_ID", "")
PLATFORM_GATEWAY_URL = os.getenv("PLATFORM_GATEWAY_URL", "")
AGENT_TOKEN = os.getenv("AGENT_TOKEN", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")

# ── Schemas ─────────────────────────────────────────────────────────────────


class TaskAssign(BaseModel):
    task_id: str
    instruction: str
    role_context: dict = {}
    metadata: dict = {}


class TaskResult(BaseModel):
    task_id: str
    status: str  # success | failed | cancelled
    result: str = ""
    error: str | None = None


class StatusResponse(BaseModel):
    agent_id: str
    state: str  # idle | busy | error
    current_task: TaskAssign | None = None


# ── App state ───────────────────────────────────────────────────────────────

app = FastAPI(title="OpenClaw Agent Runtime")

_state: dict = {
    "status": "idle",  # idle | busy | error
    "current_task": None,
    "cancel_event": None,
    "worker": None,
}


# ── Task execution (placeholder) ───────────────────────────────────────────


async def _execute_task(task: TaskAssign, cancel_event: asyncio.Event) -> TaskResult:
    """Execute a task. This is the main extension point for real agent logic."""
    try:
        # Placeholder: simulate work in 1-second increments so we can cancel
        for _ in range(5):
            if cancel_event.is_set():
                return TaskResult(
                    task_id=task.task_id,
                    status="cancelled",
                    result="Task was cancelled",
                )
            await asyncio.sleep(1)

        # Report result back to the platform gateway
        if PLATFORM_GATEWAY_URL:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{PLATFORM_GATEWAY_URL}/task-result",
                    json={
                        "task_id": task.task_id,
                        "agent_id": AGENT_ID,
                        "status": "success",
                        "result": f"Completed task: {task.instruction}",
                    },
                    headers={"Authorization": f"Bearer {AGENT_TOKEN}"},
                    timeout=10,
                )

        return TaskResult(
            task_id=task.task_id,
            status="success",
            result=f"Completed task: {task.instruction}",
        )
    except Exception as exc:
        return TaskResult(
            task_id=task.task_id,
            status="failed",
            error=str(exc),
        )


async def _run_task(task: TaskAssign, cancel_event: asyncio.Event):
    """Background wrapper that updates state after task completes."""
    try:
        await _execute_task(task, cancel_event)
    finally:
        _state["status"] = "idle"
        _state["current_task"] = None
        _state["cancel_event"] = None
        _state["worker"] = None


# ── Endpoints ───────────────────────────────────────────────────────────────


@app.post("/task")
async def receive_task(task: TaskAssign):
    if _state["status"] == "busy":
        raise HTTPException(409, "Agent is already executing a task")

    cancel_event = asyncio.Event()
    _state["status"] = "busy"
    _state["current_task"] = task
    _state["cancel_event"] = cancel_event
    _state["worker"] = asyncio.create_task(_run_task(task, cancel_event))

    return {"accepted": True, "task_id": task.task_id}


@app.get("/status")
async def status():
    return StatusResponse(
        agent_id=AGENT_ID,
        state=_state["status"],
        current_task=_state["current_task"],
    )


@app.post("/cancel")
async def cancel_task():
    if _state["status"] != "busy" or _state["cancel_event"] is None:
        raise HTTPException(409, "No active task to cancel")

    _state["cancel_event"].set()
    return {"cancelled": True, "task_id": _state["current_task"].task_id}


@app.get("/health")
async def health():
    return {"status": "ok", "agent_id": AGENT_ID, "role": AGENT_ROLE}
