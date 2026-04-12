"""Tests for Pydantic schema validation."""

import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate
from app.schemas.agent import AgentCreate
from app.schemas.credential import CredentialStore
from app.schemas.task import TaskAssign, TaskResult, TaskStatus


class TestUserSchemas:
    def test_user_create_valid(self):
        u = UserCreate(email="a@b.com", name="Test")
        assert u.email == "a@b.com"

    def test_user_create_invalid_email(self):
        with pytest.raises(ValidationError):
            UserCreate(email="bad", name="Test")


class TestAgentSchemas:
    def test_agent_create(self):
        a = AgentCreate(role="secretary")
        assert a.role == "secretary"
        assert a.config is None


class TestCredentialSchemas:
    def test_credential_store_valid(self):
        c = CredentialStore(service="gmail", token="tok")
        assert c.service == "gmail"

    def test_credential_store_invalid_service(self):
        with pytest.raises(ValidationError):
            CredentialStore(service="invalid", token="tok")


class TestTaskSchemas:
    def test_task_assign(self):
        t = TaskAssign(task_id="t-1", instruction="Do something")
        assert t.task_id == "t-1"
        assert t.role_context == {}

    def test_task_result_success(self):
        r = TaskResult(task_id="t-1", status="success", result="done")
        assert r.error is None

    def test_task_result_invalid_status(self):
        with pytest.raises(ValidationError):
            TaskResult(task_id="t-1", status="invalid")

    def test_task_status(self):
        s = TaskStatus(task_id="t-1", state="idle")
        assert s.state == "idle"

    def test_task_status_invalid_state(self):
        with pytest.raises(ValidationError):
            TaskStatus(task_id="t-1", state="unknown")
