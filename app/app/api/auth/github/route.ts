import { NextRequest, NextResponse } from "next/server";
import { resolveNext } from "@/lib/oauth-next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;

const SCOPES = ["notifications", "read:user", "repo"].join(" ");

export async function GET(req: NextRequest) {
  const next = resolveNext(req.nextUrl.searchParams.get("next"));
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", `${BASE_URL}/api/auth/github/callback`);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", next);
  return NextResponse.redirect(url.toString());
}
