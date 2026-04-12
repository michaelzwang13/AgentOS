"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Agent } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface AgentCardProps {
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

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link href={`/agent/${agent.id}`}>
      <Card className="hover:border-primary/50 transition-all cursor-pointer group hover:shadow-lg hover:shadow-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{agent.icon}</div>
              <div>
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {agent.name}
                </h3>
                <Badge
                  variant="secondary"
                  className={cn("text-xs mt-0.5", integrationColors[agent.integration])}
                >
                  {agent.integration}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", statusColors[agent.status])} />
              {agent.unread && agent.unread > 0 ? (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-medium">
                  {agent.unread}
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {agent.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Last active {agent.lastActivity}
            </span>
            <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Open →
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
