"""Gateway service — proxies agent requests to external services using stored credentials."""

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

        # Placeholder: integrate with Gmail API using the decrypted token
        # In production, use google-api-python-client with the OAuth token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages:send",
                headers={"Authorization": f"Bearer {cred['token']}"},
                json={
                    "raw": ""  # Base64-encoded email — build with email.mime
                },
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
