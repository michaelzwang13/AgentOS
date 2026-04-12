from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.services.gateway import GatewayService

router = APIRouter(prefix="/gateway", tags=["gateway"])


# --- Request schemas ---

class EmailRequest(BaseModel):
    to: str
    subject: str
    body: str


class SlackRequest(BaseModel):
    channel: str
    text: str


class DiscordRequest(BaseModel):
    channel_id: str
    content: str


# --- Endpoints ---

@router.post("/email/send")
async def send_email(
    payload: EmailRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.send_email(
            user["id"], payload.to, payload.subject, payload.body
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/slack/message")
async def send_slack_message(
    payload: SlackRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.send_slack_message(
            user["id"], payload.channel, payload.text
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/discord/message")
async def send_discord_message(
    payload: DiscordRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return await GatewayService.send_discord_message(
            user["id"], payload.channel_id, payload.content
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
