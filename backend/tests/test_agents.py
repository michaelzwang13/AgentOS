"""Tests for the /agents router."""

from unittest.mock import MagicMock, patch
from tests.conftest import _make_user, _make_agent


class TestHireAgent:
    def test_hire_agent_success(self, authed_client, mock_docker):
        client, user, fake_sb = authed_client
        agent = _make_agent()

        agents_table = fake_sb.get_table("agents")
        agents_table.set_insert_result([agent])
        agents_table.set_update_result([agent])

        mock_container = MagicMock()
        mock_container.id = "container-abc"
        mock_docker.containers.run.return_value = mock_container

        resp = client.post("/agents", json={"role": "secretary"})
        assert resp.status_code == 201
        assert resp.json()["role"] == "secretary"

    def test_hire_agent_no_auth(self, client):
        resp = client.post("/agents", json={"role": "secretary"})
        assert resp.status_code == 422  # missing header


class TestListAgents:
    def test_list_agents(self, authed_client):
        client, user, fake_sb = authed_client
        agents = [_make_agent(), _make_agent(id="agent-002")]

        fake_sb.get_table("agents").set_select_order(agents)

        resp = client.get("/agents")
        assert resp.status_code == 200
        assert len(resp.json()) == 2


class TestGetAgent:
    def test_get_agent_success(self, authed_client):
        client, user, fake_sb = authed_client
        agent = _make_agent()

        fake_sb.get_table("agents").set_select_result([agent])

        resp = client.get("/agents/agent-001")
        assert resp.status_code == 200
        assert resp.json()["id"] == "agent-001"

    def test_get_agent_wrong_user(self, authed_client):
        client, user, fake_sb = authed_client
        agent = _make_agent(user_id="other-user")

        fake_sb.get_table("agents").set_select_result([agent])

        resp = client.get("/agents/agent-001")
        assert resp.status_code == 404


class TestFireAgent:
    def test_fire_agent_success(self, authed_client, mock_docker):
        client, user, fake_sb = authed_client
        agent = _make_agent()

        agents_table = fake_sb.get_table("agents")
        agents_table.set_select_result([agent])
        agents_table.set_update_result([{**agent, "status": "stopped"}])

        resp = client.delete("/agents/agent-001")
        assert resp.status_code == 204
