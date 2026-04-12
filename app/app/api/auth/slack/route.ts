import { NextResponse } from "next/server";
import { getSlackOAuthUrl } from "@/lib/backend-client";

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

export async function GET() {
  // If backend is configured, route through it (tokens stored in encrypted vault)
  if (BACKEND_API_KEY) {
    return NextResponse.redirect(getSlackOAuthUrl());
  }

  // No backend — do OAuth directly in the frontend (cookie fallback)
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", SLACK_CLIENT_ID);
  url.searchParams.set("user_scope", SCOPES);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  return NextResponse.redirect(url.toString());
}
