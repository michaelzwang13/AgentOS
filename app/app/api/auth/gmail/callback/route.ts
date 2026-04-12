import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${BASE_URL}/api/auth/gmail/callback`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${BASE_URL}/agents?gmail_error=${error || "missing_code"}`);
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
    return NextResponse.redirect(`${BASE_URL}/agents?gmail_error=${data.error || "token_failed"}`);
  }

  const response = NextResponse.redirect(`${BASE_URL}/agents?gmail_connected=true`);
  response.cookies.set("gmail_token", data.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: data.expires_in || 3600,
    path: "/",
  });
  // Store refresh token separately (long-lived)
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
