"""Tests for the /agents/{id}/tasks router (task dispatch)."""

from unittest.mock import MagicMock, patch, AsyncMock
from tests.conftest import _make_agent


class TestAssignTask:
    def test_assign_task_success(self, authed_client, mock_docker):
        client, user, fake_sb = authed_client
        agent = _make_agent()
        fake_sb.get_table("agents").set_select_result([agent])

        with patch("app.services.dispatcher.Orchestrator") as MockOrch:
            mock_orch = MockOrch.return_value
            mock_orch.get_container_ip.return_value = "172.18.0.5"

            with patch("app.services.dispatcher.httpx.AsyncClient") as mock_httpx:
                mock_resp = MagicMock(status_code=200)
                mock_resp.json.return_value = {"accepted": True, "task_id": "task-123"}
                mock_resp.raise_for_status = MagicMock()
                mock_http_client = AsyncMock()
                mock_http_client.post = AsyncMock(return_value=mock_resp)
                mock_httpx.return_value.__aenter__ = AsyncMock(return_value=mock_http_client)
                mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

                resp = client.post(
                    "/agents/agent-001/tasks",
                    json={"instruction": "Draft an email to Bob"},
                )
                assert resp.status_code == 200
                assert resp.json()["accepted"] is True

    def test_assign_task_agent_not_found(self, authed_client):
        client, user, fake_sb = authed_client
        fake_sb.get_table("agents").set_select_result([])

        resp = client.post(
            "/agents/nonexistent/tasks",
            json={"instruction": "Do something"},
        )
        assert resp.status_code == 404

    def test_assign_task_agent_not_running(self, authed_client):
        client, user, fake_sb = authed_client
        agent = _make_agent(status="stopped")
        fake_sb.get_table("agents").set_select_result([agent])

        resp = client.post(
            "/agents/agent-001/tasks",
            json={"instruction": "Do something"},
        )
        assert resp.status_code == 409

    def test_assign_task_wrong_user(self, authed_client):
        client, user, fake_sb = authed_client
        agent = _make_agent(user_id="other-user")
        fake_sb.get_table("agents").set_select_result([agent])

        resp = client.post(
            "/agents/agent-001/tasks",
            json={"instruction": "Do something"},
        )
        assert resp.status_code == 404


class TestGetTaskStatus:
    def test_get_task_status_success(self, authed_client, mock_docker):
        client, user, fake_sb = authed_client
        agent = _make_agent()
        fake_sb.get_table("agents").set_select_result([agent])

        with patch("app.services.dispatcher.Orchestrator") as MockOrch:
            mock_orch = MockOrch.return_value
            mock_orch.get_container_ip.return_value = "172.18.0.5"

            with patch("app.services.dispatcher.httpx.AsyncClient") as mock_httpx:
                mock_resp = MagicMock(status_code=200)
                mock_resp.json.return_value = {
                    "agent_id": "agent-001",
                    "state": "idle",
                    "current_task": None,
                }
                mock_resp.raise_for_status = MagicMock()
                mock_http_client = AsyncMock()
                mock_http_client.get = AsyncMock(return_value=mock_resp)
                mock_httpx.return_value.__aenter__ = AsyncMock(return_value=mock_http_client)
                mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

                resp = client.get("/agents/agent-001/tasks/status")
                assert resp.status_code == 200
                assert resp.json()["state"] == "idle"


class TestCancelTask:
    def test_cancel_task_success(self, authed_client, mock_docker):
        client, user, fake_sb = authed_client
        agent = _make_agent()
        fake_sb.get_table("agents").set_select_result([agent])

        with patch("app.services.dispatcher.Orchestrator") as MockOrch:
            mock_orch = MockOrch.return_value
            mock_orch.get_container_ip.return_value = "172.18.0.5"

            with patch("app.services.dispatcher.httpx.AsyncClient") as mock_httpx:
                mock_resp = MagicMock(status_code=200)
                mock_resp.json.return_value = {"cancelled": True, "task_id": "task-123"}
                mock_resp.raise_for_status = MagicMock()
                mock_http_client = AsyncMock()
                mock_http_client.post = AsyncMock(return_value=mock_resp)
                mock_httpx.return_value.__aenter__ = AsyncMock(return_value=mock_http_client)
                mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

                resp = client.post("/agents/agent-001/tasks/cancel")
                assert resp.status_code == 200
                assert resp.json()["cancelled"] is True
