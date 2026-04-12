from fastapi import Header, HTTPException
from app.models.user import UserModel


def get_current_user(x_api_key: str = Header(...)) -> dict:
    user = UserModel.get_by_api_key(x_api_key)
    if not user:
        raise HTTPException(401, "Invalid API key")
    return user
