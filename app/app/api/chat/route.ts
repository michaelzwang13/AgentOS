import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { agentSystemPrompts } from "@/lib/mock-data";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { messages, agentId } = await req.json();

  const systemPrompt =
    agentSystemPrompts[agentId] ||
    `You are an AI assistant with access to Gmail, Slack, and GitHub data. Be concise, cross-reference information across tools, and always suggest actions.`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
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
