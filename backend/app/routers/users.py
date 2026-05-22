from fastapi import APIRouter, Depends, HTTPException, Request
from app.auth import get_current_user
from app.models.user import UserModel
from app.ratelimit import limiter
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.utils.passwords import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=201)
@limiter.limit("10/hour")
def create_user(request: Request, payload: UserCreate):
    existing = UserModel.get_by_email(payload.email)
    if existing:
        raise HTTPException(409, "User with this email already exists")
    return UserModel.create(payload.email, payload.name, hash_password(payload.password))


@router.post("/login", response_model=UserResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: UserLogin):
    """Authenticate by email + password and return the account's API key.

    The same generic error is returned whether the email is unknown or the
    password is wrong, so the endpoint can't be used to enumerate accounts.
    """
    user = UserModel.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.get("password_hash")):
        raise HTTPException(401, "Invalid email or password")
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, current: dict = Depends(get_current_user)):
    # A user may only read their own record.
    if user_id != current["id"]:
        raise HTTPException(404, "User not found")
    return current


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: str, current: dict = Depends(get_current_user)):
    # A user may only delete their own account.
    if user_id != current["id"]:
        raise HTTPException(404, "User not found")
    UserModel.delete(user_id)
