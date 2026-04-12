"""Streaming chat endpoint — proxies Claude responses to the frontend."""

import anthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.config import get_settings

router = APIRouter(tags=["chat"])

SYSTEM_PROMPTS = {
    "slack": "You are a Slack Agent. Summarize discussions, extract action items, flag blockers. Be concise and action-oriented. Always recommend next steps.",
    "gmail": "You are an Inbox Agent. Summarize emails, detect urgency, suggest replies and actions. Be concise. Always recommend what to do next.",
    "github": "You are a GitHub Agent. Track PRs, issues, and code review status. Flag blockers, suggest review priorities. Be direct.",
    "global": "You are an AI assistant with visibility across Slack, Gmail, and GitHub. Cross-reference information across tools, identify patterns and blockers, and suggest concrete next steps.",
}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    agentId: str = "global"
    context: str = ""


@router.post("/chat")
async def chat(payload: ChatRequest):
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")

    system = SYSTEM_PROMPTS.get(payload.agentId, SYSTEM_PROMPTS["global"])
    if payload.context:
        system = f"{system}\n\nCurrent data context:\n{payload.context}"

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def generate():
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system,
            messages=[{"role": m.role, "content": m.content} for m in payload.messages],
        ) as stream:
            for text in stream.text_stream:
                yield text

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
