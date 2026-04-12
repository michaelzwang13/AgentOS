import { NextRequest, NextResponse } from "next/server";

interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
}

interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
  reactions?: { name: string; count: number }[];
}

interface SlackUser {
  real_name: string;
  profile: { display_name: string; real_name: string };
}

// Simple in-memory cache for user names so we don't hammer the API
const userCache = new Map<string, string>();

async function getUsername(token: string, userId: string): Promise<string> {
  if (userCache.has(userId)) return userCache.get(userId)!;
  const res = await fetch(
    `https://slack.com/api/users.info?user=${userId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.ok) {
    const user: SlackUser = data.user;
    const name =
      user.profile.display_name || user.profile.real_name || user.real_name;
    userCache.set(userId, name);
    return name;
  }
  return userId;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("slack_token")?.value;

  if (!token) {
    return NextResponse.json({ connected: false, messages: [] });
  }

  // 1. Get channels the user is a member of
  const channelsRes = await fetch(
    "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=20&exclude_archived=true",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const channelsData = await channelsRes.json();

  if (!channelsData.ok) {
    return NextResponse.json(
      { connected: false, error: channelsData.error },
      { status: 401 }
    );
  }

  const channels: SlackChannel[] = (channelsData.channels || []).filter(
    (c: SlackChannel) => c.is_member
  );

  // 2. Fetch recent messages from each channel (up to 5 channels, 3 messages each)
  const allMessages = [];
  for (const channel of channels.slice(0, 5)) {
    const histRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${channel.id}&limit=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const histData = await histRes.json();
    if (!histData.ok || !histData.messages) continue;

    for (const msg of histData.messages as SlackMessage[]) {
      if (!msg.user || !msg.text || msg.text.startsWith("joined #")) continue;

      const userName = await getUsername(token, msg.user);
      const date = new Date(parseFloat(msg.ts) * 1000);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);

      let timeLabel: string;
      if (diffMins < 60) timeLabel = `${diffMins}m ago`;
      else if (diffHours < 24) timeLabel = `${diffHours}h ago`;
      else timeLabel = date.toLocaleDateString();

      allMessages.push({
        id: msg.ts,
        channel: `#${channel.name}`,
        user: userName,
        avatar: initials(userName),
        text: msg.text,
        time: timeLabel,
        reactions: (msg.reactions || []).map((r) => ({
          emoji: `:${r.name}:`,
          count: r.count,
        })),
      });
    }
  }

  // Sort by timestamp descending
  allMessages.sort((a, b) => parseFloat(b.id) - parseFloat(a.id));

  return NextResponse.json({ connected: true, messages: allMessages });
}

export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("slack_token");
  return response;
}
