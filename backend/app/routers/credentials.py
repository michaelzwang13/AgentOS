from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.schemas.credential import CredentialStore as CredentialStoreSchema, CredentialResponse
from app.services.credential_store import CredentialStore

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.post("", response_model=CredentialResponse, status_code=201)
def store_credential(
    payload: CredentialStoreSchema,
    user: dict = Depends(get_current_user),
):
    result = CredentialStore.store(
        user["id"], payload.service, payload.token, payload.scopes
    )
    return result


@router.get("", response_model=list[CredentialResponse])
def list_credentials(user: dict = Depends(get_current_user)):
    return CredentialStore.list_for_user(user["id"])


@router.delete("/{service}", status_code=204)
def delete_credential(
    service: str,
    user: dict = Depends(get_current_user),
):
    if not CredentialStore.delete(user["id"], service):
        raise HTTPException(404, "Credential not found")
