"""Tests for the Dispatcher service."""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock


@pytest.fixture
def mock_orchestrator():
    with patch("app.services.dispatcher.Orchestrator") as MockOrch:
        orch = MockOrch.return_value
        orch.get_container_ip.return_value = "172.18.0.5"
        yield orch


@pytest.fixture
def mock_httpx_client():
    """Provides a mock httpx.AsyncClient context manager."""
    with patch("app.services.dispatcher.httpx.AsyncClient") as MockClient:
        mock_http = AsyncMock()
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        yield mock_http


class TestDispatchTask:
    @pytest.mark.asyncio
    async def test_dispatch_task(self, mock_orchestrator, mock_httpx_client):
        from app.services.dispatcher import Dispatcher

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"accepted": True, "task_id": "t-1"}
        mock_resp.raise_for_status = MagicMock()
        mock_httpx_client.post = AsyncMock(return_value=mock_resp)

        dispatcher = Dispatcher(orchestrator=mock_orchestrator)
        result = await dispatcher.dispatch_task("agent-001", "Do X")

        assert result["accepted"] is True
        mock_httpx_client.post.assert_called_once()
        call_url = mock_httpx_client.post.call_args[0][0]
        assert "172.18.0.5:8080/task" in call_url


class TestGetAgentTaskStatus:
    @pytest.mark.asyncio
    async def test_get_status(self, mock_orchestrator, mock_httpx_client):
        from app.services.dispatcher import Dispatcher

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"agent_id": "agent-001", "state": "busy"}
        mock_resp.raise_for_status = MagicMock()
        mock_httpx_client.get = AsyncMock(return_value=mock_resp)

        dispatcher = Dispatcher(orchestrator=mock_orchestrator)
        result = await dispatcher.get_agent_task_status("agent-001")

        assert result["state"] == "busy"


class TestCancelTask:
    @pytest.mark.asyncio
    async def test_cancel(self, mock_orchestrator, mock_httpx_client):
        from app.services.dispatcher import Dispatcher

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"cancelled": True}
        mock_resp.raise_for_status = MagicMock()
        mock_httpx_client.post = AsyncMock(return_value=mock_resp)

        dispatcher = Dispatcher(orchestrator=mock_orchestrator)
        result = await dispatcher.cancel_task("agent-001")

        assert result["cancelled"] is True
