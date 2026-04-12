"""Gateway service — proxies agent requests to external services using stored credentials."""

import base64
from email.mime.text import MIMEText

import httpx
from app.services.credential_store import CredentialStore


class GatewayService:
    @staticmethod
    async def send_email(
        user_id: str, to: str, subject: str, body: str
    ) -> dict:
        cred = CredentialStore.get(user_id, "gmail")
        if not cred:
            raise ValueError("No Gmail credential stored for this user")

        msg = MIMEText(body)
        msg["to"] = to
        msg["subject"] = subject
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={"Authorization": f"Bearer {cred['token']}"},
                json={"raw": raw},
            )
        return {"status": "sent", "gmail_response": response.status_code}

    @staticmethod
    async def send_slack_message(
        user_id: str, channel: str, text: str
    ) -> dict:
        cred = CredentialStore.get(user_id, "slack")
        if not cred:
            raise ValueError("No Slack credential stored for this user")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {cred['token']}"},
                json={"channel": channel, "text": text},
            )
        return response.json()

    @staticmethod
    async def github_request(
        user_id: str, method: str, endpoint: str, json_body: dict | None = None
    ) -> dict:
        """Generic GitHub API proxy. Endpoint is relative, e.g. /repos/owner/repo/pulls."""
        cred = CredentialStore.get(user_id, "github")
        if not cred:
            raise ValueError("No GitHub credential stored for this user")

        url = f"https://api.github.com{endpoint}"
        headers = {
            "Authorization": f"Bearer {cred['token']}",
            "Accept": "application/vnd.github+json",
        }

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method, url, headers=headers, json=json_body, timeout=30
            )
        return {"status": response.status_code, "data": response.json()}

    @staticmethod
    async def create_pr_review_comment(
        user_id: str, owner: str, repo: str, pull_number: int, body: str, path: str, line: int
    ) -> dict:
        """Post a review comment on a PR."""
        return await GatewayService.github_request(
            user_id, "POST",
            f"/repos/{owner}/{repo}/pulls/{pull_number}/comments",
            {"body": body, "path": path, "line": line, "side": "RIGHT"},
        )

    @staticmethod
    async def create_pr_review(
        user_id: str, owner: str, repo: str, pull_number: int, body: str, event: str = "COMMENT"
    ) -> dict:
        """Submit a PR review (COMMENT, APPROVE, or REQUEST_CHANGES)."""
        return await GatewayService.github_request(
            user_id, "POST",
            f"/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
            {"body": body, "event": event},
        )

    @staticmethod
    async def get_pull_request(
        user_id: str, owner: str, repo: str, pull_number: int
    ) -> dict:
        """Fetch a single pull request."""
        return await GatewayService.github_request(
            user_id, "GET",
            f"/repos/{owner}/{repo}/pulls/{pull_number}",
        )

    @staticmethod
    async def list_pull_requests(
        user_id: str, owner: str, repo: str, state: str = "open"
    ) -> dict:
        """List pull requests for a repo."""
        return await GatewayService.github_request(
            user_id, "GET",
            f"/repos/{owner}/{repo}/pulls?state={state}",
        )

    @staticmethod
    async def send_discord_message(
        user_id: str, channel_id: str, content: str
    ) -> dict:
        cred = CredentialStore.get(user_id, "discord")
        if not cred:
            raise ValueError("No Discord credential stored for this user")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://discord.com/api/v10/channels/{channel_id}/messages",
                headers={"Authorization": f"Bot {cred['token']}"},
                json={"content": content},
            )
        return response.json()
