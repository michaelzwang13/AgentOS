import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.agent_auth import get_current_agent
from app.models.agent_memory import AgentMemoryModel
from app.models.reviewed_pr import ReviewedPRModel
from app.services.gateway import GatewayService
from app.services.policy import require_action
from app.services.credential_store import CredentialStore
from app.services import feed_fetchers, signal_feed_cache

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

    # Pull the three feeds in parallel; piggy-back on the cache so a digest
    # right after a feed-page open is essentially free.
    uid = user["id"]
    slack_res, gmail_res, github_res = await asyncio.gather(
        signal_feed_cache.get_or_fetch(uid, "slack",  lambda: feed_fetchers.slack_messages(uid)),
        signal_feed_cache.get_or_fetch(uid, "gmail",  lambda: feed_fetchers.gmail_messages(uid)),
        signal_feed_cache.get_or_fetch(uid, "github", lambda: feed_fetchers.github_activity(uid)),
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
    return await signal_feed_cache.get_or_fetch(
        user["id"], "slack", lambda: feed_fetchers.slack_messages(user["id"])
    )


@router.delete("/slack/disconnect")
def disconnect_slack(user: dict = Depends(get_current_user)):
    CredentialStore.delete(user["id"], "slack")
    signal_feed_cache.clear(user["id"], "slack")
    return {"ok": True}


@router.get("/gmail/messages")
async def get_gmail_messages(user: dict = Depends(get_current_user)):
    return await signal_feed_cache.get_or_fetch(
        user["id"], "gmail", lambda: feed_fetchers.gmail_messages(user["id"])
    )


@router.delete("/gmail/disconnect")
def disconnect_gmail(user: dict = Depends(get_current_user)):
    CredentialStore.delete(user["id"], "gmail")
    signal_feed_cache.clear(user["id"], "gmail")
    return {"ok": True}


@router.get("/github/activity")
async def get_github_activity(user: dict = Depends(get_current_user)):
    return await signal_feed_cache.get_or_fetch(
        user["id"], "github", lambda: feed_fetchers.github_activity(user["id"])
    )


@router.delete("/github/disconnect")
def disconnect_github(user: dict = Depends(get_current_user)):
    CredentialStore.delete(user["id"], "github")
    signal_feed_cache.clear(user["id"], "github")
    return {"ok": True}
