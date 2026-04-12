import { NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;

const SCOPES = ["notifications", "read:user", "repo"].join(" ");

export async function GET() {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", `${BASE_URL}/api/auth/github/callback`);
  url.searchParams.set("scope", SCOPES);
  return NextResponse.redirect(url.toString());
}
