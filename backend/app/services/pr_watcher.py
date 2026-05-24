"""Background poll loop that drives autonomous PR reviews.

The watcher is a single asyncio.Task owned by the FastAPI lifespan. Every
POLL_INTERVAL seconds it walks the (running code-review-engineer agents) ×
(their watched_repos) cross-product, asks GitHub for the list of open PRs
on each repo, dedupes against reviewed_prs, and dispatches a review task
for each unreviewed PR. The agent itself decides to call the github-pr-review
skill from inside its container; the watcher just triggers.

Dedup is intentionally tied to the review skill successfully posting to
POST /gateway/github/review (which writes the reviewed_prs row server-side
in Phase D). If the LLM never actually submits the review, the PR stays
"unreviewed" and we'll dispatch again next tick. The watcher is the
trigger, not the bookkeeper.

The 30-minute staleness gate is startup-only: on the first tick after the
platform boots, ignore PRs older than 30 min so we don't backlog-review a
queue that accumulated while the platform was down. Steady-state ticks
have no time gate.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.models.agent import AgentModel
from app.models.reviewed_pr import ReviewedPRModel
from app.models.watched_repo import WatchedRepoModel
from app.services.dispatcher import Dispatcher
from app.services.gateway import GatewayService

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 120
STARTUP_STALENESS_WINDOW = timedelta(minutes=30)
WATCHED_ROLE = "code-review-engineer"


def _parse_iso8601(s: str) -> datetime:
    """Parse a GitHub-shaped ISO timestamp ('...Z') into an aware datetime."""
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


class PRWatcher:
    def __init__(
        self,
        dispatcher: Dispatcher | None = None,
        poll_interval: float = POLL_INTERVAL_SECONDS,
    ):
        self._dispatcher = dispatcher or Dispatcher()
        self._poll_interval = poll_interval
        self._started_at: datetime | None = None
        self._first_tick_done = False

    async def run_forever(self) -> None:
        """Sleep-tick-sleep until cancelled by the lifespan shutdown."""
        self._started_at = datetime.now(timezone.utc)
        self._first_tick_done = False
        logger.info("pr_watcher: started, polling every %ss", self._poll_interval)
        try:
            while True:
                try:
                    await self.tick()
                except Exception:  # noqa: BLE001 — never let the loop die
                    logger.exception("pr_watcher: tick crashed; continuing")
                self._first_tick_done = True
                await asyncio.sleep(self._poll_interval)
        except asyncio.CancelledError:
            logger.info("pr_watcher: shutting down")
            raise

    async def tick(self) -> None:
        """One pass over (running agents) × (their watched_repos).

        Error isolation is at the (agent, repo) granularity: one repo
        failing the GitHub call must not skip the rest.
        """
        agents = AgentModel.list_running_by_role(WATCHED_ROLE)
        if not agents:
            return

        watched = WatchedRepoModel.list_all()
        # Group rows by agent_id so we make at most one pass per (agent, repo).
        by_agent: dict[str, list[dict]] = {}
        for row in watched:
            by_agent.setdefault(row["agent_id"], []).append(row)

        for agent in agents:
            agent_repos = by_agent.get(agent["id"], [])
            for row in agent_repos:
                try:
                    await self._review_repo(agent, row["owner"], row["repo"])
                except Exception:  # noqa: BLE001 — isolate per-repo failures
                    logger.exception(
                        "pr_watcher: failure for agent=%s repo=%s/%s",
                        agent["id"], row["owner"], row["repo"],
                    )

    async def _review_repo(self, agent: dict, owner: str, repo: str) -> None:
        """Fetch open PRs and dispatch a review for any that are unreviewed."""
        resp = await GatewayService.list_pull_requests(
            user_id=agent["user_id"], owner=owner, repo=repo
        )
        prs = resp.get("data") or []
        if not isinstance(prs, list):
            # GitHub returns an error object (dict) on auth/rate-limit failures.
            logger.warning(
                "pr_watcher: list_pull_requests returned non-list for %s/%s: %s",
                owner, repo, resp,
            )
            return

        cutoff = (
            (self._started_at or datetime.now(timezone.utc)) - STARTUP_STALENESS_WINDOW
            if not self._first_tick_done
            else None
        )

        for pr in prs:
            pr_number = pr.get("number")
            if pr_number is None:
                continue

            if cutoff is not None:
                created_raw = pr.get("created_at")
                if created_raw:
                    try:
                        created = _parse_iso8601(created_raw)
                    except ValueError:
                        created = None
                    if created is not None and created < cutoff:
                        continue

            if ReviewedPRModel.exists(agent["id"], owner, repo, pr_number):
                continue

            await self._dispatch_review(agent, owner, repo, pr_number)

    async def _dispatch_review(
        self, agent: dict, owner: str, repo: str, pr_number: int
    ) -> None:
        """Send the review instruction. 409 from the sidecar = agent busy, try next tick."""
        instruction = (
            f"A new pull request is open at {owner}/{repo}#{pr_number}. "
            "Use the github-pr-review skill to fetch the diff, review it, "
            "and submit your review via the platform gateway."
        )
        try:
            await self._dispatcher.dispatch_task(
                agent_id=agent["id"],
                instruction=instruction,
                metadata={
                    "trigger": "pr_watcher",
                    "owner": owner,
                    "repo": repo,
                    "pr_number": pr_number,
                },
            )
            logger.info(
                "pr_watcher: dispatched review agent=%s repo=%s/%s pr=#%s",
                agent["id"], owner, repo, pr_number,
            )
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 409:
                logger.info(
                    "pr_watcher: agent=%s busy, deferring %s/%s#%s",
                    agent["id"], owner, repo, pr_number,
                )
                return
            raise
