"""Platform-side service that sends tasks to agent containers over HTTP."""

import logging
import uuid

import httpx
from docker.errors import NotFound

from app.config import get_settings
from app.models.agent_memory import AgentMemoryModel
from app.services.orchestrator import Orchestrator

AGENT_PORT = 8080
logger = logging.getLogger(__name__)


def _load_memory(agent_id: str) -> dict:
    """Return the agent's persisted memory as a {key: value} dict for injection
    into role_context. Compaction strategies (LRU / LLM reflection) land here
    later — see issue #23. Best-effort: a DB hiccup must not block dispatch."""
    try:
        rows = AgentMemoryModel.list_by_agent(agent_id)
    except Exception as exc:  # noqa: BLE001 — best-effort
        logger.warning("dispatcher: memory load failed for agent=%s: %s", agent_id, exc)
        return {}
    return {row["key"]: row["value"] for row in rows}


class Dispatcher:
    def __init__(self, orchestrator: Orchestrator | None = None):
        self._orch = orchestrator or Orchestrator()
        self._settings = get_settings()

    async def dispatch_task(
        self, agent_id: str, instruction: str, metadata: dict | None = None
    ) -> dict:
        container_ip = self._orch.get_container_ip(agent_id)
        # Inject the agent's persisted memory into role_context so it sees
        # back what update-memory wrote on previous tasks.
        task_payload = {
            "task_id": str(uuid.uuid4()),
            "instruction": instruction,
            "role_context": {"memory": _load_memory(agent_id)},
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
