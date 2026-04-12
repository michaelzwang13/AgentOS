"""Tests for the Orchestrator service."""

import pytest
from unittest.mock import MagicMock, patch
from docker.errors import NotFound, APIError


class TestCreateAgent:
    def test_create_agent_success(self, fake_supabase, mock_docker):
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
        result = orch.create_agent("user-001", "secretary")

        assert result["status"] == "running"
        assert result["container_id"] == "ctr-123"
        mock_docker.containers.run.assert_called_once()

    def test_create_agent_docker_error(self, fake_supabase, mock_docker):
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
        agents_table.set_update_result([{**agent_data, "status": "error"}])

        mock_docker.containers.run.side_effect = APIError("boom")

        orch = Orchestrator()
        with pytest.raises(RuntimeError, match="Failed to start"):
            orch.create_agent("user-001", "secretary")


class TestStopAgent:
    def test_stop_agent_success(self, fake_supabase, mock_docker):
        from app.services.orchestrator import Orchestrator

        agent = {
            "id": "agent-001",
            "user_id": "user-001",
            "role": "secretary",
            "container_id": "ctr-123",
            "status": "running",
            "config_json": {},
        }

        agents_table = fake_supabase.get_table("agents")
        agents_table.set_select_result([agent])
        agents_table.set_update_result([{**agent, "status": "stopped"}])

        mock_container = MagicMock()
        mock_docker.containers.get.return_value = mock_container

        orch = Orchestrator()
        result = orch.stop_agent("agent-001")

        assert result["status"] == "stopped"
        mock_container.stop.assert_called_once()
        mock_container.remove.assert_called_once()

    def test_stop_agent_not_found(self, fake_supabase, mock_docker):
        from app.services.orchestrator import Orchestrator

        fake_supabase.get_table("agents").set_select_result([])

        orch = Orchestrator()
        result = orch.stop_agent("nonexistent")
        assert result is None


class TestGetContainerIp:
    def test_get_container_ip_success(self, fake_supabase, mock_docker):
        from app.services.orchestrator import Orchestrator

        agent = {"id": "agent-001", "container_id": "ctr-123", "status": "running"}
        fake_supabase.get_table("agents").set_select_result([agent])

        mock_container = MagicMock()
        mock_container.attrs = {
            "NetworkSettings": {
                "Networks": {
                    "openclaw-agents": {"IPAddress": "172.18.0.5"}
                }
            }
        }
        mock_docker.containers.get.return_value = mock_container

        orch = Orchestrator()
        ip = orch.get_container_ip("agent-001")
        assert ip == "172.18.0.5"

    def test_get_container_ip_no_agent(self, fake_supabase, mock_docker):
        from app.services.orchestrator import Orchestrator

        fake_supabase.get_table("agents").set_select_result([])

        orch = Orchestrator()
        with pytest.raises(RuntimeError, match="No running container"):
            orch.get_container_ip("nonexistent")

    def test_get_container_ip_container_not_found(self, fake_supabase, mock_docker):
        from app.services.orchestrator import Orchestrator

        agent = {"id": "agent-001", "container_id": "ctr-123"}
        fake_supabase.get_table("agents").set_select_result([agent])
        mock_docker.containers.get.side_effect = NotFound("gone")

        orch = Orchestrator()
        with pytest.raises(RuntimeError, match="Container not found"):
            orch.get_container_ip("agent-001")

    def test_get_container_ip_wrong_network(self, fake_supabase, mock_docker):
        from app.services.orchestrator import Orchestrator

        agent = {"id": "agent-001", "container_id": "ctr-123"}
        fake_supabase.get_table("agents").set_select_result([agent])

        mock_container = MagicMock()
        mock_container.attrs = {
            "NetworkSettings": {"Networks": {"other-network": {"IPAddress": "10.0.0.1"}}}
        }
        mock_docker.containers.get.return_value = mock_container

        orch = Orchestrator()
        with pytest.raises(RuntimeError, match="not attached to network"):
            orch.get_container_ip("agent-001")
