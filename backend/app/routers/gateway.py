import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.services.gateway import GatewayService
from app.services.credential_store import CredentialStore
import httpx

router = APIRouter(prefix="/gateway", tags=["gateway"])


# ── Request schemas ────────────────────────────────────────────────────────────

class EmailRequest(BaseModel):
    to: str
    subject: str
    body: str


class SlackRequest(BaseModel):
    channel: str
    text: str


class DiscordRequest(BaseModel):
    channel_id: str
    content: str


class GitHubPRReviewRequest(BaseModel):
    owner: str
    repo: str
    pull_number: int
    body: str
    event: str = "COMMENT"  # COMMENT | APPROVE | REQUEST_CHANGES


class GitHubPRCommentRequest(BaseModel):
    owner: str
    repo: str
    pull_number: int
    body: str
    path: str
    line: int


# ── Write endpoints ────────────────────────────────────────────────────────────

@router.post("/email/send")
async def send_email(
    payload: EmailRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.send_email(
            user["id"], payload.to, payload.subject, payload.body
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/slack/message")
async def send_slack_message(
    payload: SlackRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.send_slack_message(
            user["id"], payload.channel, payload.text
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── GitHub endpoints ───────────────────────────────────────────────────────────

@router.get("/github/pulls/{owner}/{repo}")
async def list_pull_requests(
    owner: str, repo: str, state: str = "open",
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.list_pull_requests(user["id"], owner, repo, state)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/github/pulls/{owner}/{repo}/{pull_number}")
async def get_pull_request(
    owner: str, repo: str, pull_number: int,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.get_pull_request(user["id"], owner, repo, pull_number)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/github/review")
async def create_pr_review(
    payload: GitHubPRReviewRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.create_pr_review(
            user["id"], payload.owner, payload.repo,
            payload.pull_number, payload.body, payload.event,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/github/review/comment")
async def create_pr_review_comment(
    payload: GitHubPRCommentRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.create_pr_review_comment(
            user["id"], payload.owner, payload.repo,
            payload.pull_number, payload.body, payload.path, payload.line,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/discord/message")
async def send_discord_message(
    payload: DiscordRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.send_discord_message(
            user["id"], payload.channel_id, payload.content
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Read endpoints ─────────────────────────────────────────────────────────────

@router.get("/slack/messages")
async def get_slack_messages(user: dict = Depends(get_current_user)):
    """Fetch recent messages from the user's connected Slack workspace."""
    cred = CredentialStore.get(user["id"], "slack")
    if not cred:
        return {"connected": False, "messages": []}

    token = cred["token"]
    user_cache: dict[str, str] = {}

    async with httpx.AsyncClient() as client:
        channels_resp = await client.get(
            "https://slack.com/api/conversations.list",
            params={
                "types": "public_channel,private_channel",
                "limit": 20,
                "exclude_archived": "true",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        channels_data = channels_resp.json()

    if not channels_data.get("ok"):
        return {"connected": False, "error": channels_data.get("error")}

    channels = [c for c in channels_data.get("channels", []) if c.get("is_member")]
    messages = []

    async with httpx.AsyncClient() as client:
        for channel in channels[:5]:
            hist_resp = await client.get(
                "https://slack.com/api/conversations.history",
                params={"channel": channel["id"], "limit": 3},
                headers={"Authorization": f"Bearer {token}"},
            )
            hist = hist_resp.json()
            if not hist.get("ok") or not hist.get("messages"):
                continue

            for msg in hist["messages"]:
                if not msg.get("user") or not msg.get("text"):
                    continue

                uid = msg["user"]
                if uid not in user_cache:
                    u_resp = await client.get(
                        "https://slack.com/api/users.info",
                        params={"user": uid},
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    u_data = u_resp.json()
                    if u_data.get("ok"):
                        profile = u_data["user"]["profile"]
                        name = profile.get("display_name") or profile.get("real_name") or uid
                    else:
                        name = uid
                    user_cache[uid] = name

                name = user_cache[uid]
                ts = float(msg["ts"])
                now = time.time()
                diff_mins = int((now - ts) / 60)
                diff_hours = int((now - ts) / 3600)

                if diff_mins < 60:
                    time_label = f"{diff_mins}m ago"
                elif diff_hours < 24:
                    time_label = f"{diff_hours}h ago"
                else:
                    time_label = datetime.fromtimestamp(ts).strftime("%b %d")

                initials = "".join(w[0] for w in name.split() if w).upper()[:2]

                messages.append({
                    "id": msg["ts"],
                    "channel": f"#{channel['name']}",
                    "user": name,
                    "avatar": initials,
                    "text": msg["text"],
                    "time": time_label,
                    "reactions": [
                        {"emoji": f":{r['name']}:", "count": r["count"]}
                        for r in msg.get("reactions", [])
                    ],
                })

    messages.sort(key=lambda m: float(m["id"]), reverse=True)
    return {"connected": True, "messages": messages}


@router.delete("/slack/disconnect")
def disconnect_slack(user: dict = Depends(get_current_user)):
    CredentialStore.delete(user["id"], "slack")
    return {"ok": True}
