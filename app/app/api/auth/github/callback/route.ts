import { NextRequest, NextResponse } from "next/server";
import { isCrossOrigin, resolveNext, withQuery, withQueryAndHash } from "@/lib/oauth-next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const nextUrl = resolveNext(req.nextUrl.searchParams.get("state"));

  if (error || !code) {
    return NextResponse.redirect(
      withQuery(nextUrl, { github_error: error || "missing_code" }, BASE_URL)
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
      withQuery(nextUrl, { github_error: data.error || "token_failed" }, BASE_URL)
    );
  }

  // Cross-origin: ship token via URL fragment for the design-ui.
  if (isCrossOrigin(nextUrl, BASE_URL)) {
    return NextResponse.redirect(
      withQueryAndHash(
        nextUrl,
        { github_connected: "true" },
        { github_access: data.access_token },
        BASE_URL
      )
    );
  }

  const response = NextResponse.redirect(
    withQuery(nextUrl, { github_connected: "true" }, BASE_URL)
  );
  response.cookies.set("github_token", data.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
