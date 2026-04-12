"""Tests for the /gateway router."""

from unittest.mock import MagicMock, patch, AsyncMock


class TestSendEmail:
    def test_send_email_success(self, authed_client):
        client, user, fake_sb = authed_client

        with patch("app.services.gateway.CredentialStore") as mock_cs, patch(
            "app.services.gateway.httpx.AsyncClient"
        ) as mock_httpx:
            mock_cs.get.return_value = {"service": "gmail", "token": "tok", "scopes": []}
            mock_resp = MagicMock(status_code=200)
            mock_httpx.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=AsyncMock(return_value=mock_resp))
            )
            mock_httpx.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = client.post(
                "/gateway/email/send",
                json={"to": "a@b.com", "subject": "Hi", "body": "Hello"},
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "sent"

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
