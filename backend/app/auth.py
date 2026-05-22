from fastapi import Header, HTTPException
from app.models.user import UserModel


def get_current_user(x_api_key: str | None = Header(None)) -> dict:
    """Resolve the caller from the X-Api-Key header.

    A missing header and an unknown key both yield 401 so the endpoint
    behaves consistently for any unauthenticated request.
    """
    if not x_api_key:
        raise HTTPException(401, "Missing API key")
    user = UserModel.get_by_api_key(x_api_key)
    if not user:
        raise HTTPException(401, "Invalid API key")
    return user
