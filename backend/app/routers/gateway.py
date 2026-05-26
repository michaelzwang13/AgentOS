import asyncio
import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.agent_auth import get_current_agent
from app.models.agent_memory import AgentMemoryModel
from app.models.reviewed_pr import ReviewedPRModel
from app.services.gateway import GatewayService
from app.services.policy import require_action
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


class MemoryWriteRequest(BaseModel):
    key: str
    value: str


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


# ── GitHub endpoints (agent-token auth + action policy) ─────────────────────────
# These are called by agent skills, not the user-facing app. Callers
# authenticate with their per-agent bearer token; require_action enforces the
# role template's allowed_actions (denied-by-default). The agent's user_id is
# used to fetch the user's stored GitHub credential.

@router.get("/github/pulls/{owner}/{repo}")
async def list_pull_requests(
    owner: str, repo: str, state: str = "open",
    agent: dict = Depends(get_current_agent),
):
    require_action(agent, "github.pr.list")
    try:
        return await GatewayService.list_pull_requests(agent["user_id"], owner, repo, state)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/github/pulls/{owner}/{repo}/{pull_number}")
async def get_pull_request(
    owner: str, repo: str, pull_number: int,
    agent: dict = Depends(get_current_agent),
):
    require_action(agent, "github.pr.read")
    try:
        return await GatewayService.get_pull_request(agent["user_id"], owner, repo, pull_number)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/github/review")
