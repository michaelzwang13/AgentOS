import json
from app.models.credential import CredentialModel
from app.utils.crypto import encrypt, decrypt


class CredentialStore:
    @staticmethod
    def store(user_id: str, service: str, token: str | dict, scopes: list[str]) -> dict:
        # Gmail stores a dict (access_token + refresh_token); Slack/GitHub store a plain
        # string. Normalize to a string here so encrypt() doesn't choke on dicts.
        if isinstance(token, (dict, list)):
            token_str = json.dumps(token)
        else:
            token_str = token
        encrypted = encrypt(token_str)
        return CredentialModel.upsert(user_id, service, encrypted, scopes)

    @staticmethod
    def get(user_id: str, service: str) -> dict | None:
        row = CredentialModel.get(user_id, service)
        if not row:
            return None
        raw = decrypt(row["encrypted_token"])
        # Round-trip the JSON shape for callers that store structured tokens (Gmail).
        # Plain string tokens remain strings.
        token: str | dict | list
        if raw and raw[:1] in ("{", "["):
            try:
                token = json.loads(raw)
            except json.JSONDecodeError:
                token = raw
        else:
            token = raw
        return {
            "service": row["service"],
            "token": token,
            "scopes": row["scopes"],
        }

    @staticmethod
    def list_for_user(user_id: str) -> list[dict]:
        return CredentialModel.list_by_user(user_id)

    @staticmethod
    def delete(user_id: str, service: str) -> bool:
        return CredentialModel.delete(user_id, service)
