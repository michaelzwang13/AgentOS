from app.models.credential import CredentialModel
from app.utils.crypto import encrypt, decrypt


class CredentialStore:
    @staticmethod
    def store(user_id: str, service: str, token: str, scopes: list[str]) -> dict:
        encrypted = encrypt(token)
        return CredentialModel.upsert(user_id, service, encrypted, scopes)

    @staticmethod
    def get(user_id: str, service: str) -> dict | None:
        row = CredentialModel.get(user_id, service)
        if not row:
            return None
        return {
            "service": row["service"],
            "token": decrypt(row["encrypted_token"]),
            "scopes": row["scopes"],
        }

    @staticmethod
    def list_for_user(user_id: str) -> list[dict]:
        return CredentialModel.list_by_user(user_id)

    @staticmethod
    def delete(user_id: str, service: str) -> bool:
        return CredentialModel.delete(user_id, service)
