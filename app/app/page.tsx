import { installedAgents } from "@/lib/mock-data";
import { AgentCard } from "@/components/agents/agent-card";
import { GlobalChat } from "@/components/agents/global-chat";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your active agents are monitoring and reasoning across your tools.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {installedAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      <GlobalChat />
    </div>
  );
}
