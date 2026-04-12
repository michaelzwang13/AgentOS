import { NextRequest, NextResponse } from "next/server";
import { getSlackMessages, disconnectSlack } from "@/lib/backend-client";

export async function GET(req: NextRequest) {
  // Try backend first
  try {
    const backendRes = await getSlackMessages();
    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }
  } catch {
    // Backend unreachable — fall through to cookie fallback
  }

  // Fallback: use token from cookie (set when backend was unavailable at OAuth time)
  const cookieToken = req.cookies.get("slack_token")?.value;
  if (!cookieToken) {
    return NextResponse.json({ connected: false, messages: [] });
  }

  return fetchSlackDirect(cookieToken);
}

export async function DELETE() {
  // Try to delete from backend
  try {
    await disconnectSlack();
  } catch {
    // Backend unreachable, best effort
  }

  // Also clear cookie fallback
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("slack_token");
  return response;
}

async function fetchSlackDirect(token: string) {
  const userCache = new Map<string, string>();

  // Use only public_channel to avoid needing groups:read scope
  const channelsRes = await fetch(
    "https://slack.com/api/conversations.list?types=public_channel&limit=20&exclude_archived=true",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const channelsData = await channelsRes.json();

  if (!channelsData.ok) {
    console.error("[Slack] conversations.list error:", channelsData.error, channelsData);
    return NextResponse.json({ connected: false, error: channelsData.error });
  }

  const channels = (channelsData.channels || []).filter(
    (c: { is_member: boolean }) => c.is_member
  );
  const allMessages = [];

  for (const channel of channels.slice(0, 5)) {
    const histRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${channel.id}&limit=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const histData = await histRes.json();
    if (!histData.ok || !histData.messages) continue;

    for (const msg of histData.messages) {
      if (!msg.user || !msg.text) continue;

      if (!userCache.has(msg.user)) {
        const uRes = await fetch(
          `https://slack.com/api/users.info?user=${msg.user}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const uData = await uRes.json();
        const name = uData.ok
          ? uData.user.profile.display_name || uData.user.profile.real_name
          : msg.user;
        userCache.set(msg.user, name);
      }

      const name = userCache.get(msg.user)!;
      const ts = parseFloat(msg.ts);
      const diffMs = Date.now() - ts * 1000;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);

      allMessages.push({
        id: msg.ts,
        channel: `#${channel.name}`,
        user: name,
        avatar: name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2),
        text: msg.text,
        time: diffMins < 60 ? `${diffMins}m ago` : diffHours < 24 ? `${diffHours}h ago` : new Date(ts * 1000).toLocaleDateString(),
        reactions: (msg.reactions || []).map((r: { name: string; count: number }) => ({
          emoji: `:${r.name}:`,
          count: r.count,
        })),
      });
    }
  }

  allMessages.sort((a, b) => parseFloat(b.id) - parseFloat(a.id));
  return NextResponse.json({ connected: true, messages: allMessages });
}
