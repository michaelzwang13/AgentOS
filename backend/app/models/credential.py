"""Credential data access layer backed by Supabase."""

from app.database import get_supabase

TABLE = "credentials"


class CredentialModel:
    @staticmethod
    def upsert(
        user_id: str, service: str, encrypted_token: str, scopes: list[str]
    ) -> dict:
        data = {
            "user_id": user_id,
            "service": service,
            "encrypted_token": encrypted_token,
            "scopes": scopes,
        }
        result = (
            get_supabase()
            .table(TABLE)
            .upsert(data, on_conflict="user_id,service")
            .execute()
        )
        return result.data[0]

    @staticmethod
    def get(user_id: str, service: str) -> dict | None:
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("user_id", user_id)
            .eq("service", service)
            .execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def list_by_user(user_id: str) -> list[dict]:
        result = (
            get_supabase()
            .table(TABLE)
            .select("id, service, scopes, created_at")
            .eq("user_id", user_id)
            .execute()
        )
        return result.data

    @staticmethod
    def delete(user_id: str, service: str) -> bool:
        result = (
            get_supabase()
            .table(TABLE)
            .delete()
            .eq("user_id", user_id)
            .eq("service", service)
            .execute()
        )
        return len(result.data) > 0
