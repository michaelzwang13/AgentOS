"""Agent action log — the append-only audit stream the gateway writes a row
to for every agent-authed call. Allows are logged alongside denials so the
log is a full work history, not just a violation list.

Phase B left a `logger.warning` stub on the deny path; Phase D promotes it
to persisted rows here, and extends coverage to the allow path too. The
work-log surface and the future LLM reflection (issue #23) both read from
this table.
"""

from app.database import get_supabase

TABLE = "agent_action_log"


class ActionLogModel:
    @staticmethod
    def record(
        agent_id: str,
        action: str,
        outcome: str,
        metadata: dict | None = None,
    ) -> dict:
        """Insert one audit row.

        `outcome` is "allowed" or "denied" (matches the DB check constraint).
        `metadata` carries free-form context — e.g. the role at the time, the
        endpoint, request shape. Kept jsonb so the schema doesn't churn as we
        add fields.
        """
        data = {
            "agent_id": agent_id,
            "action": action,
            "outcome": outcome,
            "metadata": metadata or {},
        }
        result = get_supabase().table(TABLE).insert(data).execute()
        return result.data[0]

    @staticmethod
    def list_by_agent(agent_id: str, limit: int = 100) -> list[dict]:
        """Return recent rows for an agent, newest first."""
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data
