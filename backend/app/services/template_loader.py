"""Role template loader.

Single source of truth for reading role templates off disk. Used by:
- `GET /roles` (list the hireable roles)
- `Orchestrator.create_agent` (validate a hire request before spinning
  up a container)

Templates are baked into the image at deploy time so both functions
are `@lru_cache`-decorated — disk reads happen once per process.
"""

from functools import lru_cache
from pathlib import Path

import yaml

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "agent-config" / "templates"


class UnknownRoleError(ValueError):
    """Raised when a hire request names a role with no template on disk."""


@lru_cache
def list_templates() -> list[dict]:
    """Return the public summary for every role template on disk.

    Shape: list of dicts with keys id, display_name, description,
    required_tools. Sorted by id for deterministic output.
    """
    if not TEMPLATES_DIR.exists():
        return []
    summaries = []
    for path in TEMPLATES_DIR.glob("*.yaml"):
        with path.open() as f:
            data = yaml.safe_load(f) or {}
        summaries.append(
            {
                "id": data.get("role", path.stem),
                "display_name": data.get("display_name", path.stem),
                "description": data.get("description", ""),
                "required_tools": data.get("required_tools", []),
            }
        )
    summaries.sort(key=lambda r: r["id"])
    return summaries


@lru_cache
def load_template(role_id: str) -> dict:
    """Return the full parsed YAML for a given role.

    Raises UnknownRoleError if no template exists. Callers in the hire
    path use this as a validation gate before doing anything expensive
    (DB insert, Docker run).
    """
    path = TEMPLATES_DIR / f"{role_id}.yaml"
    if not path.exists():
        raise UnknownRoleError(f"Unknown role: {role_id!r}")
    with path.open() as f:
        return yaml.safe_load(f) or {}
