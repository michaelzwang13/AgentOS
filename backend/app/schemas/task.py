"""Shared task schemas used by both the platform and agent runtime."""

from pydantic import BaseModel
from typing import Literal


class TaskAssign(BaseModel):
    task_id: str
    instruction: str
    role_context: dict = {}
    metadata: dict = {}


class TaskResult(BaseModel):
    task_id: str
    status: Literal["success", "failed", "cancelled"]
    result: str = ""
    error: str | None = None


class TaskStatus(BaseModel):
    task_id: str | None
    state: Literal["idle", "busy", "error"]
