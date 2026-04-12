"use client";

import { mockEmails } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const priorityColors = {
  high: "text-red-400 bg-red-400/10 border-red-400/20",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  low: "text-muted-foreground bg-muted border-border",
};

export function InboxFeed() {
  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {mockEmails.map((email) => (
          <div
            key={email.id}
            className={cn(
              "px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer",
              !email.read && "border-l-2 border-l-primary"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("font-medium text-sm", !email.read && "text-foreground", email.read && "text-muted-foreground")}>
                  {email.from}
                </span>
                <Badge
                  variant="outline"
                  className={cn("text-xs shrink-0", priorityColors[email.priority])}
                >
                  {email.priority}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{email.time}</span>
            </div>
            <p className={cn("text-sm mb-1 truncate", !email.read ? "font-medium" : "text-muted-foreground")}>
              {email.subject}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {email.body}
            </p>
            <div className="flex gap-1 mt-2">
              {email.labels.map((label) => (
                <Badge key={label} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
