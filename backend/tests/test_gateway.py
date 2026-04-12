"""Tests for the /gateway router."""

import base64
from unittest.mock import MagicMock, patch, AsyncMock


class TestSendEmail:
    def test_send_email_success(self, authed_client):
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs, patch(
            "app.services.gateway.httpx.AsyncClient"
        ) as mock_httpx:
            mock_cs.get.return_value = {"service": "gmail", "token": "tok", "scopes": []}
            mock_resp = MagicMock(status_code=200)
            mock_post = AsyncMock(return_value=mock_resp)
            mock_httpx.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=mock_post)
            )
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = client.post(
                "/gateway/email/send",
                json={"to": "a@b.com", "subject": "Hi", "body": "Hello"},
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "sent"

    def test_send_email_builds_mime_body(self, authed_client):
        """Verify the email is built as proper Base64-encoded MIME."""
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs, patch(
            "app.services.gateway.httpx.AsyncClient"
        ) as mock_httpx:
            mock_cs.get.return_value = {"service": "gmail", "token": "tok", "scopes": []}
            mock_resp = MagicMock(status_code=200)
            mock_post = AsyncMock(return_value=mock_resp)
            mock_httpx.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=mock_post)
            )
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

            client.post(
                "/gateway/email/send",
                json={"to": "bob@company.com", "subject": "Welcome", "body": "Hello Bob"},
            )

            # Check the POST was called with a valid Base64 raw field
            call_kwargs = mock_post.call_args
            raw = call_kwargs.kwargs.get("json", call_kwargs[1].get("json", {}))["raw"]
            decoded = base64.urlsafe_b64decode(raw).decode()
            assert "bob@company.com" in decoded
            assert "Welcome" in decoded
            assert "Hello Bob" in decoded

    def test_send_email_no_credential(self, authed_client):
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs:
            mock_cs.get.return_value = None
            resp = client.post(
                "/gateway/email/send",
                json={"to": "a@b.com", "subject": "Hi", "body": "Hello"},
            )
            assert resp.status_code == 400


class TestSendSlack:
    def test_send_slack_no_credential(self, authed_client):
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs:
            mock_cs.get.return_value = None
            resp = client.post(
                "/gateway/slack/message",
                json={"channel": "#general", "text": "hello"},
            )
            assert resp.status_code == 400


class TestSendDiscord:
    def test_send_discord_no_credential(self, authed_client):
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs:
            mock_cs.get.return_value = None
            resp = client.post(
                "/gateway/discord/message",
                json={"channel_id": "123", "content": "hello"},
            )
            assert resp.status_code == 400


class TestGitHub:
    def test_list_pull_requests(self, authed_client):
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs, patch(
            "app.services.gateway.httpx.AsyncClient"
        ) as mock_httpx:
            mock_cs.get.return_value = {"service": "github", "token": "ghp_test", "scopes": []}
            mock_resp = MagicMock(status_code=200)
            mock_resp.json.return_value = [{"number": 1, "title": "Fix bug"}]
            mock_httpx.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(request=AsyncMock(return_value=mock_resp))
            )
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = client.get("/gateway/github/pulls/owner/repo")
            assert resp.status_code == 200

    def test_create_pr_review(self, authed_client):
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs, patch(
            "app.services.gateway.httpx.AsyncClient"
        ) as mock_httpx:
            mock_cs.get.return_value = {"service": "github", "token": "ghp_test", "scopes": []}
            mock_resp = MagicMock(status_code=200)
            mock_resp.json.return_value = {"id": 1}
            mock_httpx.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(request=AsyncMock(return_value=mock_resp))
            )
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = client.post(
                "/gateway/github/review",
                json={
                    "owner": "acme",
                    "repo": "api",
                    "pull_number": 42,
                    "body": "LGTM",
                    "event": "APPROVE",
                },
            )
            assert resp.status_code == 200

    def test_github_no_credential(self, authed_client):
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs:
            mock_cs.get.return_value = None
            resp = client.get("/gateway/github/pulls/owner/repo")
            assert resp.status_code == 400
