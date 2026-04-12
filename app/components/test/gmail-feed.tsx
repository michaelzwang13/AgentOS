"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  time: string;
  priority: "high" | "medium" | "low";
  read: boolean;
  labels: string[];
}

const mockEmails: Email[] = [
  { id: "e1", from: "Sarah Chen", subject: "Re: Q2 launch — need decision by EOD", body: "We're blocked on the pricing page copy. Marketing hasn't signed off. Can you get Alex to approve by EOD? Dev team is waiting and we'll miss Thursday's deploy.", time: "9:14 AM", priority: "high", read: false, labels: ["launch", "urgent"] },
  { id: "e2", from: "Marcus Rivera", subject: "Contract renewal — 30 day notice", body: "Your contract expires May 12th. Renewal terms attached. 5% discount for early renewal before April 25th.", time: "8:47 AM", priority: "high", read: false, labels: ["legal", "renewal"] },
  { id: "e3", from: "Dev Bot", subject: "[acme/frontend] PR #142 needs review", body: "PR #142 'feat: redesign checkout flow' opened by jdoe, awaiting your review. 3 files changed, +287 -41.", time: "Yesterday", priority: "medium", read: true, labels: ["github", "review"] },
  { id: "e4", from: "All Hands Invite", subject: "Q2 All Hands — Thursday 2pm", body: "Prepare a 3-minute update on your team's progress. Slides due Wednesday EOD.", time: "Yesterday", priority: "medium", read: true, labels: ["meeting"] },
  { id: "e5", from: "Priya Nair", subject: "Budget approval for new tooling", body: "Submitted tooling budget request ($12k annual for Datadog). Finance needs your sign-off before April 20th.", time: "Mon", priority: "low", read: true, labels: ["budget"] },
];

const priorityColors = {
  high: "text-red-400 bg-red-400/10 border-red-400/20",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  low: "text-muted-foreground bg-muted border-border",
};

interface GmailFeedProps {
  onContextChange?: (context: string) => void;
}

export function GmailFeed({ onContextChange }: GmailFeedProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  async function fetchEmails() {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/messages");
      const data = await res.json();
      if (data.connected && data.emails?.length > 0) {
        setConnected(true);
        setEmails(data.emails);
        onContextChange?.(buildContext(data.emails));
      } else {
        setConnected(false);
        setEmails(mockEmails);
        onContextChange?.(buildContext(mockEmails));
      }
    } catch {
      setConnected(false);
      setEmails(mockEmails);
      onContextChange?.(buildContext(mockEmails));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/gmail/messages", { method: "DELETE" });
    setConnected(false);
    setEmails(mockEmails);
    onContextChange?.(buildContext(mockEmails));
    setDisconnecting(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {connected ? (
            <><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-muted-foreground">Live from Gmail</span></>
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
            onClick={() => (window.location.href = "/api/auth/gmail")}>
            Connect Gmail
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
            {emails.map(email => (
              <div key={email.id} className={cn("px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer", !email.read && "border-l-2 border-l-primary")}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("font-medium text-sm", !email.read ? "text-foreground" : "text-muted-foreground")}>
                      {email.from}
                    </span>
                    <Badge variant="outline" className={cn("text-xs shrink-0", priorityColors[email.priority])}>
                      {email.priority}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{email.time}</span>
                </div>
                <p className={cn("text-sm mb-1 truncate", !email.read ? "font-medium" : "text-muted-foreground")}>
                  {email.subject}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{email.body}</p>
                {email.labels.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {email.labels.map(l => <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function buildContext(emails: Email[]): string {
  return emails.map(e =>
    `From: ${e.from} | Subject: ${e.subject} | Priority: ${e.priority} | Read: ${e.read} | Body: ${e.body}`
  ).join("\n");
}

// Static mock context export for SSR use
export const gmailContext = buildContext(mockEmails);
