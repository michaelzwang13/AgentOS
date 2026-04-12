"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChatPanel } from "@/components/test/chat-panel";
import { cn } from "@/lib/utils";

export function GlobalChat() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Ask Your Team</h2>
          <p className="text-sm text-muted-foreground">
            Query across all your AI employees at once
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <Card className={cn("transition-all overflow-hidden", expanded ? "h-[500px]" : "h-[320px]")}>
        <div className="h-full flex flex-col">
          <ChatPanel agentId="global" />
        </div>
      </Card>
    </div>
  );
}
