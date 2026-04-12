import asyncio
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


class DigestRequest(BaseModel):
    channel: str = "#agentos"


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


# ── Digest: fetch all three feeds, summarize via Claude, post to Slack ────────

@router.post("/digest/slack")
async def post_digest_to_slack(
    payload: DigestRequest,
    user: dict = Depends(get_current_user),
):
    """Fetch Slack/Gmail/GitHub feeds for the current user, ask Claude for a short
    digest, then post it to a Slack channel (defaults to #agentos)."""
    import anthropic
    from app.config import get_settings

    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")

    # Pull the three feeds in parallel using the existing route handlers.
    slack_res, gmail_res, github_res = await asyncio.gather(
        get_slack_messages(user),
        get_gmail_messages(user),
        get_github_activity(user),
        return_exceptions=True,
    )

    def _safe(result, key: str) -> list:
        if isinstance(result, Exception):
            return []
        return result.get(key, []) if isinstance(result, dict) else []

    slack_msgs = _safe(slack_res, "messages")
    emails = _safe(gmail_res, "emails")
    gh_items = _safe(github_res, "items")

    if not slack_msgs and not emails and not gh_items:
        raise HTTPException(
            400,
            "No data available to summarize. Connect at least one of Slack / Gmail / GitHub first.",
        )

    # Build a compact context for Claude.
    lines: list[str] = []
    if slack_msgs:
        lines.append("## Slack")
        for m in slack_msgs[:15]:
            lines.append(f"- [{m.get('channel','')}] {m.get('user','')}: {m.get('text','')} ({m.get('time','')})")
    if emails:
        lines.append("\n## Gmail")
        for e in emails[:10]:
            lines.append(f"- From {e.get('from','')} | {e.get('subject','')} — {e.get('body','')[:180]} ({e.get('time','')})")
    if gh_items:
        lines.append("\n## GitHub")
        for g in gh_items[:10]:
            author = f" @{g['author']}" if g.get("author") else ""
            lines.append(f"- [{g.get('type','')}] {g.get('repo','')}: {g.get('title','')} — {g.get('reason','')}{author} ({g.get('time','')})")
    context = "\n".join(lines)

    system = (
        "You are an AI assistant that produces a short, scannable daily digest "
        "across Slack, Gmail, and GitHub. Output must be plain text suitable for "
        "posting directly in a Slack message. Use short sections with bullet "
        "points. Flag blockers and top priorities. Keep the whole thing under "
        "1200 characters. Do not use markdown headings (#) — use *bold* Slack "
        "formatting instead. End with a one-line recommendation."
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=900,
        system=system,
        messages=[{
            "role": "user",
            "content": f"Here is the current activity across all three tools:\n\n{context}\n\nGenerate the digest now.",
        }],
    )
    digest_text = "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()
    if not digest_text:
        raise HTTPException(502, "Claude returned an empty response")

    # Post to Slack via the user's stored credential.
    try:
        slack_result = await GatewayService.send_slack_message(
            user["id"], payload.channel, digest_text
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    if not slack_result.get("ok"):
        err = slack_result.get("error", "slack_post_failed")
        raise HTTPException(502, f"Slack rejected the message: {err}")

    return {
        "ok": True,
        "channel": payload.channel,
        "ts": slack_result.get("ts"),
        "digest": digest_text,
    }


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


@router.get("/gmail/messages")
async def get_gmail_messages(user: dict = Depends(get_current_user)):
    """Fetch recent inbox messages from the user's connected Gmail account."""
    cred = CredentialStore.get(user["id"], "gmail")
    if not cred:
        return {"connected": False, "emails": []}

    # Token may be stored as dict (access_token + refresh_token) or plain string
    token_data = cred["token"]
    if isinstance(token_data, dict):
        access_token = token_data.get("access_token", "")
    else:
        access_token = token_data

    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient() as client:
        list_resp = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            params={"maxResults": 10, "labelIds": "INBOX"},
            headers=headers,
        )
        if list_resp.status_code == 401:
            # Try refresh if available
            if isinstance(token_data, dict) and token_data.get("refresh_token"):
                from app.config import get_settings
                settings = get_settings()
                refresh_resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "client_id": settings.google_client_id,
                        "client_secret": settings.google_client_secret,
                        "refresh_token": token_data["refresh_token"],
                        "grant_type": "refresh_token",
                    },
                )
                rdata = refresh_resp.json()
                access_token = rdata.get("access_token")
                if not access_token:
                    return {"connected": False, "emails": []}
                headers = {"Authorization": f"Bearer {access_token}"}
                list_resp = await client.get(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                    params={"maxResults": 10, "labelIds": "INBOX"},
                    headers=headers,
                )
            else:
                return {"connected": False, "emails": []}

        if not list_resp.is_success:
            return {"connected": False, "error": "gmail_api_error"}

        msg_ids = [m["id"] for m in list_resp.json().get("messages", [])]

        emails = []
        for mid in msg_ids[:10]:
            msg_resp = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}",
                params={"format": "full"},
                headers=headers,
            )
            if not msg_resp.is_success:
                continue
            msg = msg_resp.json()
            hdrs = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
            from_raw = hdrs.get("from", "")
            from_name = from_raw.split("<")[0].strip().strip('"') if "<" in from_raw else from_raw
            subject = hdrs.get("subject", "(no subject)")
            snippet = msg.get("snippet", "")
            label_ids = msg.get("labelIds", [])
            is_unread = "UNREAD" in label_ids
            internal_date = msg.get("internalDate", "0")

            ts = int(internal_date) / 1000
            now = time.time()
            diff_mins = int((now - ts) / 60)
            diff_hours = int((now - ts) / 3600)
            if diff_mins < 60:
                time_label = f"{diff_mins}m ago"
            elif diff_hours < 24:
                time_label = f"{diff_hours}h ago"
            else:
                time_label = datetime.fromtimestamp(ts).strftime("%b %d")

            labels = [l.lower().replace("category_", "") for l in label_ids
                      if l not in ("INBOX", "UNREAD", "IMPORTANT", "CATEGORY_PERSONAL")][:2]

            emails.append({
                "id": mid,
                "from": from_name,
                "subject": subject,
                "body": snippet[:300],
                "time": time_label,
                "priority": "high" if is_unread else "low",
                "read": not is_unread,
                "labels": labels,
            })

    return {"connected": True, "emails": emails}


