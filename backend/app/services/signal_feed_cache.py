"""In-memory TTL cache for the Signal Feed.

Module-level dict keyed by `(user_id, service)`. Each entry is the timestamp
it was written + the payload returned by a feed fetcher. Reads return the
payload while fresh, `None` once the TTL has elapsed — callers fall through
to a live fetch on miss.

Production-shaped interface (get/set/clear + get_or_fetch wrapper) so the
swap to Redis later is a one-file change, not a refactor of every handler.

The TTL is intentionally a hair longer than `feed_poller`'s 120s tick so a
late tick doesn't expose readers to a window of stale-and-evicted entries.
"""
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

CACHE_TTL_SECONDS = 180

_cache: dict[tuple[str, str], tuple[datetime, dict]] = {}


def get(user_id: str, service: str) -> dict | None:
    """Return cached payload if still fresh; None otherwise."""
    entry = _cache.get((user_id, service))
    if not entry:
        return None
    stored_at, payload = entry
    if datetime.now(timezone.utc) - stored_at > timedelta(seconds=CACHE_TTL_SECONDS):
        return None
    return payload


def set(user_id: str, service: str, payload: dict) -> None:
    _cache[(user_id, service)] = (datetime.now(timezone.utc), payload)


def clear(user_id: str, service: str) -> None:
    _cache.pop((user_id, service), None)


def clear_all() -> None:
    """Test helper — wipe every entry."""
    _cache.clear()


async def get_or_fetch(
    user_id: str,
    service: str,
    fetch_callable: Callable[[], Awaitable[dict]],
) -> dict:
    """Cache-aside wrapper: return cached payload on hit, else call the fetcher
    and cache the result before returning. Negative responses (connected=False)
    are not cached — a fresh connection should reflect immediately, not wait
    out the TTL."""
    cached = get(user_id, service)
    if cached is not None:
        return cached
    payload = await fetch_callable()
    if payload.get("connected"):
        set(user_id, service, payload)
    return payload


__all__ = [
    "CACHE_TTL_SECONDS",
    "get",
    "set",
    "clear",
    "clear_all",
    "get_or_fetch",
]
