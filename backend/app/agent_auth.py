"""Agent-side authentication.

The user-facing API authenticates callers with an `X-Api-Key` (see `app.auth`);
agent containers authenticate with their own scoped bearer token, minted per
agent by the orchestrator and persisted on the `agents` row while the container
runs. This is the *identity* half of the trust moat — `app.services.policy` is
the *enforcement* half.
"""

from fastapi import Header, HTTPException

from app.models.agent import AgentModel

_BEARER_PREFIX = "Bearer "


def get_current_agent(authorization: str | None = Header(None)) -> dict:
    """Resolve the calling agent from an `Authorization: Bearer <token>` header.

    A missing header and an unknown token both yield 401, so the endpoint
    behaves consistently for any unauthenticated request. The returned dict is
    the full agents row — callers rely on `role` (for the policy check) and
    `user_id` (to fetch the user's stored third-party credentials).
    """
    if not authorization or not authorization.startswith(_BEARER_PREFIX):
        raise HTTPException(401, "Missing agent token")
    token = authorization[len(_BEARER_PREFIX):].strip()
    agent = AgentModel.get_by_token(token)
    if not agent:
        raise HTTPException(401, "Invalid agent token")
    return agent
