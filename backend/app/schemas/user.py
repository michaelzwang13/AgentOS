from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    name: str


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
