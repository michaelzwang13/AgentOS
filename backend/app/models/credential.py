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
    def list_active_services() -> list[dict]:
        """Return every (user_id, service) pair that currently has a credential.

        Used by the Signal Feed poller to enumerate the work it needs to do
        each tick. Returns minimal columns — the poller doesn't need the
        token (the fetcher will re-fetch the credential anyway)."""
        result = (
            get_supabase()
            .table(TABLE)
            .select("user_id, service")
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
