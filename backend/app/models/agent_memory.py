"""Per-agent memory — the key/value store the agent writes via the
update-memory skill and reads back as injected role_context at dispatch.

Rows are scoped to (agent_id, key). Last-write-wins on the same key
(updated_at refreshes); the row count grows with the number of distinct
preferences, not with task volume. Compaction strategies are tracked in
issue #23.
"""

from datetime import datetime, timezone

from app.database import get_supabase

TABLE = "agent_memory"


class AgentMemoryModel:
    @staticmethod
    def list_by_agent(agent_id: str) -> list[dict]:
        """Return every memory row for an agent, newest write first."""
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("agent_id", agent_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return result.data

    @staticmethod
    def get(agent_id: str, key: str) -> dict | None:
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("agent_id", agent_id)
            .eq("key", key)
            .execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def upsert(agent_id: str, key: str, value: str) -> dict:
        """Set the value for (agent_id, key), refreshing updated_at."""
        data = {
            "agent_id": agent_id,
            "key": key,
            "value": value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        result = (
            get_supabase()
            .table(TABLE)
            .upsert(data, on_conflict="agent_id,key")
            .execute()
        )
        return result.data[0]

    @staticmethod
    def delete(agent_id: str, key: str) -> bool:
        result = (
            get_supabase()
            .table(TABLE)
            .delete()
            .eq("agent_id", agent_id)
            .eq("key", key)
            .execute()
        )
        return len(result.data) > 0
