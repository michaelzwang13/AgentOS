"""Tests for the /agents/{id}/watched-repos router and WatchedRepoModel."""

from unittest.mock import patch

from tests.conftest import _make_agent


def _make_watched(**overrides):
    base = {
        "id": "wr-001",
        "agent_id": "agent-001",
        "user_id": "user-001",
        "owner": "octocat",
        "repo": "hello-world",
        "created_at": "2025-01-01T00:00:00+00:00",
    }
    base.update(overrides)
    return base


class TestSubscribeRepo:
    def test_subscribe_repo_success(self, authed_client):
        client, user, fake_sb = authed_client
        agent = _make_agent(role="code-review-engineer")
        fake_sb.get_table("agents").set_select_result([agent])

        with patch("app.routers.watched_repos.WatchedRepoModel.create") as mock_create:
            mock_create.return_value = _make_watched()
            resp = client.post(
                f"/agents/{agent['id']}/watched-repos",
                json={"owner": "octocat", "repo": "hello-world"},
            )

        assert resp.status_code == 201
        assert resp.json()["owner"] == "octocat"

    def test_subscribe_repo_returns_409_on_cross_agent_conflict(self, authed_client):
        """Two agents under the same user cannot watch the same repo (#28)."""
        from app.models.watched_repo import WatchedRepoExists

        client, user, fake_sb = authed_client
        agent = _make_agent(role="code-review-engineer")
        fake_sb.get_table("agents").set_select_result([agent])

        with patch("app.routers.watched_repos.WatchedRepoModel.create") as mock_create:
            mock_create.side_effect = WatchedRepoExists("already watched")
            resp = client.post(
                f"/agents/{agent['id']}/watched-repos",
                json={"owner": "octocat", "repo": "hello-world"},
            )

        assert resp.status_code == 409
        assert "already watched" in resp.json()["detail"]

    def test_subscribe_repo_404_when_agent_not_owned(self, authed_client):
        client, user, fake_sb = authed_client
        # Agent owned by someone else.
        other_agent = _make_agent(user_id="user-other")
        fake_sb.get_table("agents").set_select_result([other_agent])

        resp = client.post(
            f"/agents/{other_agent['id']}/watched-repos",
            json={"owner": "octocat", "repo": "hello-world"},
        )
        assert resp.status_code == 404

    def test_subscribe_repo_requires_auth(self, client):
        resp = client.post(
            "/agents/agent-001/watched-repos",
            json={"owner": "octocat", "repo": "hello-world"},
        )
        assert resp.status_code == 401


class TestListWatchedRepos:
    def test_list_success(self, authed_client):
        client, user, fake_sb = authed_client
        agent = _make_agent(role="code-review-engineer")
        fake_sb.get_table("agents").set_select_result([agent])

        with patch("app.routers.watched_repos.WatchedRepoModel.list_by_agent") as mock_list:
            mock_list.return_value = [
                _make_watched(),
                _make_watched(id="wr-002", repo="other"),
            ]
            resp = client.get(f"/agents/{agent['id']}/watched-repos")

        assert resp.status_code == 200
        assert len(resp.json()) == 2


class TestUnsubscribeRepo:
    def test_unsubscribe_success(self, authed_client):
        client, user, fake_sb = authed_client
        agent = _make_agent(role="code-review-engineer")
        fake_sb.get_table("agents").set_select_result([agent])
        watched = _make_watched()

        with patch("app.routers.watched_repos.WatchedRepoModel.get_by_id") as mock_get, \
             patch("app.routers.watched_repos.WatchedRepoModel.delete") as mock_del:
            mock_get.return_value = watched
            mock_del.return_value = True
            resp = client.delete(
                f"/agents/{agent['id']}/watched-repos/{watched['id']}"
            )

        assert resp.status_code == 204
        mock_del.assert_called_once_with(watched["id"])

    def test_unsubscribe_404_when_row_belongs_to_other_agent(self, authed_client):
        """The watched_id must belong to this agent, not just exist."""
        client, user, fake_sb = authed_client
        agent = _make_agent(role="code-review-engineer")
        fake_sb.get_table("agents").set_select_result([agent])
        # Row from a different agent.
        watched = _make_watched(agent_id="agent-other")

        with patch("app.routers.watched_repos.WatchedRepoModel.get_by_id") as mock_get:
            mock_get.return_value = watched
            resp = client.delete(
                f"/agents/{agent['id']}/watched-repos/{watched['id']}"
            )

        assert resp.status_code == 404


class TestWatchedRepoModelConflictTranslation:
    """The model translates the PG unique-constraint violation into
    WatchedRepoExists so the router can return 409."""

    def test_duplicate_key_becomes_exists(self, fake_supabase):
        from app.models.watched_repo import WatchedRepoExists, WatchedRepoModel

        table = fake_supabase.get_table("watched_repos")
        table.mock.insert.return_value.execute.side_effect = Exception(
            'duplicate key value violates unique constraint "watched_repos_user_id_owner_repo_key"'
        )

        try:
            WatchedRepoModel.create("agent-001", "user-001", "octocat", "hello")
        except WatchedRepoExists:
            return
        raise AssertionError("expected WatchedRepoExists")

    def test_other_error_propagates(self, fake_supabase):
        from app.models.watched_repo import WatchedRepoModel

        table = fake_supabase.get_table("watched_repos")
        table.mock.insert.return_value.execute.side_effect = RuntimeError("connection refused")

        try:
            WatchedRepoModel.create("agent-001", "user-001", "octocat", "hello")
        except RuntimeError as exc:
            assert "connection refused" in str(exc)
            return
        raise AssertionError("expected RuntimeError to propagate")
