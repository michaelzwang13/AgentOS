import { NextRequest, NextResponse } from "next/server";
import { resolveNext } from "@/lib/oauth-next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(req: NextRequest) {
  const next = resolveNext(req.nextUrl.searchParams.get("next"));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", `${BASE_URL}/api/auth/gmail/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", next);
  return NextResponse.redirect(url.toString());
}
