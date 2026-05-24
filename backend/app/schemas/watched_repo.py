from datetime import datetime

from pydantic import BaseModel


class WatchedRepoCreate(BaseModel):
    owner: str
    repo: str


class WatchedRepoResponse(BaseModel):
    id: str
    agent_id: str
    user_id: str
    owner: str
    repo: str
    created_at: datetime
