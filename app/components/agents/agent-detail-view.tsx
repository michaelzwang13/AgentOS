"use client";

import { useState } from "react";
import Link from "next/link";
import { Agent } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChatPanel } from "./chat-panel";
import { InboxFeed } from "./inbox-feed";
import { SlackFeed } from "./slack-feed";
import { GitHubFeed } from "./github-feed";
import { cn } from "@/lib/utils";

interface AgentDetailViewProps {
  agent: Agent;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  idle: "bg-yellow-500",
  error: "bg-red-500",
};

const integrationColors: Record<string, string> = {
  gmail: "text-red-400 bg-red-400/10",
  slack: "text-purple-400 bg-purple-400/10",
  github: "text-blue-400 bg-blue-400/10",
  custom: "text-emerald-400 bg-emerald-400/10",
};

function getFeed(agentId: string) {
  switch (agentId) {
    case "inbox":
      return <InboxFeed />;
    case "github":
      return <GitHubFeed />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          No data available
        </div>
      );
  }
}

function getDataLabel(agentId: string) {
  switch (agentId) {
    case "inbox": return "Emails";
    case "slack": return "Messages";
    case "github": return "PRs & Issues";
    default: return "Data";
  }
}

export function AgentDetailView({ agent }: AgentDetailViewProps) {
  const [slackConnected, setSlackConnected] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{agent.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <div className={cn("w-2 h-2 rounded-full", statusColors[agent.status])} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className={integrationColors[agent.integration]}
              >
                {agent.integration}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Last active {agent.lastActivity}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
          </div>
        </div>
        {agent.unread && agent.unread > 0 ? (
          <div className="text-right">
            <span className="text-2xl font-bold">{agent.unread}</span>
            <p className="text-xs text-muted-foreground">unread</p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: "600px" }}>
        <Card className="overflow-hidden flex flex-col">
          {agent.id !== "slack" && (
            <div className="px-4 py-3 border-b border-border shrink-0">
              <h3 className="text-sm font-medium">{getDataLabel(agent.id)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live feed from your {agent.integration} integration
              </p>
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            {agent.id === "slack"
              ? <SlackFeed onConnectionChange={setSlackConnected} />
              : getFeed(agent.id)}
          </div>
        </Card>

        <Card className="overflow-hidden flex flex-col">
          <ChatPanel agentId={agent.id} />
        </Card>
      </div>
    </div>
  );
}
