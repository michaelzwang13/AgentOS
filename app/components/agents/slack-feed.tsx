"use client";

import { useEffect, useState } from "react";
import { mockSlackMessages, SlackMessage } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const channelColors: Record<string, string> = {
  "#engineering": "text-blue-400 bg-blue-400/10",
  "#product": "text-purple-400 bg-purple-400/10",
  "#general": "text-green-400 bg-green-400/10",
  "#design": "text-pink-400 bg-pink-400/10",
};

function getChannelColor(channel: string) {
  return channelColors[channel] || "text-muted-foreground bg-muted";
}

interface SlackFeedProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function SlackFeed({ onConnectionChange }: SlackFeedProps) {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  async function fetchMessages() {
    setLoading(true);
    try {
      const res = await fetch("/api/slack/messages");
      const data = await res.json();
      if (data.connected) {
        setConnected(true);
        setMessages(data.messages);
        onConnectionChange?.(true);
      } else {
        setConnected(false);
        setMessages(mockSlackMessages);
        onConnectionChange?.(false);
      }
    } catch {
      setConnected(false);
      setMessages(mockSlackMessages);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/slack/messages", { method: "DELETE" });
    setConnected(false);
    setMessages(mockSlackMessages);
    onConnectionChange?.(false);
    setDisconnecting(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Live from Slack</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-xs text-muted-foreground">Using mock data</span>
            </>
          )}
        </div>
        {connected ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 text-muted-foreground"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-6"
            onClick={() => (window.location.href = "/api/auth/slack")}
          >
            Connect Slack
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {messages.map((msg) => (
              <div key={msg.id} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                <div className="flex gap-3">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="text-xs bg-accent">
                      {msg.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{msg.user}</span>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${getChannelColor(msg.channel)}`}
                      >
                        {msg.channel}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{msg.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{msg.text}</p>
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {msg.reactions.map((r) => (
                          <span
                            key={r.emoji}
                            className="text-xs bg-accent border border-border rounded-full px-2 py-0.5 flex items-center gap-1"
                          >
                            {r.emoji} <span className="text-muted-foreground">{r.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
