import { NextRequest, NextResponse } from "next/server";
import { getSlackOAuthUrl } from "@/lib/backend-client";
import { resolveNext } from "@/lib/oauth-next";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/slack/callback`;

const SCOPES = [
  "channels:history",
  "channels:read",
  "groups:history",
  "groups:read",
  "users:read",
  "reactions:read",
].join(",");

export async function GET(req: NextRequest) {
  const next = resolveNext(req.nextUrl.searchParams.get("next"));

  // Backend-routed Slack path: backend owns `state` (encodes api_key), so we can't
  // round-trip `next` through it. Fall through to the direct path when possible.
  if (BACKEND_API_KEY) {
    return NextResponse.redirect(getSlackOAuthUrl());
  }

  // Direct path — encode the return URL in `state` so the callback can recover it.
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", SLACK_CLIENT_ID);
  url.searchParams.set("user_scope", SCOPES);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("state", next);
  return NextResponse.redirect(url.toString());
}
