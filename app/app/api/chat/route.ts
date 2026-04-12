import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPTS: Record<string, string> = {
  slack: `You are a Slack Agent. Summarize discussions, extract action items, flag blockers. Be concise and action-oriented. Never just describe — always recommend next steps.`,
  gmail: `You are an Inbox Agent. Summarize emails, detect urgency, suggest replies and actions. Be concise. Always recommend what to do next.`,
  github: `You are a GitHub Agent. Track PRs, issues, and code review status. Flag blockers, suggest review priorities. Be direct.`,
  global: `You are an AI assistant with visibility across Slack, Gmail, and GitHub. Cross-reference information across tools, identify patterns and blockers, and suggest concrete next steps.`,
};

export async function POST(req: NextRequest) {
  const { messages, agentId, context } = await req.json();

  const system = context
    ? `${SYSTEM_PROMPTS[agentId] || SYSTEM_PROMPTS.global}\n\nCurrent data context:\n${context}`
    : SYSTEM_PROMPTS[agentId] || SYSTEM_PROMPTS.global;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages,
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
