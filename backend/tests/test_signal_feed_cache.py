"""Tests for the Signal Feed in-memory TTL cache.

Stateful module-level dict, so each test calls clear_all() in setup to
isolate. The TTL is patched per-test where expiry behavior is the subject.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.services import signal_feed_cache as cache


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear_all()
    yield
    cache.clear_all()


class TestGetSet:
    def test_get_returns_none_on_miss(self):
        assert cache.get("u1", "slack") is None

    def test_set_then_get_returns_payload(self):
        cache.set("u1", "slack", {"connected": True, "messages": [1, 2]})
        assert cache.get("u1", "slack") == {"connected": True, "messages": [1, 2]}

    def test_get_scoped_by_user_and_service(self):
        cache.set("u1", "slack", {"a": 1})
        cache.set("u1", "gmail", {"b": 2})
        cache.set("u2", "slack", {"c": 3})
        assert cache.get("u1", "slack") == {"a": 1}
        assert cache.get("u1", "gmail") == {"b": 2}
        assert cache.get("u2", "slack") == {"c": 3}
        assert cache.get("u2", "gmail") is None

    def test_clear_removes_one_entry(self):
        cache.set("u1", "slack", {"a": 1})
        cache.set("u1", "gmail", {"b": 2})
        cache.clear("u1", "slack")
        assert cache.get("u1", "slack") is None
        assert cache.get("u1", "gmail") == {"b": 2}

    def test_clear_idempotent_on_missing_key(self):
        cache.clear("nobody", "slack")  # no-op, no raise


class TestTTL:
    def test_fresh_entry_returns_payload(self):
        cache.set("u1", "slack", {"x": 1})
        assert cache.get("u1", "slack") == {"x": 1}

    def test_expired_entry_returns_none(self):
        cache.set("u1", "slack", {"x": 1})
        # Rewind the stored timestamp past the TTL window.
        stored_at, payload = cache._cache[("u1", "slack")]
        cache._cache[("u1", "slack")] = (
            stored_at - timedelta(seconds=cache.CACHE_TTL_SECONDS + 1),
            payload,
        )
        assert cache.get("u1", "slack") is None

    def test_entry_at_exact_ttl_boundary_returns_payload(self):
        """Reads at the boundary — TTL is exclusive of expiry, just barely
        inside is still a hit."""
        cache.set("u1", "slack", {"x": 1})
        stored_at, payload = cache._cache[("u1", "slack")]
        cache._cache[("u1", "slack")] = (
            stored_at - timedelta(seconds=cache.CACHE_TTL_SECONDS - 1),
            payload,
        )
        assert cache.get("u1", "slack") == {"x": 1}


class TestGetOrFetch:
    @pytest.mark.asyncio
    async def test_calls_fetcher_on_miss_and_caches_result(self):
        fetcher = AsyncMock(return_value={"connected": True, "items": [1]})
        result = await cache.get_or_fetch("u1", "github", fetcher)
        assert result == {"connected": True, "items": [1]}
        fetcher.assert_called_once()
        # Second call hits cache — fetcher does not re-run.
        result2 = await cache.get_or_fetch("u1", "github", fetcher)
        assert result2 == {"connected": True, "items": [1]}
        fetcher.assert_called_once()

    @pytest.mark.asyncio
    async def test_negative_response_not_cached(self):
        """When the fetcher returns connected=False we deliberately skip
        caching so the user sees a fresh connection immediately."""
        fetcher = AsyncMock(return_value={"connected": False, "items": []})
        await cache.get_or_fetch("u1", "github", fetcher)
        assert cache.get("u1", "github") is None
        # Subsequent call re-invokes the fetcher.
        await cache.get_or_fetch("u1", "github", fetcher)
        assert fetcher.call_count == 2

    @pytest.mark.asyncio
    async def test_expired_entry_triggers_refetch(self):
        fetcher = AsyncMock(side_effect=[
            {"connected": True, "items": ["first"]},
            {"connected": True, "items": ["second"]},
        ])
        await cache.get_or_fetch("u1", "github", fetcher)
        # Expire the entry.
        stored_at, payload = cache._cache[("u1", "github")]
        cache._cache[("u1", "github")] = (
            stored_at - timedelta(seconds=cache.CACHE_TTL_SECONDS + 1),
            payload,
        )
        result = await cache.get_or_fetch("u1", "github", fetcher)
        assert result == {"connected": True, "items": ["second"]}
        assert fetcher.call_count == 2
