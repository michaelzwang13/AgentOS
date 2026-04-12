import { decideLinkup, anthropic } from "@/lib/claude";
import { searchLinkupMultiple } from "@/lib/linkup";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts";
import type { TeachRequest } from "@/types";

export async function POST(req: Request) {
  const body: TeachRequest = await req.json();
  const {
    slideText,
    slideTitle,
    slideNumber,
    highlightedText,
    userRequest,
    mode,
    nearbyContext,
  } = body;

  // Step 1: Claude decides if Linkup is needed
  const decision = await decideLinkup(slideText, highlightedText, userRequest);

  // Step 2: Fetch Linkup results if needed
  const linkupResults =
    decision.needs_linkup && decision.search_queries.length > 0
      ? await searchLinkupMultiple(decision.search_queries)
      : [];

  // Step 3: Stream Claude's teaching response
  const userPrompt = buildUserPrompt({
    mode,
    slideNumber,
    slideTitle,
    slideText,
    nearbyContext,
    highlightedText,
    userRequest,
    linkupResults,
  });

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      // First send metadata (linkup decision + sources) as a JSON header line
      const meta = {
        needs_linkup: decision.needs_linkup,
        linkupResults,
      };
      controller.enqueue(
        new TextEncoder().encode(`__META__${JSON.stringify(meta)}\n`)
      );

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
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
