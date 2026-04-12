"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SlackFeed } from "@/components/agents/slack-feed";
import { GmailFeed } from "./gmail-feed";
import { GithubFeed } from "./github-feed";
import { ChatPanel } from "./chat-panel";

const agents = [
  { id: "slack",  label: "💬 Slack",  description: "Live messages from your workspace" },
  { id: "gmail",  label: "📧 Gmail",  description: "Gmail inbox" },
  { id: "github", label: "⑂ GitHub", description: "PRs and notifications" },
  { id: "global", label: "✦ Cross-agent", description: "Query across all integrations" },
];

export function TestDashboard() {
  const [tab, setTab] = useState("slack");
  const [gmailContext, setGmailContext] = useState<string | undefined>(undefined);
  const [githubContext, setGithubContext] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            Temp testing surface
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Testing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test your connected agents. Will be replaced by the full hire flow.
          </p>
        </div>
        <span className="text-xs border border-dashed border-border rounded px-2 py-1 text-muted-foreground">
          /test
        </span>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {agents.map(a => (
            <TabsTrigger key={a.id} value={a.id}>{a.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="slack" className="mt-4">
          <AgentPane
            agentId="slack"
            description="Live Slack messages — connect your workspace to see real data"
            feedSlot={<SlackFeed />}
          />
        </TabsContent>

        <TabsContent value="gmail" className="mt-4">
          <AgentPane
            agentId="gmail"
            description="Connect Gmail to let the agent read your real inbox"
            feedSlot={<GmailFeed onContextChange={setGmailContext} />}
            context={gmailContext}
          />
        </TabsContent>

        <TabsContent value="github" className="mt-4">
          <AgentPane
            agentId="github"
            description="Connect GitHub to see real PRs and notifications"
            feedSlot={<GithubFeed onContextChange={setGithubContext} />}
            context={githubContext}
          />
        </TabsContent>

        <TabsContent value="global" className="mt-4">
          <Card className="h-[560px] overflow-hidden flex flex-col">
            <ChatPanel agentId="global" />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AgentPane({
  agentId,
  description,
  feedSlot,
  context,
}: {
  agentId: string;
  description: string;
  feedSlot: React.ReactNode;
  context?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 560 }}>
        <Card className="overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            {feedSlot}
          </div>
        </Card>
        <Card className="overflow-hidden flex flex-col">
          <ChatPanel agentId={agentId} context={context} />
        </Card>
      </div>
    </div>
  );
}
