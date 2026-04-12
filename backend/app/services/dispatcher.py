"""Platform-side service that sends tasks to agent containers over HTTP."""

import uuid

import httpx
from docker.errors import NotFound

from app.config import get_settings
from app.services.orchestrator import Orchestrator

AGENT_PORT = 8080


class Dispatcher:
    def __init__(self, orchestrator: Orchestrator | None = None):
        self._orch = orchestrator or Orchestrator()
        self._settings = get_settings()

    async def dispatch_task(
        self, agent_id: str, instruction: str, metadata: dict | None = None
    ) -> dict:
        container_ip = self._orch.get_container_ip(agent_id)
        task_payload = {
            "task_id": str(uuid.uuid4()),
            "instruction": instruction,
            "role_context": {},
            "metadata": metadata or {},
        }

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"http://{container_ip}:{AGENT_PORT}/task",
                json=task_payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_agent_task_status(self, agent_id: str) -> dict:
        container_ip = self._orch.get_container_ip(agent_id)

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"http://{container_ip}:{AGENT_PORT}/status",
            )
            resp.raise_for_status()
            return resp.json()

    async def cancel_task(self, agent_id: str) -> dict:
        container_ip = self._orch.get_container_ip(agent_id)

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"http://{container_ip}:{AGENT_PORT}/cancel",
            )
            resp.raise_for_status()
            return resp.json()
