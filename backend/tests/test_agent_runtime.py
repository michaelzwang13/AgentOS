"""Tests for the agent-runtime FastAPI server."""

import sys
import os
import asyncio
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

# Add agent-runtime to path so we can import server
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agent-runtime"))

import server as agent_server
from server import app, _state


@pytest.fixture(autouse=True)
def reset_state():
    """Reset agent state between tests."""
    # Cancel any lingering worker task
    if _state.get("worker") and not _state["worker"].done():
        _state["worker"].cancel()
    _state["status"] = "idle"
    _state["current_task"] = None
    _state["cancel_event"] = None
    _state["worker"] = None
    yield


@pytest.fixture
def rt_client():
    return TestClient(app)


class TestHealth:
    def test_health(self, rt_client):
        resp = rt_client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestStatus:
    def test_status_idle(self, rt_client):
        resp = rt_client.get("/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["state"] == "idle"
        assert body["current_task"] is None


class TestReceiveTask:
    def test_receive_task_success(self, rt_client):
        resp = rt_client.post(
            "/task",
            json={
                "task_id": "t-1",
                "instruction": "Write an email",
                "role_context": {},
                "metadata": {},
            },
        )
        assert resp.status_code == 200
        assert resp.json()["accepted"] is True
        assert resp.json()["task_id"] == "t-1"

    def test_receive_task_while_busy(self, rt_client):
        """Manually set state to busy to test rejection."""
        _state["status"] = "busy"
        _state["current_task"] = {"task_id": "t-1", "instruction": "busy"}

        resp = rt_client.post(
            "/task",
            json={"task_id": "t-2", "instruction": "Task 2"},
        )
        assert resp.status_code == 409


class TestCancel:
    def test_cancel_no_active_task(self, rt_client):
        resp = rt_client.post("/cancel")
        assert resp.status_code == 409

    def test_cancel_active_task(self, rt_client):
        """Manually set state to busy with a cancel event."""
        cancel_event = asyncio.Event()
        _state["status"] = "busy"
        _state["current_task"] = agent_server.TaskAssign(
            task_id="t-1", instruction="Long task"
        )
        _state["cancel_event"] = cancel_event

        resp = rt_client.post("/cancel")
        assert resp.status_code == 200
        assert resp.json()["cancelled"] is True
        assert cancel_event.is_set()
