"""Lightweight FastAPI server that runs inside each agent container.

Receives tasks from the platform, forwards them to the local OpenClaw
gateway for execution, and reports results back.
"""

import asyncio
import os

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

# OpenClaw gateway runs locally in the same container
OPENCLAW_GATEWAY_URL = os.getenv("OPENCLAW_GATEWAY_URL", "http://127.0.0.1:18789")
OPENCLAW_GATEWAY_TOKEN = os.getenv("OPENCLAW_GATEWAY_TOKEN", "openclaw-internal")

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


# ── OpenClaw interaction ───────────────────────────────────────────────────


async def _send_to_openclaw(instruction: str, cancel_event: asyncio.Event) -> str:
    """Send a message to the local OpenClaw gateway via OpenAI-compatible API."""
    headers = {"Content-Type": "application/json"}
    if OPENCLAW_GATEWAY_TOKEN:
        headers["Authorization"] = f"Bearer {OPENCLAW_GATEWAY_TOKEN}"

    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            f"{OPENCLAW_GATEWAY_URL}/v1/chat/completions",
            json={
                "model": "openclaw/default",
                "messages": [{"role": "user", "content": instruction}],
            },
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        # OpenAI-compatible response format
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", str(data))
        return data.get("response", str(data))


async def _execute_task(task: TaskAssign, cancel_event: asyncio.Event) -> TaskResult:
    """Execute a task by forwarding it to the local OpenClaw instance."""
    try:
        # Check for cancellation before starting
        if cancel_event.is_set():
            return TaskResult(
                task_id=task.task_id,
                status="cancelled",
                result="Task was cancelled before execution",
            )

        # Build the full prompt with role context
        prompt_parts = []
        if task.role_context:
            prompt_parts.append(
                f"Context for this task: {task.role_context}"
            )
        prompt_parts.append(task.instruction)
        full_prompt = "\n\n".join(prompt_parts)

        # Send to OpenClaw
        result_text = await _send_to_openclaw(full_prompt, cancel_event)

        # Report result back to the platform gateway
        if PLATFORM_GATEWAY_URL:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{PLATFORM_GATEWAY_URL}/task-result",
                    json={
                        "task_id": task.task_id,
                        "agent_id": AGENT_ID,
                        "status": "success",
                        "result": result_text,
                    },
                    headers={"Authorization": f"Bearer {AGENT_TOKEN}"},
                    timeout=10,
                )

        return TaskResult(
            task_id=task.task_id,
            status="success",
            result=result_text,
        )
    except asyncio.CancelledError:
        return TaskResult(
            task_id=task.task_id,
            status="cancelled",
            result="Task was cancelled",
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
        result = await _execute_task(task, cancel_event)
        _state["last_result"] = result
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
    if _state.get("worker"):
        _state["worker"].cancel()
    return {"cancelled": True, "task_id": _state["current_task"].task_id}


@app.get("/result")
async def last_result():
    """Return the result of the last completed task."""
    result = _state.get("last_result")
    if result is None:
        raise HTTPException(404, "No task result available")
    return result


@app.get("/health")
async def health():
    # Also check if OpenClaw gateway is reachable
    openclaw_ok = False
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{OPENCLAW_GATEWAY_URL}/health")
            openclaw_ok = resp.status_code == 200
    except Exception:
        pass

    return {
        "status": "ok",
        "agent_id": AGENT_ID,
        "role": AGENT_ROLE,
        "openclaw_gateway": "connected" if openclaw_ok else "unavailable",
    }
