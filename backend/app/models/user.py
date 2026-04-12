"""User data access layer backed by Supabase."""

from uuid import uuid4
import secrets
from app.database import get_supabase

TABLE = "users"


class UserModel:
    @staticmethod
    def create(email: str, name: str) -> dict:
        api_key = f"oc_{secrets.token_urlsafe(32)}"
        data = {"email": email, "name": name, "api_key": api_key}
        result = get_supabase().table(TABLE).insert(data).execute()
        return result.data[0]

    @staticmethod
    def get_by_id(user_id: str) -> dict | None:
        result = get_supabase().table(TABLE).select("*").eq("id", user_id).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def get_by_api_key(api_key: str) -> dict | None:
        result = get_supabase().table(TABLE).select("*").eq("api_key", api_key).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def get_by_email(email: str) -> dict | None:
        result = get_supabase().table(TABLE).select("*").eq("email", email).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def list_all(limit: int = 50, offset: int = 0) -> list[dict]:
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data

    @staticmethod
    def delete(user_id: str) -> bool:
        result = get_supabase().table(TABLE).delete().eq("id", user_id).execute()
        return len(result.data) > 0
