"""Tests for the Signal Feed background poller.

The poller walks every credential row each tick, calls the matching
feed fetcher, and overwrites the cache. These tests run a single tick
at a time — the asyncio.sleep loop is exercised only briefly in the
lifecycle test.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.services import signal_feed_cache


@pytest.fixture(autouse=True)
def _clean_cache():
    """Module-level cache state must not bleed between tests."""
    signal_feed_cache.clear_all()
    yield
    signal_feed_cache.clear_all()


class TestTick:
    @pytest.mark.asyncio
    async def test_empty_credentials_no_op(self):
        from app.services.feed_poller import FeedPoller

        with patch("app.services.feed_poller.CredentialModel") as mock_cm:
            mock_cm.list_active_services.return_value = []
            await FeedPoller().tick()
        # No writes happened.
        assert signal_feed_cache.get("u1", "slack") is None

    @pytest.mark.asyncio
    async def test_tick_writes_each_service_to_cache(self):
        from app.services.feed_poller import FeedPoller

        rows = [
            {"user_id": "u1", "service": "slack"},
            {"user_id": "u1", "service": "gmail"},
            {"user_id": "u1", "service": "github"},
        ]
        slack_payload  = {"connected": True, "messages": [{"id": "1"}]}
        gmail_payload  = {"connected": True, "emails":   [{"id": "a"}]}
        github_payload = {"connected": True, "items":    [{"id": "x"}]}

        with patch("app.services.feed_poller.CredentialModel") as mock_cm, \
             patch("app.services.feed_poller.feed_fetchers") as mock_ff:
            mock_cm.list_active_services.return_value = rows
            mock_ff.slack_messages  = AsyncMock(return_value=slack_payload)
            mock_ff.gmail_messages  = AsyncMock(return_value=gmail_payload)
            mock_ff.github_activity = AsyncMock(return_value=github_payload)

            # The FEED_FETCHERS map is bound at import time to the real
            # fetcher callables, so patching feed_fetchers.* doesn't
            # rewire the map. Patch the map itself.
            with patch.dict(
                "app.services.feed_poller.FEED_FETCHERS",
                {
                    "slack":  mock_ff.slack_messages,
                    "gmail":  mock_ff.gmail_messages,
                    "github": mock_ff.github_activity,
                },
                clear=True,
            ):
                await FeedPoller().tick()

        assert signal_feed_cache.get("u1", "slack")  == slack_payload
        assert signal_feed_cache.get("u1", "gmail")  == gmail_payload
        assert signal_feed_cache.get("u1", "github") == github_payload

    @pytest.mark.asyncio
    async def test_unknown_service_skipped_not_errored(self):
        """A discord credential (or any non-feed service) must be silently
        skipped — not raise, not abort the rest of the tick."""
        from app.services.feed_poller import FeedPoller

        rows = [
            {"user_id": "u1", "service": "discord"},
            {"user_id": "u1", "service": "slack"},
        ]
        slack_fetcher = AsyncMock(return_value={"connected": True, "messages": []})

        with patch("app.services.feed_poller.CredentialModel") as mock_cm, \
             patch.dict(
                 "app.services.feed_poller.FEED_FETCHERS",
                 {"slack": slack_fetcher, "gmail": AsyncMock(), "github": AsyncMock()},
                 clear=True,
             ):
            mock_cm.list_active_services.return_value = rows
            await FeedPoller().tick()

        slack_fetcher.assert_awaited_once_with("u1")

    @pytest.mark.asyncio
    async def test_connected_false_not_cached(self):
        """If the fetcher returns connected=False (credential vanished mid-tick
        or upstream rejected the token), do not poison the cache."""
        from app.services.feed_poller import FeedPoller

        rows = [{"user_id": "u1", "service": "slack"}]
        fetcher = AsyncMock(return_value={"connected": False, "messages": []})

        with patch("app.services.feed_poller.CredentialModel") as mock_cm, \
             patch.dict(
                 "app.services.feed_poller.FEED_FETCHERS",
                 {"slack": fetcher, "gmail": AsyncMock(), "github": AsyncMock()},
                 clear=True,
             ):
            mock_cm.list_active_services.return_value = rows
            await FeedPoller().tick()

        assert signal_feed_cache.get("u1", "slack") is None

    @pytest.mark.asyncio
    async def test_tick_isolates_failures_per_pair(self):
        """One (user, service) raising must not stop the tick from refreshing
        the rest. Error isolation is the watcher's main correctness property."""
        from app.services.feed_poller import FeedPoller

        rows = [
            {"user_id": "u1", "service": "slack"},   # raises
            {"user_id": "u1", "service": "gmail"},   # succeeds
            {"user_id": "u2", "service": "github"},  # succeeds
        ]
        bad     = AsyncMock(side_effect=RuntimeError("slack down"))
        gmail   = AsyncMock(return_value={"connected": True, "emails": [{"id": "a"}]})
        github  = AsyncMock(return_value={"connected": True, "items":  [{"id": "x"}]})

        with patch("app.services.feed_poller.CredentialModel") as mock_cm, \
             patch.dict(
                 "app.services.feed_poller.FEED_FETCHERS",
                 {"slack": bad, "gmail": gmail, "github": github},
                 clear=True,
             ):
            mock_cm.list_active_services.return_value = rows
            # Must not raise.
            await FeedPoller().tick()

        assert signal_feed_cache.get("u1", "slack")  is None  # never written
        assert signal_feed_cache.get("u1", "gmail") is not None
        assert signal_feed_cache.get("u2", "github") is not None


class TestRunForever:
    @pytest.mark.asyncio
    async def test_run_forever_ticks_then_cancels_cleanly(self):
        """A cancelled task should raise CancelledError out of run_forever
        after firing at least one tick."""
        from app.services.feed_poller import FeedPoller

        poller = FeedPoller(poll_interval=0.01)
        poller.tick = AsyncMock(return_value=None)

        task = asyncio.create_task(poller.run_forever())
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert poller.tick.await_count >= 1

    @pytest.mark.asyncio
    async def test_tick_crash_does_not_kill_loop(self):
        """A tick raising an exception must be logged and the loop must
        continue — never let a transient bug take the poller offline
        until the next deploy."""
        from app.services.feed_poller import FeedPoller

        poller = FeedPoller(poll_interval=0.01)
        # First tick raises, subsequent ticks succeed.
        poller.tick = AsyncMock(
            side_effect=[RuntimeError("boom"), None, None, None]
        )

        task = asyncio.create_task(poller.run_forever())
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert poller.tick.await_count >= 2  # crashed once, kept going
