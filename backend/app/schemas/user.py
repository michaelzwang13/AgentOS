from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


# Length is not bcrypt-bounded (passwords are SHA-256 pre-hashed); the cap is
# only a sanity limit on request size.
PasswordField = Field(min_length=8, max_length=256)


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = PasswordField


class UserLogin(BaseModel):
    email: EmailStr
    password: str = PasswordField


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    api_key: str
    created_at: datetime


class UserListResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime
