import Anthropic from "@anthropic-ai/sdk";
import { buildDecisionPrompt } from "./prompts";
import type { LinkupDecision } from "@/types";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function decideLinkup(
  slideText: string,
  highlightedText: string,
  userRequest: string
): Promise<LinkupDecision> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: buildDecisionPrompt(slideText, highlightedText, userRequest),
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from the response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      needs_linkup: false,
      reason: "Could not parse decision",
      search_queries: [],
      goal_for_linkup: "",
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as LinkupDecision;
  } catch {
    return {
      needs_linkup: false,
      reason: "Parse error",
      search_queries: [],
      goal_for_linkup: "",
    };
  }
}