async def create_pr_review(
    payload: GitHubPRReviewRequest,
    agent: dict = Depends(get_current_agent),
):
    require_action(agent, "github.review.submit")
    try:
        result = await GatewayService.create_pr_review(
            agent["user_id"], payload.owner, payload.repo,
            payload.pull_number, payload.body, payload.event,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    # The review landed on GitHub — record dedup so Phase C's watcher
    # doesn't re-review this PR on the next tick. Idempotent at the
    # DB layer via the (agent_id, owner, repo, pr_number) unique constraint.
    if not ReviewedPRModel.exists(
        agent["id"], payload.owner, payload.repo, payload.pull_number
    ):
        ReviewedPRModel.record(
            agent["id"], payload.owner, payload.repo, payload.pull_number
        )
    return result


@router.post("/github/review/comment")
async def create_pr_review_comment(
    payload: GitHubPRCommentRequest,
    agent: dict = Depends(get_current_agent),
):
    require_action(agent, "github.pr.comment")
    try:
        return await GatewayService.create_pr_review_comment(
            agent["user_id"], payload.owner, payload.repo,
            payload.pull_number, payload.body, payload.path, payload.line,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Agent memory (agent-token auth + action policy) ────────────────────────────
# The agent reads its own key/value store (injected into role_context at dispatch
# in Phase C) and writes via the update-memory skill. Memory rows are scoped to
# the calling agent_id — an agent cannot see or write another agent's memory.

@router.get("/memory")
async def list_memory(agent: dict = Depends(get_current_agent)):
    require_action(agent, "agent.memory.read")
    rows = AgentMemoryModel.list_by_agent(agent["id"])
    return {"memory": [{"key": r["key"], "value": r["value"], "updated_at": r["updated_at"]} for r in rows]}


@router.post("/memory")
async def write_memory(
    payload: MemoryWriteRequest,
    agent: dict = Depends(get_current_agent),
):
    require_action(agent, "agent.memory.write")
    if not payload.key:
        raise HTTPException(400, "key is required")
    row = AgentMemoryModel.upsert(agent["id"], payload.key, payload.value)
    return {"key": row["key"], "value": row["value"], "updated_at": row["updated_at"]}


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


def _time_label(updated: str) -> str:
    """Relative time string for an ISO-8601 GitHub timestamp."""
    if not updated:
        return ""
    ts = datetime.fromisoformat(updated.replace("Z", "+00:00"))
    diff = datetime.now(ts.tzinfo) - ts
    mins = int(diff.total_seconds() / 60)
    hours = int(diff.total_seconds() / 3600)
    if mins < 60:
        return f"{mins}m ago"
    if hours < 24:
        return f"{hours}h ago"
    return ts.strftime("%b %d")


# Maps the noisy `reason`/event-type vocabulary to one of 5 buckets the UI
# filter row exposes: pr | issue | mention | ci | other.
_NOTIF_CATEGORY_BY_REASON = {
    "mention": "mention",
    "team_mention": "mention",
    "review_requested": "pr",
}
_NOTIF_CATEGORY_BY_SUBJECT = {
    "PullRequest": "pr",
    "Issue": "issue",
    "CheckSuite": "ci",
    "CheckRun": "ci",
}
_EVENT_CATEGORY = {
    "PullRequestEvent": "pr",
    "PullRequestReviewEvent": "pr",
    "PullRequestReviewCommentEvent": "pr",
    "IssuesEvent": "issue",
    "IssueCommentEvent": "issue",  # upgraded to "mention" when body mentions login
    "CheckSuiteEvent": "ci",
}
_REASON_LABEL = {
    "assign": "assigned", "author": "author", "comment": "commented",
    "mention": "mentioned", "review_requested": "review requested",
    "subscribed": "subscribed", "team_mention": "team mention",
}


def _notification_html_url(n: dict) -> str:
    """GitHub doesn't ship a direct html_url on notifications — derive from subject.url."""
    api_url = (n.get("subject") or {}).get("url") or ""
    if not api_url:
        return (n.get("repository") or {}).get("html_url", "")
    # /repos/owner/repo/pulls/123 → /owner/repo/pull/123
    return (
        api_url
        .replace("https://api.github.com/repos/", "https://github.com/")
        .replace("/pulls/", "/pull/")
    )


def _event_to_item(ev: dict, login: str) -> dict | None:
    """Normalize a /received_events row. Returns None for event types we skip."""
    ev_type = ev.get("type", "")
    base_category = _EVENT_CATEGORY.get(ev_type, "other")
    payload = ev.get("payload") or {}
    repo = (ev.get("repo") or {}).get("name", "")
    actor = (ev.get("actor") or {}).get("login", "")
    created = ev.get("created_at", "")

    # Issue/PR-comment with @login in the body → mention.
    body = (payload.get("comment") or {}).get("body", "") or ""
    if ev_type == "IssueCommentEvent" and login and f"@{login}" in body:
        base_category = "mention"

    if ev_type in ("PullRequestEvent", "PullRequestReviewEvent", "PullRequestReviewCommentEvent"):
        pr = payload.get("pull_request") or {}
        title = pr.get("title") or ""
        html_url = pr.get("html_url") or ""
        type_label = "PR"
        action = payload.get("action") or ""
        reason = f"{action} {ev_type.replace('Event', '').lower()}".strip()
        state = "draft" if pr.get("draft") else pr.get("state", "open")
    elif ev_type in ("IssuesEvent", "IssueCommentEvent"):
        issue = payload.get("issue") or {}
        title = issue.get("title") or ""
        html_url = (payload.get("comment") or {}).get("html_url") or issue.get("html_url") or ""
        type_label = "Issue"
        reason = "mentioned" if base_category == "mention" else (payload.get("action") or "commented")
        state = issue.get("state", "")
    elif ev_type == "CheckSuiteEvent":
        cs = payload.get("check_suite") or {}
        title = f"{cs.get('app', {}).get('name', 'CI')} — {cs.get('conclusion') or cs.get('status') or ''}"
        html_url = (ev.get("repo") or {}).get("url", "").replace("api.github.com/repos", "github.com")
        type_label = "CheckSuite"
        reason = cs.get("conclusion") or "ci"
        state = cs.get("status", "")
    else:
        return None  # PushEvent, WatchEvent, ForkEvent — skip the firehose

    return {
        "id": f"event-{ev.get('id')}",
        "category": base_category,
        "repo": repo,
        "title": title,
        "type": type_label,
        "reason": reason,
        "time": _time_label(created),
        "_ts": created,
        "unread": False,
        "actor": actor,
        "author": actor,
        "state": state,
        "html_url": html_url,
    }


@router.get("/github/activity")
async def get_github_activity(user: dict = Depends(get_current_user)):
    """Fetch a richer GitHub activity feed: notifications + review-requested PRs +
    events on watched repos. Each item carries a normalized `category` so the UI
    can filter (pr / issue / mention / ci / other)."""
    cred = CredentialStore.get(user["id"], "github")
    if not cred:
        return {"connected": False, "items": []}

    token = cred["token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient() as client:
        # We need the login before we can call /users/{login}/received_events,
        # so fetch /user in parallel with notifications + the review-requested
        # PR search; received_events is a follow-up.
        user_resp, notif_resp, pr_resp = await asyncio.gather(
            client.get("https://api.github.com/user", headers=headers),
            client.get(
                "https://api.github.com/notifications",
                params={"all": "true", "per_page": 30},
                headers=headers,
            ),
            client.get(
                "https://api.github.com/search/issues",
                params={"q": "is:pr is:open review-requested:@me", "per_page": 10},
                headers=headers,
            ),
        )

        if notif_resp.status_code == 401 or user_resp.status_code == 401:
            return {"connected": False, "items": []}

        login = user_resp.json().get("login", "") if user_resp.is_success else ""

        events_resp = None
        if login:
            try:
                events_resp = await client.get(
                    f"https://api.github.com/users/{login}/received_events",
                    params={"per_page": 30},
                    headers=headers,
                )
            except httpx.HTTPError:
                events_resp = None

    items: list[dict] = []

    if notif_resp.is_success:
        for n in notif_resp.json():
            subject_type = (n.get("subject") or {}).get("type", "")
            reason = n.get("reason", "")
            category = (
                _NOTIF_CATEGORY_BY_REASON.get(reason)
                or _NOTIF_CATEGORY_BY_SUBJECT.get(subject_type, "other")
            )
            items.append({
                "id": f"notif-{n['id']}",
                "category": category,
                "repo": (n.get("repository") or {}).get("full_name", ""),
                "title": (n.get("subject") or {}).get("title", ""),
                "type": subject_type.replace("PullRequest", "PR"),
                "reason": _REASON_LABEL.get(reason, reason),
                "time": _time_label(n.get("updated_at", "")),
                "_ts": n.get("updated_at", ""),
                "unread": n.get("unread", False),
                "html_url": _notification_html_url(n),
            })

    if pr_resp.is_success:
        for pr in pr_resp.json().get("items", []):
            updated = pr.get("updated_at", "")
            items.append({
                "id": f"pr-{pr['id']}",
                "category": "pr",
                "repo": pr.get("repository_url", "").split("repos/")[-1],
                "title": pr["title"],
                "type": "PR",
                "reason": "review requested",
                "time": _time_label(updated),
                "_ts": updated,
                "unread": True,
                "author": (pr.get("user") or {}).get("login", ""),
                "state": "draft" if pr.get("draft") else pr.get("state", "open"),
                "html_url": pr.get("html_url", ""),
            })

    if events_resp is not None and events_resp.is_success:
        for ev in events_resp.json():
            item = _event_to_item(ev, login)
            if item is not None:
                items.append(item)

    # Dedup by (repo, title). Prefer the row with `unread=True` when both exist
    # (notifications carry the unread bit; events don't).
    by_key: dict[tuple[str, str], dict] = {}
    for it in items:
        key = (it.get("repo", ""), it.get("title", ""))
        existing = by_key.get(key)
        if existing is None or (it.get("unread") and not existing.get("unread")):
            by_key[key] = it

    deduped = [it for it in by_key.values() if (it.get("title") or "").strip()]
    deduped.sort(key=lambda x: x.get("_ts") or "", reverse=True)
    for it in deduped:
        it.pop("_ts", None)

    return {"connected": True, "items": deduped[:50]}


@router.delete("/github/disconnect")
def disconnect_github(user: dict = Depends(get_current_user)):
    CredentialStore.delete(user["id"], "github")
    return {"ok": True}
