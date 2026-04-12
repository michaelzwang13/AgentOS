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
  const [installed, setInstalled] = useState<Set<string>>(
    new Set(installedAgents.map((a) => a.id))
  );
  const [installing, setInstalling] = useState<string | null>(null);

  const allAgents = [...installedAgents, ...marketplaceAgents];

  const filtered = allAgents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.integration.toLowerCase().includes(search.toLowerCase())
  );

  async function handleInstall(agent: Agent) {
    setInstalling(agent.id);
    await new Promise((r) => setTimeout(r, 1200));
    setInstalled((prev) => new Set([...prev, agent.id]));
    setInstalling(null);
  }

  function handleUninstall(agentId: string) {
    // Don't allow uninstalling the core three for demo purposes
    if (["inbox", "slack", "github"].includes(agentId)) return;
    setInstalled((prev) => {
      const next = new Set(prev);
      next.delete(agentId);
      return next;
    });
  }

  const installedList = filtered.filter((a) => installed.has(a.id));
  const availableList = filtered.filter((a) => !installed.has(a.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse and install agents to extend your dashboard.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">
          {installed.size} installed · {marketplaceAgents.length - (installed.size - 3)} available
        </span>
      </div>

      {installedList.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Installed ({installedList.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {installedList.map((agent) => (
              <MarketplaceCard
                key={agent.id}
                agent={agent}
                isInstalled
                isCore={["inbox", "slack", "github"].includes(agent.id)}
                onUninstall={() => handleUninstall(agent.id)}
              />
            ))}
          </div>
        </section>
      )}

      {availableList.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Available ({availableList.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableList.map((agent) => (
              <MarketplaceCard
                key={agent.id}
                agent={agent}
                isInstalled={false}
                isCore={false}
                installing={installing === agent.id}
                onInstall={() => handleInstall(agent)}
              />
            ))}
          </div>
        </section>
      )}

      <CreateAgentCard />
    </div>
  );
}

function MarketplaceCard({
  agent,
  isInstalled,
  isCore,
  installing,
  onInstall,
  onUninstall,
}: {
  agent: Agent;
  isInstalled: boolean;
  isCore: boolean;
  installing?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
}) {
  return (
    <Card className={cn(isInstalled && "border-primary/30 bg-primary/5")}>
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
          {isInstalled && (
            <Badge className="text-xs bg-green-500/10 text-green-400 border-green-400/20">
              Installed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
          {agent.description}
        </p>
        {isInstalled ? (
          <div className="flex gap-2">
            {!isCore && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={onUninstall}
              >
                Uninstall
              </Button>
            )}
            {isCore && (
              <span className="text-xs text-muted-foreground italic">Core integration</span>
            )}
          </div>
        ) : (
          <Button
            size="sm"
            className="text-xs w-full"
            onClick={onInstall}
            disabled={installing}
          >
            {installing ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Installing...
              </span>
            ) : (
              "Install"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CreateAgentCard() {
  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Build Your Own
      </h2>
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer group">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-4xl mb-3">✦</div>
          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
            Create a Custom Agent
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Connect any API, define your agent&apos;s behavior, and add it to your dashboard.
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Get Started
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
