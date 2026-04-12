from pydantic import BaseModel
from datetime import datetime
from typing import Literal


AgentStatus = Literal["pending", "running", "stopped", "error"]


class AgentCreate(BaseModel):
    role: str
    config: dict | None = None


class AgentResponse(BaseModel):
    id: str
    user_id: str
    role: str
    container_id: str | None
    status: AgentStatus
    config_json: dict
    created_at: datetime


class AgentStatusResponse(BaseModel):
    id: str
    status: AgentStatus
    container_id: str | None
