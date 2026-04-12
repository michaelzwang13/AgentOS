"""Tests for the agent-runtime FastAPI server."""

import sys
import os
import asyncio
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient

# Add agent-runtime to path so we can import server
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agent-runtime"))

import server as agent_server
from server import app, _state


@pytest.fixture(autouse=True)
def reset_state():
    """Reset agent state between tests."""
    if _state.get("worker") and not _state["worker"].done():
        _state["worker"].cancel()
    _state["status"] = "idle"
    _state["current_task"] = None
    _state["cancel_event"] = None
    _state["worker"] = None
    _state.pop("last_result", None)
    yield


@pytest.fixture
def rt_client():
    return TestClient(app)


class TestHealth:
    def test_health_openclaw_unavailable(self, rt_client):
        """Health returns ok even when OpenClaw gateway is unreachable."""
        resp = rt_client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["openclaw_gateway"] == "unavailable"

    def test_health_openclaw_connected(self, rt_client):
        """Health reports connected when OpenClaw gateway responds."""
        with patch("server.httpx.AsyncClient") as mock_httpx:
            mock_resp = MagicMock(status_code=200)
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_httpx.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = rt_client.get("/health")
            assert resp.status_code == 200
            assert resp.json()["openclaw_gateway"] == "connected"


class TestStatus:
    def test_status_idle(self, rt_client):
        resp = rt_client.get("/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["state"] == "idle"
        assert body["current_task"] is None

    def test_status_busy(self, rt_client):
        """Status reflects busy state with current task."""
        task = agent_server.TaskAssign(task_id="t-1", instruction="Do work")
        _state["status"] = "busy"
        _state["current_task"] = task

        resp = rt_client.get("/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["state"] == "busy"
        assert body["current_task"]["task_id"] == "t-1"


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
        """Rejects tasks when already busy."""
        _state["status"] = "busy"
        _state["current_task"] = {"task_id": "t-1", "instruction": "busy"}

        resp = rt_client.post(
            "/task",
            json={"task_id": "t-2", "instruction": "Task 2"},
        )
        assert resp.status_code == 409

    def test_receive_task_with_role_context(self, rt_client):
        resp = rt_client.post(
            "/task",
            json={
                "task_id": "t-3",
                "instruction": "Summarize emails",
                "role_context": {"department": "engineering"},
                "metadata": {"priority": "high"},
            },
        )
        assert resp.status_code == 200
        assert resp.json()["accepted"] is True


class TestCancel:
    def test_cancel_no_active_task(self, rt_client):
        resp = rt_client.post("/cancel")
        assert resp.status_code == 409

    def test_cancel_active_task(self, rt_client):
        """Cancels a running task."""
        cancel_event = asyncio.Event()
        _state["status"] = "busy"
        _state["current_task"] = agent_server.TaskAssign(
            task_id="t-1", instruction="Long task"
        )
        _state["cancel_event"] = cancel_event
        _state["worker"] = MagicMock()

        resp = rt_client.post("/cancel")
        assert resp.status_code == 200
        assert resp.json()["cancelled"] is True
        assert cancel_event.is_set()


class TestOpenClawIntegration:
    @pytest.mark.asyncio
    async def test_send_to_openclaw_success(self):
        """_send_to_openclaw sends instruction to local OpenClaw gateway."""
        with patch("server.httpx.AsyncClient") as mock_httpx:
            mock_resp = MagicMock(status_code=200)
            mock_resp.json.return_value = {
                "choices": [{"message": {"content": "Email drafted for Bob"}}]
            }
            mock_resp.raise_for_status = MagicMock()
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_httpx.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await agent_server._send_to_openclaw(
                "Draft an email to Bob", asyncio.Event()
            )
            assert result == "Email drafted for Bob"
            mock_client.post.assert_called_once()
            call_url = mock_client.post.call_args[0][0]
            assert "/v1/chat/completions" in call_url

    @pytest.mark.asyncio
    async def test_execute_task_success(self):
        """Full task execution through OpenClaw."""
        with patch("server._send_to_openclaw", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = "Done: drafted email to team"

            task = agent_server.TaskAssign(
                task_id="t-1", instruction="Draft email to team"
            )
            cancel_event = asyncio.Event()

            # Patch the platform callback too
            with patch("server.httpx.AsyncClient") as mock_httpx:
                mock_httpx.return_value.__aenter__ = AsyncMock(
                    return_value=AsyncMock(post=AsyncMock())
                )
                mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

                result = await agent_server._execute_task(task, cancel_event)

            assert result.status == "success"
            assert result.result == "Done: drafted email to team"
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_task_cancelled(self):
        """Task returns cancelled when cancel_event is set."""
        task = agent_server.TaskAssign(
            task_id="t-1", instruction="Long running task"
        )
        cancel_event = asyncio.Event()
        cancel_event.set()

        result = await agent_server._execute_task(task, cancel_event)
        assert result.status == "cancelled"

    @pytest.mark.asyncio
    async def test_execute_task_openclaw_error(self):
        """Task fails gracefully when OpenClaw is unreachable."""
        with patch(
            "server._send_to_openclaw",
            new_callable=AsyncMock,
            side_effect=Exception("Connection refused"),
        ):
            task = agent_server.TaskAssign(
                task_id="t-1", instruction="Do something"
            )
            cancel_event = asyncio.Event()

            result = await agent_server._execute_task(task, cancel_event)
            assert result.status == "failed"
            assert "Connection refused" in result.error

    @pytest.mark.asyncio
    async def test_execute_task_with_role_context(self):
        """Role context is included in the prompt sent to OpenClaw."""
        with patch("server._send_to_openclaw", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = "Summarized 5 engineering emails"

            task = agent_server.TaskAssign(
                task_id="t-1",
                instruction="Summarize emails",
                role_context={"department": "engineering"},
            )
            cancel_event = asyncio.Event()

            with patch("server.httpx.AsyncClient") as mock_httpx:
                mock_httpx.return_value.__aenter__ = AsyncMock(
                    return_value=AsyncMock(post=AsyncMock())
                )
                mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

                result = await agent_server._execute_task(task, cancel_event)

            assert result.status == "success"
            # Verify role context was passed in the prompt
            prompt_sent = mock_send.call_args[0][0]
            assert "engineering" in prompt_sent


class TestOrchestratorEnvVars:
    def test_create_agent_passes_moonshot_key(self, fake_supabase, mock_docker):
        """Orchestrator passes MOONSHOT_API_KEY to container env."""
        from app.services.orchestrator import Orchestrator

        agent_data = {
            "id": "agent-001",
            "user_id": "user-001",
            "role": "secretary",
            "status": "pending",
            "config_json": {},
            "container_id": None,
            "created_at": "2025-01-01T00:00:00+00:00",
        }

        agents_table = fake_supabase.get_table("agents")
        agents_table.set_insert_result([agent_data])
        agents_table.set_update_result(
            [{**agent_data, "status": "running", "container_id": "ctr-123"}]
        )

        mock_container = MagicMock()
        mock_container.id = "ctr-123"
        mock_docker.containers.run.return_value = mock_container

        orch = Orchestrator()
        orch.create_agent("user-001", "secretary")

        call_kwargs = mock_docker.containers.run.call_args
        env = call_kwargs.kwargs.get("environment") or call_kwargs[1].get("environment")
        assert "MOONSHOT_API_KEY" in env
        assert "OPENCLAW_GATEWAY_TOKEN" in env
        assert env["MOONSHOT_API_KEY"] == env["LLM_API_KEY"]
