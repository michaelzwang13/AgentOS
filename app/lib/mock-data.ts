export type AgentStatus = "active" | "idle" | "error";

export interface Agent {
  id: string;
  name: string;
  description: string;
  integration: "gmail" | "slack" | "github" | "custom";
  status: AgentStatus;
  installed: boolean;
  lastActivity: string;
  unread?: number;
  icon: string;
}

export interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  time: string;
  priority: "high" | "medium" | "low";
  read: boolean;
  labels: string[];
}

export interface SlackMessage {
  id: string;
  channel: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
  reactions?: { emoji: string; count: number }[];
  thread?: SlackMessage[];
}

export interface GitHubItem {
  id: string;
  type: "pr" | "issue";
  title: string;
  number: number;
  repo: string;
  author: string;
  status: "open" | "closed" | "merged" | "draft";
  body: string;
  time: string;
  comments: number;
  labels: string[];
}

export const installedAgents: Agent[] = [
  {
    id: "inbox",
    name: "Inbox Agent",
    description: "Summarizes emails, detects priority, and drafts replies",
    integration: "gmail",
    status: "active",
    installed: true,
    lastActivity: "2 min ago",
    unread: 5,
    icon: "📧",
  },
  {
    id: "slack",
    name: "Slack Agent",
    description: "Summarizes discussions and extracts action items",
    integration: "slack",
    status: "active",
    installed: true,
    lastActivity: "5 min ago",
    unread: 12,
    icon: "💬",
  },
  {
    id: "github",
    name: "GitHub Agent",
    description: "Tracks PRs, issues, and suggests code improvements",
    integration: "github",
    status: "active",
    installed: true,
    lastActivity: "10 min ago",
    unread: 3,
    icon: "🐙",
  },
];

export const marketplaceAgents: Agent[] = [
  {
    id: "linear",
    name: "Linear Agent",
    description: "Track issues, sprints, and project progress",
    integration: "custom",
    status: "idle",
    installed: false,
    lastActivity: "never",
    icon: "📐",
  },
  {
    id: "notion",
    name: "Notion Agent",
    description: "Sync docs, wikis, and project notes",
    integration: "custom",
    status: "idle",
    installed: false,
    lastActivity: "never",
    icon: "📝",
  },
  {
    id: "jira",
    name: "Jira Agent",
    description: "Manage tickets, sprints, and backlogs",
    integration: "custom",
    status: "idle",
    installed: false,
    lastActivity: "never",
    icon: "🎯",
  },
  {
    id: "figma",
    name: "Figma Agent",
    description: "Monitor design changes and handoff notes",
    integration: "custom",
    status: "idle",
    installed: false,
    lastActivity: "never",
    icon: "🎨",
  },
  {
    id: "pagerduty",
    name: "PagerDuty Agent",
    description: "Alert summaries and on-call escalations",
    integration: "custom",
    status: "idle",
    installed: false,
    lastActivity: "never",
    icon: "🚨",
  },
  {
    id: "calendar",
    name: "Calendar Agent",
    description: "Prep meeting summaries and scheduling conflicts",
    integration: "custom",
    status: "idle",
    installed: false,
    lastActivity: "never",
    icon: "📅",
  },
];

export const mockEmails: Email[] = [
  {
    id: "e1",
    from: "Sarah Chen",
    fromEmail: "sarah@acme.com",
    subject: "Re: Q2 launch — need decision by EOD",
    body: "Hey, we're blocked on the pricing page copy. The design is done but marketing hasn't signed off. Can you get Alex to approve by EOD? The dev team is waiting and we'll miss the Thursday deploy window if not.",
    time: "9:14 AM",
    priority: "high",
    read: false,
    labels: ["launch", "urgent"],
  },
  {
    id: "e2",
    from: "Marcus Rivera",
    fromEmail: "m.rivera@vendor.io",
    subject: "Contract renewal — 30 day notice",
    body: "This is a reminder that your current contract expires on May 12th. Please review the attached renewal terms. We've included a 5% discount for early renewal before April 25th. Let me know if you'd like to schedule a call.",
    time: "8:47 AM",
    priority: "high",
    read: false,
    labels: ["legal", "renewal"],
  },
  {
    id: "e3",
    from: "Dev Bot",
    fromEmail: "noreply@github.com",
    subject: "[acme/frontend] PR #142 needs review",
    body: "Pull request #142 'feat: redesign checkout flow' was opened by jdoe and is awaiting your review. 3 files changed, +287 -41.",
    time: "Yesterday",
    priority: "medium",
    read: true,
    labels: ["github", "review"],
  },
  {
    id: "e4",
    from: "All Hands Invite",
    fromEmail: "calendar@acme.com",
    subject: "Q2 All Hands — Thursday 2pm",
    body: "You're invited to the Q2 All Hands meeting. Please prepare a 3-minute update on your team's progress. Slides due by Wednesday EOD. Zoom link in the calendar invite.",
    time: "Yesterday",
    priority: "medium",
    read: true,
    labels: ["meeting"],
  },
  {
    id: "e5",
    from: "Priya Nair",
    fromEmail: "p.nair@acme.com",
    subject: "Budget approval for new tooling",
    body: "Quick heads up — I've submitted the tooling budget request ($12k annual for Datadog). Finance needs your sign-off before April 20th. The request ID is BUD-2024-089.",
    time: "Mon",
    priority: "low",
    read: true,
    labels: ["budget"],
  },
];

