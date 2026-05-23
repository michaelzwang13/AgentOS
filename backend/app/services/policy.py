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

from app.services.template_loader import load_template

logger = logging.getLogger(__name__)


def require_action(agent: dict, action: str) -> None:
    """Raise HTTP 403 unless the agent's role template permits ``action``.

    Denied-by-default: anything not explicitly listed in the role template's
    ``allowed_actions`` is refused. A denial is recorded as an audit log line
    — Phase D promotes this stub to a persisted ``agent_action_log`` row.
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
        raise HTTPException(
            403, f"Action '{action}' is not permitted for role '{role}'"
        )

    logger.info(
        "policy: ALLOW agent=%s role=%s action=%s",
        agent.get("id"), role, action,
    )
