import { NextRequest, NextResponse } from "next/server";
import { storeCredential } from "@/lib/backend-client";
import { isCrossOrigin, resolveNext, withQuery, withQueryAndHash } from "@/lib/oauth-next";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const REDIRECT_URI = `${BASE_URL}/api/auth/slack/callback`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  // resolveNext falls back to /test if `state` is something else (e.g. the backend-routed
  // path uses state to carry the api_key, which is not a URL).
  const nextUrl = resolveNext(req.nextUrl.searchParams.get("state"));

  if (error || !code) {
    return NextResponse.redirect(
      withQuery(nextUrl, { error: error || "missing_code" }, BASE_URL)
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
    return NextResponse.redirect(withQuery(nextUrl, { error: data.error }, BASE_URL));
  }

  const userToken = data.authed_user?.access_token;
  if (!userToken) {
    return NextResponse.redirect(
      withQuery(nextUrl, { error: "no_user_token" }, BASE_URL)
    );
  }

  const scopes = (data.authed_user?.scope || "").split(",").filter(Boolean);

  // Store in backend credential vault (source of truth) — best effort.
  try {
    const backendRes = await storeCredential("slack", userToken, scopes);
    if (!backendRes.ok) {
      console.error("Backend credential store failed:", await backendRes.text());
    }
  } catch (err) {
    console.error("Could not reach backend, falling back to cookie/hash:", err);
  }

  // Cross-origin: ship token via URL fragment for the design-ui.
  if (isCrossOrigin(nextUrl, BASE_URL)) {
    return NextResponse.redirect(
      withQueryAndHash(
        nextUrl,
        { connected: "true" },
        { slack_access: userToken },
        BASE_URL
      )
    );
  }

  const response = NextResponse.redirect(
    withQuery(nextUrl, { connected: "true" }, BASE_URL)
  );
  response.cookies.set("slack_token", userToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
