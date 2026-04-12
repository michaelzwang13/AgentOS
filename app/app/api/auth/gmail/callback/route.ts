import { NextRequest, NextResponse } from "next/server";
import { isCrossOrigin, resolveNext, withQuery, withQueryAndHash } from "@/lib/oauth-next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${BASE_URL}/api/auth/gmail/callback`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const nextUrl = resolveNext(req.nextUrl.searchParams.get("state"));

  if (error || !code) {
    return NextResponse.redirect(
      withQuery(nextUrl, { gmail_error: error || "missing_code" }, BASE_URL)
    );
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
  });

  const data = await tokenRes.json();

  if (data.error || !data.access_token) {
    return NextResponse.redirect(
      withQuery(nextUrl, { gmail_error: data.error || "token_failed" }, BASE_URL)
    );
  }

  // Cross-origin: ship tokens via URL fragment so the design-ui can stash them in
  // localStorage. Fragments aren't sent to servers or recorded in Referer.
  if (isCrossOrigin(nextUrl, BASE_URL)) {
    const hash: Record<string, string> = { gmail_access: data.access_token };
    if (data.refresh_token) hash.gmail_refresh = data.refresh_token;
    return NextResponse.redirect(
      withQueryAndHash(nextUrl, { gmail_connected: "true" }, hash, BASE_URL)
    );
  }

  // Same-origin: keep the existing httpOnly cookie flow.
  const response = NextResponse.redirect(
    withQuery(nextUrl, { gmail_connected: "true" }, BASE_URL)
  );
  response.cookies.set("gmail_token", data.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: data.expires_in || 3600,
    path: "/",
  });
  if (data.refresh_token) {
    response.cookies.set("gmail_refresh_token", data.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}
