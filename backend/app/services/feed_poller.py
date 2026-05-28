"""Background poll loop that keeps the Signal Feed cache warm.

The poller is a single asyncio.Task owned by the FastAPI lifespan, mirroring
`pr_watcher.py`. Every POLL_INTERVAL seconds it walks every credential row,
calls the matching fetcher, and overwrites the cache entry. Users opening
the feed in the meantime read the warm cache in <100ms instead of paying
the 2-5s live-fetch cost.

The poller is write-only against `signal_feed_cache` — it never reads.
Reading would defeat its purpose (a hit would short-circuit the refresh
the poller exists to perform).

No startup-staleness gate (unlike pr_watcher), because warming the cache
on tick 1 produces no user-visible side effect — there's no review being
dispatched, no notification being sent. Worst case after a long downtime:
the first tick repopulates from-scratch, exactly as if every user had just
opened the page.
"""

import asyncio
import logging
from typing import Awaitable, Callable

from app.models.credential import CredentialModel
from app.services import feed_fetchers, signal_feed_cache

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 120

# Only these services produce a Signal Feed payload. A user can have other
# credentials (e.g. discord) — those rows are skipped, not errored.
FEED_FETCHERS: dict[str, Callable[[str], Awaitable[dict]]] = {
    "slack":  feed_fetchers.slack_messages,
    "gmail":  feed_fetchers.gmail_messages,
    "github": feed_fetchers.github_activity,
}


class FeedPoller:
    def __init__(self, poll_interval: float = POLL_INTERVAL_SECONDS):
        self._poll_interval = poll_interval

    async def run_forever(self) -> None:
        """Sleep-tick-sleep until cancelled by the lifespan shutdown."""
        logger.info("feed_poller: started, polling every %ss", self._poll_interval)
        try:
            while True:
                try:
                    await self.tick()
                except Exception:  # noqa: BLE001 — never let the loop die
                    logger.exception("feed_poller: tick crashed; continuing")
                await asyncio.sleep(self._poll_interval)
        except asyncio.CancelledError:
            logger.info("feed_poller: shutting down")
            raise

    async def tick(self) -> None:
        """One pass over every (user, feed-service) credential row.

        Error isolation is at the (user, service) granularity: a Slack
        outage for one user must not skip Gmail for the same user, nor
        any other user's feeds.
        """
        rows = CredentialModel.list_active_services()
        if not rows:
            return

        refreshed = 0
        for row in rows:
            user_id = row["user_id"]
            service = row["service"]
            fetcher = FEED_FETCHERS.get(service)
            if fetcher is None:
                continue  # discord et al. — no feed surface
            try:
                payload = await fetcher(user_id)
            except Exception:  # noqa: BLE001 — isolate per (user, service)
                logger.exception(
                    "feed_poller: fetch failed user=%s service=%s",
                    user_id, service,
                )
                continue

            # Only cache successful fetches. A connected=False response
            # means the credential vanished mid-tick (raced with disconnect)
            # or the upstream rejected the token — don't paper over it.
            if payload.get("connected"):
                signal_feed_cache.set(user_id, service, payload)
                refreshed += 1

        if refreshed:
            logger.info("feed_poller: refreshed %s cache entries", refreshed)
