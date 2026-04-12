"use client";

import { useState } from "react";
import { installedAgents, marketplaceAgents, Agent } from "@/lib/mock-data";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MarketplaceView() {
  const [search, setSearch] = useState("");
  const [hired, setHired] = useState<Set<string>>(
    new Set(installedAgents.map((a) => a.id))
  );
  const [hiring, setHiring] = useState<string | null>(null);

  const allAgents = [...installedAgents, ...marketplaceAgents];

  const filtered = allAgents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.integration.toLowerCase().includes(search.toLowerCase())
  );

  async function handleHire(agent: Agent) {
    setHiring(agent.id);
    try {
      await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: agent.id, config: {} }),
      });
    } catch {
      // Backend unavailable — still show as hired in UI for demo
    }
    setHired((prev) => new Set([...prev, agent.id]));
    setHiring(null);
  }

  async function handleLetGo(agent: Agent) {
    if (["inbox", "slack", "github"].includes(agent.id)) return;
    try {
      await fetch("/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
    } catch {
      // Best effort
    }
    setHired((prev) => {
      const next = new Set(prev);
      next.delete(agent.id);
      return next;
    });
  }

  const hiredList = filtered.filter((a) => hired.has(a.id));
  const availableList = filtered.filter((a) => !hired.has(a.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Talent Directory</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse and hire AI employees for your team.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search AI employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">
          {hired.size} hired · {marketplaceAgents.filter(a => !hired.has(a.id)).length} available
        </span>
      </div>

      {hiredList.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Your Team ({hiredList.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hiredList.map((agent) => (
              <EmployeeCard
                key={agent.id}
                agent={agent}
                isHired
                isCore={["inbox", "slack", "github"].includes(agent.id)}
                onLetGo={() => handleLetGo(agent)}
              />
            ))}
          </div>
        </section>
      )}

      {availableList.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Available to Hire ({availableList.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableList.map((agent) => (
              <EmployeeCard
                key={agent.id}
                agent={agent}
                isHired={false}
                isCore={false}
                hiring={hiring === agent.id}
                onHire={() => handleHire(agent)}
              />
            ))}
          </div>
        </section>
      )}

      <CreateEmployeeCard />
    </div>
  );
}

function EmployeeCard({
  agent,
  isHired,
  isCore,
  hiring,
  onHire,
  onLetGo,
}: {
  agent: Agent;
  isHired: boolean;
  isCore: boolean;
  hiring?: boolean;
  onHire?: () => void;
  onLetGo?: () => void;
}) {
  return (
    <Card className={cn(isHired && "border-primary/30 bg-primary/5")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{agent.icon}</span>
            <div>
              <h3 className="font-semibold text-sm">{agent.name}</h3>
              <Badge variant="secondary" className="text-xs mt-0.5">
                {agent.integration}
              </Badge>
            </div>
          </div>
          {isHired && (
            <Badge className="text-xs bg-green-500/10 text-green-400 border-green-400/20">
              Hired
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
          {agent.description}
        </p>
        {isHired ? (
          <div className="flex gap-2">
            {!isCore ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={onLetGo}
              >
                Let Go
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">Core employee</span>
            )}
          </div>
        ) : (
          <Button
            size="sm"
            className="text-xs w-full"
            onClick={onHire}
            disabled={hiring}
          >
            {hiring ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Onboarding...
              </span>
            ) : (
              "Hire"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CreateEmployeeCard() {
  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Build Your Own
      </h2>
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer group">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-4xl mb-3">✦</div>
          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
            Create a Custom AI Employee
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Connect any API, define your employee&apos;s role and work style, and add them to your team.
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Get Started
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
