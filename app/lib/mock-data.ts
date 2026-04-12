// Minimal stub — keeps existing components compiling.
// Real data flows through API routes. Remove once components are rewritten.

export interface SlackMessage {
  id: string;
  channel: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
  reactions?: { emoji: string; count: number }[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  integration: "gmail" | "slack" | "github" | "custom";
  status: "active" | "idle" | "error";
  installed: boolean;
  lastActivity: string;
  unread?: number;
  icon: string;
}

export const mockSlackMessages: SlackMessage[] = [
  { id: "s1", channel: "#engineering", user: "Jordan Kim", avatar: "JK", text: "Heads up — staging is down, looks like the deploy at 9am broke the auth middleware.", time: "9:22 AM", reactions: [{ emoji: "👀", count: 4 }] },
  { id: "s2", channel: "#engineering", user: "Taylor Moss", avatar: "TM", text: "On it. Rolling back to the previous image now.", time: "9:24 AM", reactions: [{ emoji: "🙏", count: 6 }] },
  { id: "s3", channel: "#product", user: "Alex Park", avatar: "AP", text: "Marketing signed off on the pricing copy — just waiting on legal review.", time: "9:31 AM", reactions: [{ emoji: "✅", count: 3 }] },
  { id: "s4", channel: "#general", user: "Jamie Wu", avatar: "JW", text: "Reminder: All Hands slides due by tomorrow EOD.", time: "8:55 AM", reactions: [{ emoji: "🎉", count: 8 }] },
];

export const installedAgents: Agent[] = [
  { id: "inbox", name: "Inbox Agent", description: "Summarizes emails, detects priority, and drafts replies", integration: "gmail", status: "active", installed: true, lastActivity: "2 min ago", unread: 5, icon: "📧" },
  { id: "slack", name: "Slack Agent", description: "Summarizes discussions and extracts action items", integration: "slack", status: "active", installed: true, lastActivity: "5 min ago", unread: 12, icon: "💬" },
  { id: "github", name: "GitHub Agent", description: "Tracks PRs, issues, and suggests code improvements", integration: "github", status: "active", installed: true, lastActivity: "10 min ago", unread: 3, icon: "🐙" },
];

export const marketplaceAgents: Agent[] = [
  { id: "linear", name: "Linear Agent", description: "Track issues, sprints, and project progress", integration: "custom", status: "idle", installed: false, lastActivity: "never", icon: "📐" },
  { id: "notion", name: "Notion Agent", description: "Sync docs, wikis, and project notes", integration: "custom", status: "idle", installed: false, lastActivity: "never", icon: "📝" },
  { id: "jira", name: "Jira Agent", description: "Manage tickets, sprints, and backlogs", integration: "custom", status: "idle", installed: false, lastActivity: "never", icon: "🎯" },
];
