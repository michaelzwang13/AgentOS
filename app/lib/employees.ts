// Hard-coded seed data for the hackathon's two starter AI employees.
// The frontend renders the talent directory and hire flow from this file
// until the backend exposes GET /roles to list templates dynamically.

export type AutonomyTier = "observer" | "assistant" | "operator";
export type Tool = "github" | "slack" | "gmail";
export type Department = "engineering" | "support";

export type HireTier = {
  tier: AutonomyTier;
  label: string;
  blurb: string;
  includes: string[];
  monthly: number;
};

export type BriefField = {
  key: string;
  label: string;
  placeholder: string;
  helper?: string;
};

export type SampleOutput = {
  title: string;
  body: string;
};

export type EmployeeTemplate = {
  id: string;
  displayName: string;
  tagline: string;
  department: Department;
  icon: string;
  requiredTools: Tool[];
  oauthReal: Tool[];
  tiers: HireTier[];
  briefFields: BriefField[];
  sampleOutputs: SampleOutput[];
};

export const employees: EmployeeTemplate[] = [
  {
    id: "code-review-engineer",
    displayName: "Code Review Engineer",
    tagline:
      "I will review every pull request within 10 minutes of it opening.",
    department: "engineering",
    icon: "code",
    requiredTools: ["github"],
    oauthReal: ["github"],
    tiers: [
      {
        tier: "observer",
        label: "Observer",
        blurb: "Reads every PR, posts a summary to your Slack. Never comments on GitHub.",
        includes: [
          "Reads every opened PR",
          "Posts summary + risk flag to Slack",
          "Does not comment on GitHub",
        ],
        monthly: 49,
      },
      {
        tier: "assistant",
        label: "Assistant",
        blurb: "Reviews every PR and leaves inline comments. Will not request changes or approve.",
        includes: [
          "Everything in Observer",
          "Inline review comments on GitHub",
          "Highlights risky diffs",
          "Never approves or requests changes",
        ],
        monthly: 99,
      },
      {
        tier: "operator",
        label: "Operator",
        blurb: "Reviews, comments, requests changes, and approves low-risk PRs autonomously.",
        includes: [
          "Everything in Assistant",
          "Requests changes on PRs with issues",
          "Approves low-risk dependency bumps",
          "Escalates large diffs for human review",
        ],
        monthly: 149,
      },
    ],
    briefFields: [
      {
        key: "repos",
        label: "Which repositories?",
        placeholder: "acme/frontend, acme/backend",
        helper: "Comma-separated. Scope the employee to these repos only.",
      },
      {
        key: "cadence",
        label: "When should they work?",
        placeholder: "On every PR open",
        helper: "e.g. 'on PR open', 'daily at 9am', 'when requested'.",
      },
      {
        key: "nickname",
        label: "Give them a nickname (optional)",
        placeholder: "Reviewer #1",
        helper: "Shown on your team page. Leave blank to use the role name.",
      },
    ],
    sampleOutputs: [
      {
        title: "Inline review comment on PR #142",
        body: "The new `refreshToken` handler swallows errors on line 87 — if the refresh call fails the user is silently logged out with no retry. Recommend surfacing the error and letting the retry middleware handle it. Rest of the diff looks clean.",
      },
      {
        title: "Risk flag on PR #156",
        body: "Flagging this for deeper human review: touches auth middleware + changes the session cookie max-age. Tests pass but the middleware diff isn't covered by existing integration tests. I'd want someone who owns auth to eyeball it.",
      },
    ],
  },
  {
    id: "customer-support",
    displayName: "Customer Support",
    tagline:
      "I will triage every incoming support message and draft a reply within 5 minutes.",
    department: "support",
    icon: "support",
    requiredTools: ["slack", "gmail"],
    oauthReal: [],
    tiers: [
      {
        tier: "observer",
        label: "Observer",
        blurb: "Watches your support inbox and Slack channel, posts a daily summary. Never replies.",
        includes: [
          "Reads every incoming ticket",
          "Daily summary of themes and urgency",
          "Does not reply",
        ],
        monthly: 49,
      },
      {
        tier: "assistant",
        label: "Assistant",
        blurb: "Triages every incoming message and drafts replies for your team to review.",
        includes: [
          "Everything in Observer",
          "Categorizes every ticket (bug / billing / question / spam)",
          "Drafts reply in your voice",
          "Never sends replies without review",
        ],
        monthly: 99,
      },
      {
        tier: "operator",
        label: "Operator",
        blurb: "Auto-replies to common questions and escalates anything ambiguous to a human.",
        includes: [
          "Everything in Assistant",
          "Auto-replies to FAQ / status / how-to questions",
          "Escalates billing, bugs, and unclear asks to a human",
          "Learns your reply patterns over time",
        ],
        monthly: 149,
      },
    ],
    briefFields: [
      {
        key: "channels",
        label: "Which Slack channels and Gmail labels?",
        placeholder: "#support, label:support@acme.com",
        helper: "Comma-separated. The employee only sees messages from these sources.",
      },
      {
        key: "cadence",
        label: "How often should they work?",
        placeholder: "On every new message",
        helper: "e.g. 'every new message', 'every 15 min', 'business hours only'.",
      },
      {
        key: "nickname",
        label: "Give them a nickname (optional)",
        placeholder: "Support buddy",
        helper: "Shown on your team page. Leave blank to use the role name.",
      },
    ],
    sampleOutputs: [
      {
        title: "Triage + draft reply on an incoming email",
        body: "Category: billing / cancellation request. Urgency: medium. Draft reply: 'Hey Sam, sorry to see you go. I can cancel your plan effective the end of your current billing period (April 28). You'll keep access until then. Want me to proceed, or would a pause be more useful?' — will send on your approval.",
      },
      {
        title: "Summary of overnight #support Slack activity",
        body: "12 messages overnight. 3 real issues (one payment failure, two onboarding questions), 2 spam/outreach, rest resolved. Payment failure: @danielle already responded at 8:47am. Onboarding questions: drafted replies, awaiting review.",
      },
    ],
  },
];

export function getEmployee(id: string): EmployeeTemplate | undefined {
  return employees.find((e) => e.id === id);
}
