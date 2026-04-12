from fastapi import APIRouter, HTTPException
from app.models.user import UserModel
from app.schemas.user import UserCreate, UserResponse, UserListResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=201)
def create_user(payload: UserCreate):
    existing = UserModel.get_by_email(payload.email)
    if existing:
        raise HTTPException(409, "User with this email already exists")
    return UserModel.create(payload.email, payload.name)


@router.get("", response_model=list[UserListResponse])
def list_users(limit: int = 50, offset: int = 0):
    return UserModel.list_all(limit, offset)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str):
    user = UserModel.get_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: str):
    if not UserModel.delete(user_id):
        raise HTTPException(404, "User not found")
