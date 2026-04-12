"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  repo: string;
  title: string;
  type: string;
  reason: string;
  time: string;
  unread: boolean;
  url?: string;
  author?: string;
  state?: string;
}

const mockItems: ActivityItem[] = [
  { id: "m1", repo: "acme/frontend", title: "feat: redesign checkout flow", type: "PR", reason: "review requested", time: "2h ago", unread: true, author: "jdoe", state: "open" },
  { id: "m2", repo: "acme/backend", title: "fix: race condition in session handler", type: "PR", reason: "review requested", time: "4h ago", unread: true, author: "priya-n", state: "open" },
  { id: "m3", repo: "acme/frontend", title: "CI failing on main — lint error in checkout", type: "Issue", reason: "mentioned", time: "5h ago", unread: true },
  { id: "m4", repo: "acme/infra", title: "chore: bump node to 22 LTS", type: "PR", reason: "subscribed", time: "Yesterday", unread: false, author: "marcus-r", state: "draft" },
  { id: "m5", repo: "acme/backend", title: "Memory leak in event queue under load", type: "Issue", reason: "assigned", time: "Yesterday", unread: false },
  { id: "m6", repo: "acme/design-system", title: "feat: new Button variants for v2", type: "PR", reason: "review requested", time: "Mon", unread: false, author: "sarah-c", state: "open" },
];

const typeColors: Record<string, string> = {
  PR: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Issue: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  Commit: "text-green-400 bg-green-400/10 border-green-400/20",
  Discussion: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const stateColors: Record<string, string> = {
  open: "text-green-400",
  draft: "text-muted-foreground",
  closed: "text-red-400",
  merged: "text-purple-400",
};

interface GithubFeedProps {
  onContextChange?: (context: string) => void;
}

export function GithubFeed({ onContextChange }: GithubFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchActivity();
  }, []);

  async function fetchActivity() {
    setLoading(true);
    try {
      const res = await fetch("/api/github/activity");
      const data = await res.json();
      if (data.connected && data.items?.length > 0) {
        setConnected(true);
        setItems(data.items);
        onContextChange?.(buildContext(data.items));
      } else {
        setConnected(false);
        setItems(mockItems);
        onContextChange?.(buildContext(mockItems));
      }
    } catch {
      setConnected(false);
      setItems(mockItems);
      onContextChange?.(buildContext(mockItems));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/github/activity", { method: "DELETE" });
    setConnected(false);
    setItems(mockItems);
    onContextChange?.(buildContext(mockItems));
    setDisconnecting(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {connected ? (
            <><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-muted-foreground">Live from GitHub</span></>
          ) : (
            <><div className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-xs text-muted-foreground">Using mock data</span></>
          )}
        </div>
        {connected ? (
          <Button variant="ghost" size="sm" className="text-xs h-6 text-muted-foreground"
            onClick={handleDisconnect} disabled={disconnecting}>
            Disconnect
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="text-xs h-6"
            onClick={() => (window.location.href = `/api/auth/github?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>
            Connect GitHub
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-1">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {items.map(item => (
              <div
                key={item.id}
                className={cn(
                  "px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer",
                  item.unread && "border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Badge variant="outline" className={cn("text-xs shrink-0", typeColors[item.type] || "text-muted-foreground bg-muted")}>
                      {item.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono truncate">{item.repo}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
                </div>
                <p className={cn("text-sm mb-1 leading-snug", item.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {item.title}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">{item.reason}</span>
                  {item.author && (
                    <span className="text-xs text-muted-foreground">· @{item.author}</span>
                  )}
                  {item.state && (
                    <span className={cn("text-xs font-medium", stateColors[item.state] || "text-muted-foreground")}>
                      · {item.state}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function buildContext(items: ActivityItem[]): string {
  return items.map(i =>
    `[${i.type}] ${i.repo}: "${i.title}" — ${i.reason}, ${i.state || ""}, ${i.unread ? "unread" : "read"}, ${i.time}${i.author ? `, by @${i.author}` : ""}`
  ).join("\n");
}

export const githubContext = buildContext(mockItems);
