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
    def update(agent_id: str, **fields) -> dict | None:
        result = (
            get_supabase().table(TABLE).update(fields).eq("id", agent_id).execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def delete(agent_id: str) -> bool:
        result = get_supabase().table(TABLE).delete().eq("id", agent_id).execute()
        return len(result.data) > 0