export const mockSlackMessages: SlackMessage[] = [
  {
    id: "s1",
    channel: "#engineering",
    user: "Jordan Kim",
    avatar: "JK",
    text: "Heads up — staging is down, looks like the deploy at 9am broke the auth middleware. @oncall can you take a look? Users are getting 401s on login.",
    time: "9:22 AM",
    reactions: [{ emoji: "👀", count: 4 }, { emoji: "🔥", count: 2 }],
  },
  {
    id: "s2",
    channel: "#engineering",
    user: "Taylor Moss",
    avatar: "TM",
    text: "On it. Rolling back to the previous image now. Give me 5.",
    time: "9:24 AM",
    reactions: [{ emoji: "🙏", count: 6 }],
  },
  {
    id: "s3",
    channel: "#product",
    user: "Alex Park",
    avatar: "AP",
    text: "Marketing signed off on the pricing copy — just waiting on legal review now. Should be clear by tomorrow morning.",
    time: "9:31 AM",
    reactions: [{ emoji: "✅", count: 3 }],
  },
  {
    id: "s4",
    channel: "#general",
    user: "Jamie Wu",
    avatar: "JW",
    text: "Reminder: All Hands slides due by tomorrow EOD. Drop them in the shared Drive folder. Q2 is looking strong — excited to share some wins 🎉",
    time: "8:55 AM",
    reactions: [{ emoji: "🎉", count: 8 }, { emoji: "💪", count: 5 }],
  },
  {
    id: "s5",
    channel: "#design",
    user: "Riley Cho",
    avatar: "RC",
    text: "Checkout flow redesign is in Figma, linked in the PR. Left comments on the mobile breakpoints — the cart drawer overlaps the nav on 375px. Can someone grab this before it merges?",
    time: "Yesterday",
    reactions: [{ emoji: "👀", count: 2 }],
  },
  {
    id: "s6",
    channel: "#engineering",
    user: "Jordan Kim",
    avatar: "JK",
    text: "Staging is back up. Rollback complete. Root cause: the new middleware wasn't handling the token refresh edge case. PR to fix incoming.",
    time: "9:41 AM",
    reactions: [{ emoji: "✅", count: 7 }, { emoji: "🚀", count: 3 }],
  },
];

export const mockGitHubItems: GitHubItem[] = [
  {
    id: "g1",
    type: "pr",
    title: "feat: redesign checkout flow",
    number: 142,
    repo: "acme/frontend",
    author: "jdoe",
    status: "open",
    body: "Redesigns the checkout flow per the new Figma specs. Includes updated cart drawer, address form validation, and order summary component. Closes #98.\n\nMobile breakpoint issue flagged by design — needs fix before merging.",
    time: "Yesterday",
    comments: 5,
    labels: ["feature", "needs-review"],
  },
  {
    id: "g2",
    type: "pr",
    title: "fix: auth middleware token refresh edge case",
    number: 143,
    repo: "acme/backend",
    author: "taylor.moss",
    status: "draft",
    body: "Fixes the token refresh issue that caused the 9am staging outage. Added handling for the case where refresh token is expired but access token is still valid (race condition).\n\nAdded unit tests. Need integration test coverage.",
    time: "9:45 AM",
    comments: 1,
    labels: ["bug", "hotfix"],
  },
  {
    id: "g3",
    type: "issue",
    title: "Cart drawer overlaps nav on mobile (375px)",
    number: 144,
    repo: "acme/frontend",
    author: "riley.cho",
    status: "open",
    body: "On 375px viewport, the cart drawer z-index causes it to overlap the top nav bar. Repro: open cart on iPhone SE (375px). Expected: drawer sits below nav. Linked to PR #142.",
    time: "Yesterday",
    comments: 3,
    labels: ["bug", "mobile", "design"],
  },
  {
    id: "g4",
    type: "pr",
    title: "chore: update dependencies to address CVEs",
    number: 141,
    repo: "acme/frontend",
    author: "bot-security",
    status: "open",
    body: "Automated PR to resolve 3 moderate CVEs in lodash and node-fetch. All tests passing.",
    time: "2 days ago",
    comments: 0,
    labels: ["security", "dependencies"],
  },
  {
    id: "g5",
    type: "issue",
    title: "Q2 launch: pricing page copy needs sign-off",
    number: 139,
    repo: "acme/frontend",
    author: "sarah.chen",
    status: "open",
    body: "Blocking Q2 launch. Marketing needs to approve final copy before we can deploy the pricing page update. Deploy window is Thursday. See email thread for context.",
    time: "2 days ago",
    comments: 7,
    labels: ["launch", "blocker"],
  },
];

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const agentSystemPrompts: Record<string, string> = {
  inbox: `You are an Inbox Agent analyzing Gmail data. You have access to these emails: ${JSON.stringify(mockEmails, null, 2)}.
Be concise and action-oriented. Summarize key emails, detect urgency, suggest replies or next steps. Never just describe — always recommend actions.`,

  slack: `You are a Slack Agent analyzing Slack messages. You have access to these messages: ${JSON.stringify(mockSlackMessages, null, 2)}.
Summarize discussions, extract action items, flag blockers. Be concise and useful.`,

  github: `You are a GitHub Agent analyzing repository activity. You have access to these PRs and issues: ${JSON.stringify(mockGitHubItems, null, 2)}.
Summarize PR status, flag blockers, suggest review priorities and next steps. Be direct.`,

  global: `You are an AI assistant with full visibility across Gmail, Slack, and GitHub. Reason across all data sources to give unified, actionable insights.

Gmail data: ${JSON.stringify(mockEmails, null, 2)}

Slack data: ${JSON.stringify(mockSlackMessages, null, 2)}

GitHub data: ${JSON.stringify(mockGitHubItems, null, 2)}

Always cross-reference: connect signals across tools, identify patterns and blockers, and suggest concrete next steps. Be direct and useful.`,
};
