import docker
import secrets
from docker.errors import NotFound, APIError
from app.config import get_settings
from app.models.agent import AgentModel


class Orchestrator:
    def __init__(self):
        self._client = docker.from_env()
        self._settings = get_settings()
        self._ensure_network()

    def _ensure_network(self):
        try:
            self._client.networks.get(self._settings.docker_network)
        except NotFound:
            self._client.networks.create(
                self._settings.docker_network, driver="bridge"
            )

    def create_agent(self, user_id: str, role: str, config: dict | None = None) -> dict:
        agent = AgentModel.create(user_id, role, config)
        agent_token = f"at_{secrets.token_urlsafe(32)}"
        gateway_token = secrets.token_urlsafe(32)

        try:
            container = self._client.containers.run(
                self._settings.openclaw_agent_image,
                detach=True,
                name=f"openclaw-agent-{agent['id'][:8]}",
                environment={
                    "PLATFORM_GATEWAY_URL": self._settings.platform_gateway_url,
                    "AGENT_TOKEN": agent_token,
                    "AGENT_ID": agent["id"],
                    "AGENT_ROLE": role,
                    "USER_ID": user_id,
                    "LLM_API_KEY": self._settings.llm_api_key,
                    "MOONSHOT_API_KEY": self._settings.llm_api_key,
                    "OPENCLAW_GATEWAY_TOKEN": gateway_token,
                },
                network=self._settings.docker_network,
                mem_limit="512m",
                cpu_quota=50000,  # 50% of one CPU
                labels={
                    "openclaw.agent_id": agent["id"],
                    "openclaw.user_id": user_id,
                    "openclaw.role": role,
                },
            )
            AgentModel.update(
                agent["id"],
                container_id=container.id,
                status="running",
            )
            agent["container_id"] = container.id
            agent["status"] = "running"
        except APIError as e:
            AgentModel.update(agent["id"], status="error")
            agent["status"] = "error"
            raise RuntimeError(f"Failed to start agent container: {e}") from e

        return agent

    def stop_agent(self, agent_id: str) -> dict | None:
        agent = AgentModel.get_by_id(agent_id)
        if not agent:
            return None

        if agent.get("container_id"):
            try:
                container = self._client.containers.get(agent["container_id"])
                container.stop(timeout=10)
                container.remove()
            except NotFound:
                pass

        AgentModel.update(agent_id, status="stopped", container_id=None)
        agent["status"] = "stopped"
        agent["container_id"] = None
        return agent

    def get_agent_status(self, agent_id: str) -> dict | None:
        agent = AgentModel.get_by_id(agent_id)
        if not agent:
            return None

        if agent.get("container_id"):
            try:
                container = self._client.containers.get(agent["container_id"])
                docker_status = container.status
                if docker_status != "running" and agent["status"] == "running":
                    new_status = "error" if docker_status == "exited" else "stopped"
                    AgentModel.update(agent_id, status=new_status)
                    agent["status"] = new_status
            except NotFound:
                AgentModel.update(agent_id, status="error", container_id=None)
                agent["status"] = "error"
                agent["container_id"] = None

        return agent

    def get_container_ip(self, agent_id: str) -> str:
        """Return the container's IP address on the openclaw Docker network."""
        agent = AgentModel.get_by_id(agent_id)
        if not agent or not agent.get("container_id"):
            raise RuntimeError(f"No running container for agent {agent_id}")

        try:
            container = self._client.containers.get(agent["container_id"])
        except NotFound:
            raise RuntimeError(f"Container not found for agent {agent_id}")

        networks = container.attrs["NetworkSettings"]["Networks"]
        network_name = self._settings.docker_network
        if network_name not in networks:
            raise RuntimeError(
                f"Container is not attached to network {network_name}"
            )

        ip = networks[network_name]["IPAddress"]
        if not ip:
            raise RuntimeError(f"No IP address for agent {agent_id}")
        return ip

    def list_user_agents(self, user_id: str) -> list[dict]:
        return AgentModel.list_by_user(user_id)
