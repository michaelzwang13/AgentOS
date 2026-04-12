import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      `${BASE_URL}/test?github_error=${error || "missing_code"}`
    );
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: `${BASE_URL}/api/auth/github/callback`,
    }),
  });

  const data = await tokenRes.json();

  if (data.error || !data.access_token) {
    return NextResponse.redirect(
      `${BASE_URL}/test?github_error=${data.error || "token_failed"}`
    );
  }

  const response = NextResponse.redirect(`${BASE_URL}/test?github_connected=true`);
  response.cookies.set("github_token", data.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 60 * 60 * 24 * 30, // GitHub tokens don't expire unless revoked
    path: "/",
  });
  return response;
}
