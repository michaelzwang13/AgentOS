from fastapi import APIRouter, Depends, Header, HTTPException
from app.auth import get_current_user
from app.schemas.agent import AgentCreate, AgentResponse, AgentStatusResponse
from app.services.orchestrator import Orchestrator
from app.services.template_loader import UnknownRoleError

router = APIRouter(prefix="/agents", tags=["agents"])


def _get_orchestrator() -> Orchestrator:
    return Orchestrator()


@router.post("", response_model=AgentResponse, status_code=201)
def hire_agent(
    payload: AgentCreate,
    user: dict = Depends(get_current_user),
    x_api_key: str = Header(...),
    orch: Orchestrator = Depends(_get_orchestrator),
):
    try:
        return orch.create_agent(user["id"], payload.role, payload.config, user_api_key=x_api_key)
    except UnknownRoleError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(500, str(e))


@router.get("", response_model=list[AgentResponse])
def list_agents(
    user: dict = Depends(get_current_user),
    orch: Orchestrator = Depends(_get_orchestrator),
):
    return orch.list_user_agents(user["id"])


@router.get("/{agent_id}", response_model=AgentStatusResponse)
def get_agent(
    agent_id: str,
    user: dict = Depends(get_current_user),
    orch: Orchestrator = Depends(_get_orchestrator),
):
    agent = orch.get_agent_status(agent_id)
    if not agent or agent["user_id"] != user["id"]:
        raise HTTPException(404, "Agent not found")
    return agent


@router.delete("/{agent_id}", status_code=204)
def fire_agent(
    agent_id: str,
    user: dict = Depends(get_current_user),
    orch: Orchestrator = Depends(_get_orchestrator),
):
    from app.models.agent import AgentModel

    agent = AgentModel.get_by_id(agent_id)
    if not agent or agent["user_id"] != user["id"]:
        raise HTTPException(404, "Agent not found")
    orch.stop_agent(agent_id)
