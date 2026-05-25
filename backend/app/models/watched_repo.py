"""Repos a Code Review Engineer is subscribed to.

The platform's pr_watcher iterates rows in this table on a 120s cadence
and dispatches review tasks for unreviewed open PRs. Cross-agent uniqueness
on (user_id, owner, repo) means two agents under the same user cannot watch
the same repo — this prevents the double-review problem (#28).
"""

from app.database import get_supabase

TABLE = "watched_repos"


class WatchedRepoExists(Exception):
    """Raised when a (user_id, owner, repo) row already exists.

    The unique constraint at the DB level is the real guard; this exception
    lets the router translate the violation into a 409 with a clean message.
    """


class WatchedRepoModel:
    @staticmethod
    def create(agent_id: str, user_id: str, owner: str, repo: str) -> dict:
        """Subscribe an agent to a repo.

        Raises WatchedRepoExists if another agent under the same user already
        watches this (owner, repo). Surfaced as a 409 in the router.
        """
        data = {
            "agent_id": agent_id,
            "user_id": user_id,
            "owner": owner,
            "repo": repo,
        }
        try:
            result = get_supabase().table(TABLE).insert(data).execute()
        except Exception as exc:  # noqa: BLE001 — supabase wraps PG errors
            # The unique constraint violation comes back as a postgres error
            # with code 23505. The supabase client surfaces it as a generic
            # exception; check the message for the conflict marker.
            msg = str(exc)
            if "duplicate key" in msg or "23505" in msg or "watched_repos" in msg.lower():
                raise WatchedRepoExists(
                    f"This repo is already watched by another agent under user {user_id}"
                ) from exc
            raise
        return result.data[0]

    @staticmethod
    def list_by_agent(agent_id: str) -> list[dict]:
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data

    @staticmethod
    def list_all() -> list[dict]:
        """Return every watched_repos row across every agent.

        Used by the pr_watcher tick — one query per cycle, in-process group
        by agent_id. The platform's hackathon scale is well within what a
        full-table scan can handle; revisit if we ever cross ~10k rows.
        """
        result = get_supabase().table(TABLE).select("*").execute()
        return result.data

    @staticmethod
    def get_by_id(watched_id: str) -> dict | None:
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("id", watched_id)
            .execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def delete(watched_id: str) -> bool:
        result = (
            get_supabase()
            .table(TABLE)
            .delete()
            .eq("id", watched_id)
            .execute()
        )
        return len(result.data) > 0

    @staticmethod
    def delete_by_agent(agent_id: str) -> None:
        """Remove every watched_repos row for an agent.

        Called by Orchestrator.stop_agent so an offboarded agent stops
        occupying its (user, owner, repo) slot — otherwise the cross-agent
        uniqueness from #28 would block re-hiring against the same repo
        (#31). Fire-and-forget: we don't care about the row count.
        """
        (
            get_supabase()
            .table(TABLE)
            .delete()
            .eq("agent_id", agent_id)
            .execute()
        )
