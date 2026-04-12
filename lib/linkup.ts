import { LinkupClient } from "linkup-sdk";
import type { LinkupResult } from "@/types";

const client = new LinkupClient({ apiKey: process.env.LINKUP_API_KEY! });

export async function searchLinkup(query: string): Promise<LinkupResult> {
  const result = await client.search({
    query,
    depth: "standard",
    outputType: "sourcedAnswer",
  });

  const sources = (result.sources ?? []).map((s: { name: string; url: string; snippet?: string }) => ({
    name: s.name ?? "Source",
    url: s.url ?? "",
    snippet: s.snippet ?? "",
  }));

  return {
    query,
    answer: typeof result.answer === "string" ? result.answer : JSON.stringify(result.answer),
    sources,
  };
}

export async function searchLinkupMultiple(queries: string[]): Promise<LinkupResult[]> {
  const results = await Promise.all(queries.slice(0, 2).map(searchLinkup));
  return results;
}
