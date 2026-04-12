import { NextRequest, NextResponse } from "next/server";

interface GmailMessage {
  id: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string } }[];
  };
  snippet: string;
  labelIds: string[];
  internalDate: string;
}

function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeBody(data?: string): string {
  if (!data) return "";
  try {
    return atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}

function formatDate(internalDate: string): string {
  const date = new Date(parseInt(internalDate));
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 1) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffHours < 24) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = await res.json();
  return data.access_token || null;
}

export async function GET(req: NextRequest) {
  let token = req.cookies.get("gmail_token")?.value;
  const refreshToken = req.cookies.get("gmail_refresh_token")?.value;

  if (!token && !refreshToken) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  // Try to refresh if no access token
  if (!token && refreshToken) {
    token = (await refreshAccessToken(refreshToken)) || undefined;
    if (!token) {
      return NextResponse.json({ connected: false, emails: [] });
    }
  }

  // Fetch list of recent messages
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listRes.ok) {
    // Token might be expired — try refresh
    if (listRes.status === 401 && refreshToken) {
      token = (await refreshAccessToken(refreshToken)) || undefined;
      if (!token) return NextResponse.json({ connected: false, emails: [] });
    } else {
      return NextResponse.json({ connected: false, error: "gmail_api_error" });
    }
  }

  const listData = await listRes.json();
  const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id);

  // Fetch each message in parallel (up to 10)
  const messages = await Promise.all(
    messageIds.map(async (id) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return msgRes.ok ? (msgRes.json() as Promise<GmailMessage>) : null;
    })
  );

  const emails = messages
    .filter((m): m is GmailMessage => m !== null)
    .map((msg) => {
      const headers = msg.payload.headers;
      const from = getHeader(headers, "from");
      const fromName = from.includes("<") ? from.split("<")[0].trim().replace(/"/g, "") : from;
      const subject = getHeader(headers, "subject") || "(no subject)";

      // Get plain text body
      let body = msg.snippet;
      const textPart = msg.payload.parts?.find(p => p.mimeType === "text/plain");
      if (textPart?.body?.data) {
        body = decodeBody(textPart.body.data).slice(0, 300);
      } else if (msg.payload.body?.data) {
        body = decodeBody(msg.payload.body.data).slice(0, 300);
      }

      const isUnread = msg.labelIds.includes("UNREAD");
      const labels = msg.labelIds
        .filter(l => !["INBOX", "UNREAD", "IMPORTANT", "CATEGORY_PERSONAL"].includes(l))
        .map(l => l.toLowerCase().replace("category_", ""))
        .slice(0, 2);

      return {
        id: msg.id,
        from: fromName,
        subject,
        body: body.trim(),
        time: formatDate(msg.internalDate),
        priority: isUnread ? "high" as const : "low" as const,
        read: !isUnread,
        labels,
      };
    });

  return NextResponse.json({ connected: true, emails });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("gmail_token");
  response.cookies.delete("gmail_refresh_token");
  return response;
}
