import { notFound } from "next/navigation";
import { installedAgents } from "@/lib/mock-data";
import { AgentDetailView } from "@/components/agents/agent-detail-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { id } = await params;
  const agent = installedAgents.find((a) => a.id === id);

  if (!agent) {
    notFound();
  }

  return <AgentDetailView agent={agent} />;
}

export function generateStaticParams() {
  return installedAgents.map((a) => ({ id: a.id }));
}
