from fastapi import APIRouter, HTTPException

from app.services.template_loader import (
    UnknownRoleError,
    list_templates,
    load_template,
)

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[dict])
def list_roles():
    return list_templates()


@router.get("/{role_id}", response_model=dict)
def get_role(role_id: str):
    try:
        template = load_template(role_id)
    except UnknownRoleError as e:
        raise HTTPException(404, str(e))
    return {
        "id": template.get("role", role_id),
        "display_name": template.get("display_name", role_id),
        "description": template.get("description", ""),
        "required_tools": template.get("required_tools", []),
        "allowed_actions": template.get("allowed_actions", []),
    }
