"""Platform API endpoints for assigning tasks to agents."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.models.agent import AgentModel
from app.services.dispatcher import Dispatcher
from app.services.orchestrator import Orchestrator

router = APIRouter(prefix="/agents", tags=["tasks"])


class TaskRequest(BaseModel):
    instruction: str
    metadata: dict = {}


def _get_dispatcher() -> Dispatcher:
    return Dispatcher()


def _verify_agent_ownership(agent_id: str, user: dict) -> dict:
    agent = AgentModel.get_by_id(agent_id)
    if not agent or agent["user_id"] != user["id"]:
        raise HTTPException(404, "Agent not found")
    if agent["status"] != "running":
        raise HTTPException(409, f"Agent is not running (status: {agent['status']})")
    return agent


@router.post("/{agent_id}/tasks")
async def assign_task(
    agent_id: str,
    payload: TaskRequest,
    user: dict = Depends(get_current_user),
    dispatcher: Dispatcher = Depends(_get_dispatcher),
):
    _verify_agent_ownership(agent_id, user)
    try:
        result = await dispatcher.dispatch_task(
            agent_id, payload.instruction, payload.metadata
        )
        return result
    except Exception as e:
        raise HTTPException(502, f"Failed to reach agent: {e}")


@router.get("/{agent_id}/tasks/status")
async def get_task_status(
    agent_id: str,
    user: dict = Depends(get_current_user),
    dispatcher: Dispatcher = Depends(_get_dispatcher),
):
    _verify_agent_ownership(agent_id, user)
    try:
        return await dispatcher.get_agent_task_status(agent_id)
    except Exception as e:
        raise HTTPException(502, f"Failed to reach agent: {e}")


@router.post("/{agent_id}/tasks/cancel")
async def cancel_task(
    agent_id: str,
    user: dict = Depends(get_current_user),
    dispatcher: Dispatcher = Depends(_get_dispatcher),
):
    _verify_agent_ownership(agent_id, user)
    try:
        return await dispatcher.cancel_task(agent_id)
    except Exception as e:
        raise HTTPException(502, f"Failed to reach agent: {e}")
