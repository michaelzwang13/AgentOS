"""Pure-async fetchers for the Signal Feed (Slack / Gmail / GitHub).

Extracted from `app/routers/gateway.py` so both the HTTP handlers and the
background `feed_poller` can share the same code paths. Each function takes
a `user_id`, looks up the user's stored credential, and returns the
normalized payload the UI consumes. Returns a `{"connected": False, ...}`
shape when no credential or upstream auth fails — same as the original
handlers.
"""
import asyncio
import time
from datetime import datetime

import httpx

from app.services.credential_store import CredentialStore


# ── Slack ─────────────────────────────────────────────────────────────────────

async def slack_messages(user_id: str) -> dict:
    """Fetch recent messages from the user's connected Slack workspace."""
    cred = CredentialStore.get(user_id, "slack")
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


# ── Gmail ─────────────────────────────────────────────────────────────────────

async def gmail_messages(user_id: str) -> dict:
    """Fetch recent inbox messages from the user's connected Gmail account."""
    cred = CredentialStore.get(user_id, "gmail")
    if not cred:
        return {"connected": False, "emails": []}

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


# ── GitHub ────────────────────────────────────────────────────────────────────

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
    "IssueCommentEvent": "issue",
    "CheckSuiteEvent": "ci",
}
_REASON_LABEL = {
    "assign": "assigned", "author": "author", "comment": "commented",
    "mention": "mentioned", "review_requested": "review requested",
    "subscribed": "subscribed", "team_mention": "team mention",
}


def _notification_html_url(n: dict) -> str:
    api_url = (n.get("subject") or {}).get("url") or ""
    if not api_url:
        return (n.get("repository") or {}).get("html_url", "")
    return (
        api_url
        .replace("https://api.github.com/repos/", "https://github.com/")
        .replace("/pulls/", "/pull/")
    )


def _event_to_item(ev: dict, login: str) -> dict | None:
    ev_type = ev.get("type", "")
    base_category = _EVENT_CATEGORY.get(ev_type, "other")
    payload = ev.get("payload") or {}
    repo = (ev.get("repo") or {}).get("name", "")
    actor = (ev.get("actor") or {}).get("login", "")
    created = ev.get("created_at", "")

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
        return None

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


async def github_activity(user_id: str) -> dict:
    """Fetch a richer GitHub activity feed: notifications + review-requested PRs +
    events on watched repos. Each item carries a normalized `category` so the UI
    can filter (pr / issue / mention / ci / other)."""
    cred = CredentialStore.get(user_id, "github")
    if not cred:
        return {"connected": False, "items": []}

    token = cred["token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient() as client:
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
