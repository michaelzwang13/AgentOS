import { NextRequest, NextResponse } from "next/server";
import { readBearer } from "@/lib/oauth-next";

interface GithubNotification {
  id: string;
  reason: string;
  subject: {
    title: string;
    url: string;
    type: string;
    latest_comment_url: string | null;
  };
  repository: {
    full_name: string;
  };
  updated_at: string;
  unread: boolean;
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  user: { login: string };
  created_at: string;
  updated_at: string;
  draft: boolean;
  html_url: string;
  base: { repo: { full_name: string } };
  requested_reviewers: { login: string }[];
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    assign: "assigned",
    author: "author",
    comment: "commented",
    mention: "mentioned",
    review_requested: "review requested",
    subscribed: "subscribed",
    team_mention: "team mention",
    ci_activity: "CI",
  };
  return map[reason] || reason;
}

export async function GET(req: NextRequest) {
  const token = readBearer(req, req.cookies.get("github_token")?.value);

  if (!token) {
    return NextResponse.json({ connected: false, items: [] });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Fetch notifications and PRs awaiting review in parallel
  const [notifRes, prRes] = await Promise.all([
    fetch("https://api.github.com/notifications?all=false&per_page=15", { headers }),
    fetch("https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10", { headers }),
  ]);

  if (!notifRes.ok && notifRes.status === 401) {
    return NextResponse.json({ connected: false, items: [] });
  }

  const items: {
    id: string;
    repo: string;
    title: string;
    type: string;
    reason: string;
    time: string;
    unread: boolean;
    url?: string;
    author?: string;
    state?: string;
  }[] = [];

  // Process notifications
  if (notifRes.ok) {
    const notifications: GithubNotification[] = await notifRes.json();
    for (const n of notifications) {
      items.push({
        id: `notif-${n.id}`,
        repo: n.repository.full_name,
        title: n.subject.title,
        type: n.subject.type.replace("PullRequest", "PR").replace("Issue", "Issue"),
        reason: reasonLabel(n.reason),
        time: formatDate(n.updated_at),
        unread: n.unread,
      });
    }
  }

  // Process PRs awaiting your review
  if (prRes.ok) {
    const prData = await prRes.json();
    const prs: PullRequest[] = prData.items || [];
    for (const pr of prs) {
      // Avoid duplicating items already in notifications
      const alreadyListed = items.some(
        (i) => i.title === pr.title && i.repo === pr.base.repo.full_name
      );
      if (!alreadyListed) {
        items.push({
          id: `pr-${pr.id}`,
          repo: pr.base.repo.full_name,
          title: pr.title,
          type: "PR",
          reason: "review requested",
          time: formatDate(pr.updated_at),
          unread: true,
          url: pr.html_url,
          author: pr.user.login,
          state: pr.draft ? "draft" : pr.state,
        });
      }
    }
  }

  // Sort: unread first, then by original order (already time-sorted from API)
  items.sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0));

  return NextResponse.json({ connected: true, items: items.slice(0, 20) });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("github_token");
  return response;
}
