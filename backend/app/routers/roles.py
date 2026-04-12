from pathlib import Path
import yaml
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/roles", tags=["roles"])

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "agent-config" / "templates"


def _load_template(path: Path) -> dict:
    with path.open() as f:
        data = yaml.safe_load(f) or {}
    return {
        "role": data.get("role", path.stem),
        "display_name": data.get("display_name", path.stem),
        "description": data.get("description", ""),
        "allowed_actions": data.get("allowed_actions", []),
    }


@router.get("", response_model=list[dict])
def list_roles():
    if not TEMPLATES_DIR.exists():
        return []
    return sorted(
        (_load_template(p) for p in TEMPLATES_DIR.glob("*.yaml")),
        key=lambda r: r["role"],
    )


@router.get("/{role}", response_model=dict)
def get_role(role: str):
    path = TEMPLATES_DIR / f"{role}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Role '{role}' not found")
    return _load_template(path)
