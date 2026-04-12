from pydantic import BaseModel
from datetime import datetime
from typing import Literal


ServiceType = Literal["gmail", "slack", "discord"]


class CredentialStore(BaseModel):
    service: ServiceType
    token: str
    scopes: list[str] = []


class CredentialResponse(BaseModel):
    id: str
    service: str
    scopes: list[str]
    created_at: datetime


class CredentialDecrypted(BaseModel):
    service: str
    token: str
    scopes: list[str]
