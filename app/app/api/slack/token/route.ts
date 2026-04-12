import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token } = await req.json();

  if (!token || !token.startsWith("xoxp-")) {
    return NextResponse.json({ error: "Invalid token — must be a User OAuth Token (xoxp-...)" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("slack_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
