"""Tests for the PR watcher service.

The watcher walks (running code-review-engineer agents) × (their watched_repos),
asks GitHub for open PRs, dedups vs reviewed_prs, and dispatches a review task.
These tests run a single tick at a time — the asyncio.sleep loop is exercised
only briefly in the lifecycle test.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from tests.conftest import _make_agent


def _running_agent(**overrides):
    return _make_agent(role="code-review-engineer", status="running", **overrides)


def _watched_row(**overrides):
    base = {
        "id": "wr-1",
        "agent_id": "agent-001",
        "user_id": "user-001",
        "owner": "octocat",
        "repo": "hello-world",
        "created_at": "2025-01-01T00:00:00+00:00",
    }
    base.update(overrides)
    return base


def _pr(number: int, created_at: str | None = None):
    return {"number": number, "created_at": created_at or "2099-01-01T00:00:00Z"}


class TestTick:
    @pytest.mark.asyncio
    async def test_tick_dispatches_review_for_unreviewed_pr(self):
        from app.services.pr_watcher import PRWatcher

        agent = _running_agent()
        with patch("app.services.pr_watcher.AgentModel") as mock_agents, \
             patch("app.services.pr_watcher.WatchedRepoModel") as mock_repos, \
             patch("app.services.pr_watcher.GatewayService") as mock_gw, \
             patch("app.services.pr_watcher.ReviewedPRModel") as mock_rev:
            mock_agents.list_running_by_role.return_value = [agent]
            mock_repos.list_all.return_value = [_watched_row()]
            mock_gw.list_pull_requests = AsyncMock(
                return_value={"status": 200, "data": [_pr(42)]}
            )
            mock_rev.exists.return_value = False

            dispatcher = MagicMock()
            dispatcher.dispatch_task = AsyncMock(return_value={"accepted": True})
            watcher = PRWatcher(dispatcher=dispatcher)
            # Mark first tick as done so the 30-min gate doesn't run.
            watcher._first_tick_done = True
            await watcher.tick()

        dispatcher.dispatch_task.assert_awaited_once()
        kwargs = dispatcher.dispatch_task.call_args.kwargs
        assert kwargs["agent_id"] == agent["id"]
        assert "octocat/hello-world#42" in kwargs["instruction"]
        assert kwargs["metadata"]["pr_number"] == 42

    @pytest.mark.asyncio
    async def test_tick_skips_already_reviewed_pr(self):
        from app.services.pr_watcher import PRWatcher

        with patch("app.services.pr_watcher.AgentModel") as mock_agents, \
             patch("app.services.pr_watcher.WatchedRepoModel") as mock_repos, \
             patch("app.services.pr_watcher.GatewayService") as mock_gw, \
             patch("app.services.pr_watcher.ReviewedPRModel") as mock_rev:
            mock_agents.list_running_by_role.return_value = [_running_agent()]
            mock_repos.list_all.return_value = [_watched_row()]
            mock_gw.list_pull_requests = AsyncMock(
                return_value={"status": 200, "data": [_pr(42)]}
            )
            mock_rev.exists.return_value = True

            dispatcher = MagicMock()
            dispatcher.dispatch_task = AsyncMock()
            watcher = PRWatcher(dispatcher=dispatcher)
            watcher._first_tick_done = True
            await watcher.tick()

        dispatcher.dispatch_task.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_tick_treats_409_as_deferred_not_fatal(self):
        """A 409 from the sidecar means the agent is busy — skip and try next tick."""
        from app.services.pr_watcher import PRWatcher

        with patch("app.services.pr_watcher.AgentModel") as mock_agents, \
             patch("app.services.pr_watcher.WatchedRepoModel") as mock_repos, \
             patch("app.services.pr_watcher.GatewayService") as mock_gw, \
             patch("app.services.pr_watcher.ReviewedPRModel") as mock_rev:
            mock_agents.list_running_by_role.return_value = [_running_agent()]
            mock_repos.list_all.return_value = [_watched_row()]
            mock_gw.list_pull_requests = AsyncMock(
                return_value={"status": 200, "data": [_pr(42)]}
            )
            mock_rev.exists.return_value = False

            busy_response = MagicMock()
            busy_response.status_code = 409
            dispatcher = MagicMock()
            dispatcher.dispatch_task = AsyncMock(
                side_effect=httpx.HTTPStatusError(
                    "busy", request=MagicMock(), response=busy_response
                )
            )
            watcher = PRWatcher(dispatcher=dispatcher)
            watcher._first_tick_done = True
            # Should not raise.
            await watcher.tick()

        # We don't write reviewed_prs on a deferred dispatch — that only
        # happens server-side when the review skill actually fires. The
        # PR remains a candidate for the next tick.
        # No exception bubbled up: the watcher swallowed the 409.

    @pytest.mark.asyncio
    async def test_tick_isolates_failures_per_repo(self):
        """One repo's GitHub call failing must not stop the rest."""
        from app.services.pr_watcher import PRWatcher

        agent = _running_agent()
        repo_bad = _watched_row(id="wr-bad", repo="broken")
        repo_good = _watched_row(id="wr-good", repo="ok")

        # First call (broken) raises, second (ok) returns a PR.
        call_results = [
            RuntimeError("github API down"),
            {"status": 200, "data": [_pr(7)]},
        ]

        async def fake_list_prs(**kwargs):
            outcome = call_results.pop(0)
            if isinstance(outcome, Exception):
                raise outcome
            return outcome

        with patch("app.services.pr_watcher.AgentModel") as mock_agents, \
             patch("app.services.pr_watcher.WatchedRepoModel") as mock_repos, \
             patch("app.services.pr_watcher.GatewayService") as mock_gw, \
             patch("app.services.pr_watcher.ReviewedPRModel") as mock_rev:
            mock_agents.list_running_by_role.return_value = [agent]
            mock_repos.list_all.return_value = [repo_bad, repo_good]
            mock_gw.list_pull_requests = AsyncMock(side_effect=fake_list_prs)
            mock_rev.exists.return_value = False

            dispatcher = MagicMock()
            dispatcher.dispatch_task = AsyncMock(return_value={"accepted": True})
            watcher = PRWatcher(dispatcher=dispatcher)
            watcher._first_tick_done = True
            await watcher.tick()

        # The good repo's PR still got dispatched despite the broken one
        # crashing first.
        dispatcher.dispatch_task.assert_awaited_once()
        kwargs = dispatcher.dispatch_task.call_args.kwargs
        assert kwargs["metadata"]["repo"] == "ok"

    @pytest.mark.asyncio
    async def test_first_tick_ignores_stale_prs(self):
        """On the first tick after boot, PRs older than 30 min are skipped
        so the platform doesn't backlog-review accumulated history."""
        from app.services.pr_watcher import PRWatcher

        stale = _pr(1, created_at=(
            datetime.now(timezone.utc) - timedelta(hours=2)
        ).isoformat().replace("+00:00", "Z"))
        fresh = _pr(2, created_at=(
            datetime.now(timezone.utc) - timedelta(minutes=5)
        ).isoformat().replace("+00:00", "Z"))

        with patch("app.services.pr_watcher.AgentModel") as mock_agents, \
             patch("app.services.pr_watcher.WatchedRepoModel") as mock_repos, \
             patch("app.services.pr_watcher.GatewayService") as mock_gw, \
             patch("app.services.pr_watcher.ReviewedPRModel") as mock_rev:
            mock_agents.list_running_by_role.return_value = [_running_agent()]
            mock_repos.list_all.return_value = [_watched_row()]
            mock_gw.list_pull_requests = AsyncMock(
                return_value={"status": 200, "data": [stale, fresh]}
            )
            mock_rev.exists.return_value = False

            dispatcher = MagicMock()
            dispatcher.dispatch_task = AsyncMock(return_value={"accepted": True})
            watcher = PRWatcher(dispatcher=dispatcher)
            watcher._started_at = datetime.now(timezone.utc)
            # leave _first_tick_done as False — this is the boot tick
            await watcher.tick()

        # Only the fresh PR was dispatched.
        assert dispatcher.dispatch_task.await_count == 1
        kwargs = dispatcher.dispatch_task.call_args.kwargs
        assert kwargs["metadata"]["pr_number"] == 2

    @pytest.mark.asyncio
    async def test_steady_state_tick_reviews_old_prs(self):
        """After the first tick, age doesn't matter — anything new gets reviewed."""
        from app.services.pr_watcher import PRWatcher

        old = _pr(1, created_at=(
            datetime.now(timezone.utc) - timedelta(hours=24)
        ).isoformat().replace("+00:00", "Z"))

        with patch("app.services.pr_watcher.AgentModel") as mock_agents, \
             patch("app.services.pr_watcher.WatchedRepoModel") as mock_repos, \
             patch("app.services.pr_watcher.GatewayService") as mock_gw, \
             patch("app.services.pr_watcher.ReviewedPRModel") as mock_rev:
            mock_agents.list_running_by_role.return_value = [_running_agent()]
            mock_repos.list_all.return_value = [_watched_row()]
            mock_gw.list_pull_requests = AsyncMock(
                return_value={"status": 200, "data": [old]}
            )
            mock_rev.exists.return_value = False

            dispatcher = MagicMock()
            dispatcher.dispatch_task = AsyncMock(return_value={"accepted": True})
            watcher = PRWatcher(dispatcher=dispatcher)
            watcher._first_tick_done = True  # past the boot gate
            await watcher.tick()

        dispatcher.dispatch_task.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_no_running_agents_short_circuits(self):
        """If no Code Review Engineer is running, we don't even query watched_repos."""
        from app.services.pr_watcher import PRWatcher

        with patch("app.services.pr_watcher.AgentModel") as mock_agents, \
             patch("app.services.pr_watcher.WatchedRepoModel") as mock_repos:
            mock_agents.list_running_by_role.return_value = []
            mock_repos.list_all = MagicMock()

            dispatcher = MagicMock()
            dispatcher.dispatch_task = AsyncMock()
            watcher = PRWatcher(dispatcher=dispatcher)
            watcher._first_tick_done = True
            await watcher.tick()

        mock_repos.list_all.assert_not_called()
        dispatcher.dispatch_task.assert_not_awaited()


class TestRunForever:
    @pytest.mark.asyncio
    async def test_run_forever_cancels_cleanly(self):
        """A cancelled task should raise CancelledError out of run_forever."""
        from app.services.pr_watcher import PRWatcher

        watcher = PRWatcher(poll_interval=0.01)
        # Replace tick with a no-op so the loop spins fast.
        watcher.tick = AsyncMock(return_value=None)

        task = asyncio.create_task(watcher.run_forever())
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert watcher.tick.await_count >= 1
