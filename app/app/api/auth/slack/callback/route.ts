import { NextRequest, NextResponse } from "next/server";
import { storeCredential } from "@/lib/backend-client";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const REDIRECT_URI = `${BASE_URL}/api/auth/slack/callback`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      `${BASE_URL}/agents?error=${error || "missing_code"}`
    );
  }

  // Exchange code for token
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
      `${BASE_URL}/agents?error=${data.error}`
    );
  }

  const userToken = data.authed_user?.access_token;
  if (!userToken) {
    return NextResponse.redirect(
      `${BASE_URL}/agents?error=no_user_token`
    );
  }

  const scopes = (data.authed_user?.scope || "").split(",").filter(Boolean);

  // Store in backend credential vault (source of truth)
  try {
    const backendRes = await storeCredential("slack", userToken, scopes);
    if (!backendRes.ok) {
      console.error("Backend credential store failed:", await backendRes.text());
    }
  } catch (err) {
    console.error("Could not reach backend, falling back to cookie:", err);
    // Fallback: store in cookie so the app still works without the backend
    const fallback = NextResponse.redirect(
      `${BASE_URL}/agents?connected=true&mode=local`
    );
    fallback.cookies.set("slack_token", userToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return fallback;
  }

  return NextResponse.redirect(`${BASE_URL}/agents?connected=true`);
}
