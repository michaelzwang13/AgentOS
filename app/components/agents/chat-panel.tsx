"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  agentId: string;
  placeholder?: string;
}

export function ChatPanel({ agentId, placeholder }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.body) {
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "" },
    ]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value, { stream: true });
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: assistantText };
        return updated;
      });
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">Ask the agent</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Query across your data, get actionable answers
        </p>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2 mt-4">
            <p className="text-xs text-muted-foreground text-center mb-2">Try asking:</p>
            {getSuggestions(agentId).map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground"
                  )}
                >
                  {msg.content || (
                    <span className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Ask anything about your data..."}
            className="resize-none text-sm min-h-[60px] max-h-[120px]"
            rows={2}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            size="sm"
            className="self-end"
          >
            Send
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function getSuggestions(agentId: string): string[] {
  const map: Record<string, string[]> = {
    inbox: [
      "What emails need my attention today?",
      "Draft a reply to the Q2 launch email",
      "Summarize the contract renewal situation",
    ],
    slack: [
      "What's the staging incident status?",
      "Any blockers I should know about?",
      "Summarize today's key discussions",
    ],
    github: [
      "Which PRs need review most urgently?",
      "What's blocking the checkout PR from merging?",
      "Summarize open bugs and their priority",
    ],
  };
  return map[agentId] || [
    "What's my top priority right now?",
    "Any blockers I should know about?",
    "Cross-reference everything and give me a briefing",
  ];
}
