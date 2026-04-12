"use client";

import { mockGitHubItems } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const statusConfig = {
  open: { label: "Open", className: "text-green-400 bg-green-400/10 border-green-400/20" },
  closed: { label: "Closed", className: "text-red-400 bg-red-400/10 border-red-400/20" },
  merged: { label: "Merged", className: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  draft: { label: "Draft", className: "text-muted-foreground bg-muted border-border" },
};

const typeIcons = {
  pr: "⤴",
  issue: "●",
};

export function GitHubFeed() {
  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {mockGitHubItems.map((item) => {
          const status = statusConfig[item.status];
          return (
            <div key={item.id} className="px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer">
              <div className="flex items-start gap-2 mb-1">
                <span className={cn(
                  "text-sm font-mono mt-0.5",
                  item.type === "pr" ? "text-blue-400" : "text-yellow-400"
                )}>
                  {typeIcons[item.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    <Badge
                      variant="outline"
                      className={cn("text-xs shrink-0", status.className)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{item.repo}#{item.number}</span>
                    <span>·</span>
                    <span>{item.author}</span>
                    <span>·</span>
                    <span>{item.time}</span>
                    {item.comments > 0 && (
                      <>
                        <span>·</span>
                        <span>💬 {item.comments}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {item.labels.map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
