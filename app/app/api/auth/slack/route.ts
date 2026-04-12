import { NextRequest, NextResponse } from "next/server";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/slack/callback`
  : "http://localhost:3000/api/auth/slack/callback";

const SCOPES = [
  "channels:history",
  "channels:read",
  "users:read",
  "reactions:read",
].join(",");

export async function GET(_req: NextRequest) {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", SLACK_CLIENT_ID);
  url.searchParams.set("user_scope", SCOPES);
  url.searchParams.set("redirect_uri", REDIRECT_URI);

  return NextResponse.redirect(url.toString());
}
