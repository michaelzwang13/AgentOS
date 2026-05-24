"""Agent data access layer backed by Supabase."""

from app.database import get_supabase

TABLE = "agents"


class AgentModel:
    @staticmethod
    def create(user_id: str, role: str, config_json: dict | None = None) -> dict:
        data = {
            "user_id": user_id,
            "role": role,
            "status": "pending",
            "config_json": config_json or {},
        }
        result = get_supabase().table(TABLE).insert(data).execute()
        return result.data[0]

    @staticmethod
    def get_by_id(agent_id: str) -> dict | None:
        result = get_supabase().table(TABLE).select("*").eq("id", agent_id).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def get_by_token(agent_token: str) -> dict | None:
        """Resolve an agent by its bearer token.

        Used by the gateway to authenticate agent-side callers. Only running
        agents carry a token — it is cleared when the agent is stopped.
        """
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("agent_token", agent_token)
            .execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def list_by_user(user_id: str) -> list[dict]:
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data

    @staticmethod
    def list_running_by_role(role: str) -> list[dict]:
        """Return every running agent for a given role.

        Used by the pr_watcher to enumerate Code Review Engineers it should
        poll on behalf of. Filters on status='running' so stopped/errored
        agents drop out of the watcher loop automatically.
        """
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("role", role)
            .eq("status", "running")
            .execute()
        )
        return result.data

    @staticmethod
    def update(agent_id: str, **fields) -> dict | None:
        result = (
            get_supabase().table(TABLE).update(fields).eq("id", agent_id).execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def delete(agent_id: str) -> bool:
        result = get_supabase().table(TABLE).delete().eq("id", agent_id).execute()
        return len(result.data) > 0
