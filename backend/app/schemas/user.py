from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


# bcrypt truncates at 72 bytes — cap the password so truncation can't happen.
PasswordField = Field(min_length=8, max_length=72)


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
