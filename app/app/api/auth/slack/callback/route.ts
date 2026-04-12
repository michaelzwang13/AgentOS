import { NextRequest, NextResponse } from "next/server";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/slack/callback`
  : "http://localhost:3000/api/auth/slack/callback";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/agent/slack?error=${error || "missing_code"}`, req.url)
    );
  }

  // Exchange code for access token
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    client_secret: SLACK_CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
  });

  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await tokenRes.json();

  if (!data.ok) {
    return NextResponse.redirect(
      new URL(`/agent/slack?error=${data.error}`, req.url)
    );
  }

  // User token is nested under authed_user for user scopes
  const userToken = data.authed_user?.access_token;

  if (!userToken) {
    return NextResponse.redirect(
      new URL("/agent/slack?error=no_user_token", req.url)
    );
  }

  // Store token in httpOnly cookie (no DB needed for now)
  const response = NextResponse.redirect(
    new URL("/agent/slack?connected=true", req.url)
  );

  response.cookies.set("slack_token", userToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
