"""Server-side action policy — the enforcement half of the trust moat.

Phase A decides which skills an agent *has*; this module enforces what an agent
is *allowed to do* at the gateway, regardless of what its skills or LLM attempt.
Enforcement is denied-by-default: an action absent from the role template's
`allowed_actions` is refused with HTTP 403.

A gateway endpoint declares its own stable action id (e.g. ``github.review.submit``)
and calls :func:`require_action` before doing any work.
"""

import logging

from fastapi import HTTPException

from app.models.action_log import ActionLogModel
from app.services.template_loader import load_template

logger = logging.getLogger(__name__)


def _audit(agent_id: str | None, action: str, outcome: str, role: str) -> None:
    """Persist one agent_action_log row; never raise into the request path.

    The audit write must not break the underlying request — a DB hiccup
    should log locally and let the gateway response proceed normally.
    """
    if not agent_id:
        return
    try:
        ActionLogModel.record(
            agent_id=agent_id,
            action=action,
            outcome=outcome,
            metadata={"role": role},
        )
    except Exception as exc:  # noqa: BLE001 — best-effort audit
        logger.warning("policy: audit write failed (%s): %s", outcome, exc)


def require_action(agent: dict, action: str) -> None:
    """Raise HTTP 403 unless the agent's role template permits ``action``.

    Denied-by-default: anything not explicitly listed in the role template's
    ``allowed_actions`` is refused. Both outcomes write a row to
    ``agent_action_log`` — Phase D promoted Phase B's deny-only log line to
    a persisted audit stream that covers allow + deny.
    """
    role = agent.get("role", "")
    try:
        allowed = load_template(role).get("allowed_actions") or []
    except Exception:
        # An unknown/unloadable role has no permitted actions — deny.
        allowed = []

    if action not in allowed:
        logger.warning(
            "policy: DENY agent=%s role=%s action=%s (not in allowed_actions)",
            agent.get("id"), role, action,
        )
        _audit(agent.get("id"), action, "denied", role)
        raise HTTPException(
            403, f"Action '{action}' is not permitted for role '{role}'"
        )

    logger.info(
        "policy: ALLOW agent=%s role=%s action=%s",
        agent.get("id"), role, action,
    )
    _audit(agent.get("id"), action, "allowed", role)