@router.delete("/gmail/disconnect")
def disconnect_gmail(user: dict = Depends(get_current_user)):
    CredentialStore.delete(user["id"], "gmail")
    return {"ok": True}


@router.get("/github/activity")
async def get_github_activity(user: dict = Depends(get_current_user)):
    """Fetch GitHub notifications and PRs awaiting review."""
    cred = CredentialStore.get(user["id"], "github")
    if not cred:
        return {"connected": False, "items": []}

    token = cred["token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    items = []
    async with httpx.AsyncClient() as client:
        notif_resp, pr_resp = await asyncio.gather(
            client.get(
                "https://api.github.com/notifications",
                params={"all": "false", "per_page": 15},
                headers=headers,
            ),
            client.get(
                "https://api.github.com/search/issues",
                params={"q": "is:pr+is:open+review-requested:@me", "per_page": 10},
                headers=headers,
            ),
        )

        if notif_resp.status_code == 401:
            return {"connected": False, "items": []}

        reason_map = {
            "assign": "assigned", "author": "author", "comment": "commented",
            "mention": "mentioned", "review_requested": "review requested",
            "subscribed": "subscribed", "team_mention": "team mention",
        }

        if notif_resp.is_success:
            for n in notif_resp.json():
                updated = n.get("updated_at", "")
                ts = datetime.fromisoformat(updated.replace("Z", "+00:00")) if updated else datetime.now()
                diff = datetime.now(ts.tzinfo) - ts
                diff_mins = int(diff.total_seconds() / 60)
                diff_hours = int(diff.total_seconds() / 3600)
                if diff_mins < 60:
                    time_label = f"{diff_mins}m ago"
                elif diff_hours < 24:
                    time_label = f"{diff_hours}h ago"
                else:
                    time_label = ts.strftime("%b %d")

                items.append({
                    "id": f"notif-{n['id']}",
                    "repo": n.get("repository", {}).get("full_name", ""),
                    "title": n.get("subject", {}).get("title", ""),
                    "type": n.get("subject", {}).get("type", "").replace("PullRequest", "PR"),
                    "reason": reason_map.get(n.get("reason", ""), n.get("reason", "")),
                    "time": time_label,
                    "unread": n.get("unread", False),
                })

        if pr_resp.is_success:
            pr_data = pr_resp.json()
            for pr in pr_data.get("items", []):
                already = any(i["title"] == pr["title"] for i in items)
                if not already:
                    updated = pr.get("updated_at", "")
                    ts = datetime.fromisoformat(updated.replace("Z", "+00:00")) if updated else datetime.now()
                    diff = datetime.now(ts.tzinfo) - ts
                    diff_hours = int(diff.total_seconds() / 3600)
                    time_label = f"{diff_hours}h ago" if diff_hours < 24 else ts.strftime("%b %d")

                    items.append({
                        "id": f"pr-{pr['id']}",
                        "repo": pr.get("repository_url", "").split("repos/")[-1],
                        "title": pr["title"],
                        "type": "PR",
                        "reason": "review requested",
                        "time": time_label,
                        "unread": True,
                        "author": pr.get("user", {}).get("login", ""),
                        "state": "draft" if pr.get("draft") else pr.get("state", "open"),
                    })

    items.sort(key=lambda x: (0 if x.get("unread") else 1))
    return {"connected": True, "items": items[:20]}


@router.delete("/github/disconnect")
def disconnect_github(user: dict = Depends(get_current_user)):
    CredentialStore.delete(user["id"], "github")
    return {"ok": True}
