"""User-side endpoints for subscribing agents to repos.

The pr_watcher reads these rows to decide which (agent, owner, repo)
combinations to poll on each tick. Cross-agent uniqueness is enforced
at the DB level so we surface the conflict here as a 409.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.models.agent import AgentModel
from app.models.watched_repo import WatchedRepoExists, WatchedRepoModel
from app.schemas.watched_repo import WatchedRepoCreate, WatchedRepoResponse

router = APIRouter(prefix="/agents", tags=["watched-repos"])


def _resolve_owned_agent(agent_id: str, user_id: str) -> dict:
    """Fetch the agent and require it to belong to the caller.

    404 hides the existence of agents owned by other users — same shape
    as the existing /agents/{id} handler.
    """
    agent = AgentModel.get_by_id(agent_id)
    if not agent or agent["user_id"] != user_id:
        raise HTTPException(404, "Agent not found")
    return agent


@router.post(
    "/{agent_id}/watched-repos",
    response_model=WatchedRepoResponse,
    status_code=201,
)
def subscribe_repo(
    agent_id: str,
    payload: WatchedRepoCreate,
    user: dict = Depends(get_current_user),
):
    _resolve_owned_agent(agent_id, user["id"])
    try:
        return WatchedRepoModel.create(
            agent_id=agent_id,
            user_id=user["id"],
            owner=payload.owner,
            repo=payload.repo,
        )
    except WatchedRepoExists as exc:
        raise HTTPException(409, str(exc))


@router.get(
    "/{agent_id}/watched-repos",
    response_model=list[WatchedRepoResponse],
)
def list_watched_repos(
    agent_id: str,
    user: dict = Depends(get_current_user),
):
    _resolve_owned_agent(agent_id, user["id"])
    return WatchedRepoModel.list_by_agent(agent_id)


@router.delete(
    "/{agent_id}/watched-repos/{watched_id}",
    status_code=204,
)
def unsubscribe_repo(
    agent_id: str,
    watched_id: str,
    user: dict = Depends(get_current_user),
):
    _resolve_owned_agent(agent_id, user["id"])
    row = WatchedRepoModel.get_by_id(watched_id)
    if not row or row["agent_id"] != agent_id:
        raise HTTPException(404, "Watched repo not found")
    WatchedRepoModel.delete(watched_id)
