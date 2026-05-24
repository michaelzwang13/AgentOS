"""Dedup index for PRs an agent has already reviewed.

Phase C's poll loop reads from this table to skip PRs it has already
dispatched a review for, so the watcher's natural 120s tick doesn't
re-review the same PR every cycle. Written server-side by the gateway
on a successful POST /github/review — never by the watcher, never by
a skill. Insert-only; rows persist as the audit trail of what was
reviewed (read: "this is the agent's PR history").
"""

from app.database import get_supabase

TABLE = "reviewed_prs"


class ReviewedPRModel:
    @staticmethod
    def exists(agent_id: str, owner: str, repo: str, pr_number: int) -> bool:
        result = (
            get_supabase()
            .table(TABLE)
            .select("id")
            .eq("agent_id", agent_id)
            .eq("owner", owner)
            .eq("repo", repo)
            .eq("pr_number", pr_number)
            .execute()
        )
        return bool(result.data)

    @staticmethod
    def record(agent_id: str, owner: str, repo: str, pr_number: int) -> dict:
        """Insert a row marking a PR as reviewed for this agent.

        The (agent_id, owner, repo, pr_number) unique constraint makes
        re-inserts idempotent at the DB level; this method assumes the
        caller has not already inserted the same row.
        """
        data = {
            "agent_id": agent_id,
            "owner": owner,
            "repo": repo,
            "pr_number": pr_number,
        }
        result = get_supabase().table(TABLE).insert(data).execute()
        return result.data[0]

    @staticmethod
    def list_by_agent(agent_id: str, limit: int = 100) -> list[dict]:
        result = (
            get_supabase()
            .table(TABLE)
            .select("*")
            .eq("agent_id", agent_id)
            .order("reviewed_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data
