"""OAuth routes — handles provider consent flows and stores tokens in the credential vault."""

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from app.config import get_settings
from app.models.user import UserModel
from app.services.credential_store import CredentialStore

router = APIRouter(prefix="/auth", tags=["auth"])

SLACK_SCOPES = "channels:history,channels:read,users:read,reactions:read"

GMAIL_SCOPES = " ".join([
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
])


@router.get("/slack")
def slack_oauth_start(api_key: str = Query(...)):
    """
    Initiate Slack OAuth. The frontend passes the user's api_key as a query param
    so the callback knows which user to store the token for.
    The api_key is used as the OAuth state parameter (transmitted only server-to-server).
    """
    settings = get_settings()
    if not settings.slack_client_id:
        raise HTTPException(500, "Slack OAuth not configured")

    user = UserModel.get_by_api_key(api_key)
    if not user:
        raise HTTPException(401, "Invalid API key")

    redirect_uri = f"{settings.frontend_url}/api/auth/slack/callback"
    url = (
        "https://slack.com/oauth/v2/authorize"
        f"?client_id={settings.slack_client_id}"
        f"&user_scope={SLACK_SCOPES}"
        f"&redirect_uri={redirect_uri}"
        f"&state={api_key}"
    )
    return RedirectResponse(url)


@router.get("/slack/callback")
async def slack_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
):
    """
    Slack redirects here after the user consents.
    Exchange the code for a token and store it in the credential vault.
    Redirect the browser back to the frontend.
    """
    settings = get_settings()

    if error or not code or not state:
        return RedirectResponse(
            f"{settings.frontend_url}/agent/slack?error={error or 'missing_code'}"
        )

    user = UserModel.get_by_api_key(state)
    if not user:
        return RedirectResponse(
            f"{settings.frontend_url}/agent/slack?error=invalid_state"
        )

    redirect_uri = f"{settings.frontend_url}/api/auth/slack/callback"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": settings.slack_client_id,
                "client_secret": settings.slack_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
    data = resp.json()

    if not data.get("ok"):
        return RedirectResponse(
            f"{settings.frontend_url}/agent/slack?error={data.get('error', 'oauth_failed')}"
        )

    user_token = data.get("authed_user", {}).get("access_token")
    if not user_token:
        return RedirectResponse(
            f"{settings.frontend_url}/agent/slack?error=no_user_token"
        )

    scopes = data.get("authed_user", {}).get("scope", "").split(",")
    CredentialStore.store(user["id"], "slack", user_token, scopes)

    return RedirectResponse(
        f"{settings.frontend_url}/agent/slack?connected=true"
    )


@router.get("/gmail")
def gmail_oauth_start(api_key: str = Query(...)):
    """Initiate Gmail OAuth. State carries the api_key so the callback knows which user to store the token for."""
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(500, "Gmail OAuth not configured")

    user = UserModel.get_by_api_key(api_key)
    if not user:
        raise HTTPException(401, "Invalid API key")

    redirect_uri = f"{settings.frontend_url}/api/auth/gmail/callback"
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={GMAIL_SCOPES}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={api_key}"
    )
    return RedirectResponse(url)


@router.get("/gmail/callback")
async def gmail_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
):
    """Google redirects here after consent. Exchange code for tokens and store in credential vault."""
    settings = get_settings()

    if error or not code or not state:
        return RedirectResponse(
            f"{settings.frontend_url}/agent/gmail?error={error or 'missing_code'}"
        )

    user = UserModel.get_by_api_key(state)
    if not user:
        return RedirectResponse(
            f"{settings.frontend_url}/agent/gmail?error=invalid_state"
        )

    redirect_uri = f"{settings.frontend_url}/api/auth/gmail/callback"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    data = resp.json()

    if "error" in data:
        return RedirectResponse(
            f"{settings.frontend_url}/agent/gmail?error={data.get('error', 'oauth_failed')}"
        )

    # Store both access_token and refresh_token so the AI employee can renew without re-auth
    token_payload = {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token", ""),
        "token_type": data.get("token_type", "Bearer"),
        "expires_in": data.get("expires_in"),
    }
    scopes = data.get("scope", "").split(" ")
    CredentialStore.store(user["id"], "gmail", token_payload, scopes)

    return RedirectResponse(
        f"{settings.frontend_url}/agent/gmail?connected=true"
    )
