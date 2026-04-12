"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS: Record<string, string[]> = {
  slack: [
    "What are the key blockers from today's messages?",
    "Summarize the most important discussions",
    "What action items need follow-up?",
  ],
  gmail: [
    "What emails need my attention today?",
    "Any urgent items I should respond to first?",
    "Summarize the highest priority threads",
  ],
  github: [
    "Which PRs need review most urgently?",
    "What issues are blocking a release?",
    "Give me a status summary of open PRs",
  ],
  global: [
    "What's my top priority right now?",
    "Any blockers I should know about?",
    "Give me a full briefing across all tools",
  ],
};

export function ChatPanel({ agentId, context }: { agentId: string; context?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, context, messages: next }),
    });

    if (!res.body) { setLoading(false); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text2 = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text2 += decoder.decode(value, { stream: true });
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: text2 };
        return updated;
      });
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <p className="text-xs font-medium">Ask the agent</p>
        <p className="text-xs text-muted-foreground">Query your data, get actionable answers</p>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground text-center mb-3">Try asking:</p>
            {(SUGGESTIONS[agentId] || SUGGESTIONS.global).map(s => (
              <button key={s} onClick={() => setInput(s)}
                className="w-full text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground">
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                }`}>
                  {m.content || (
                    <span className="flex gap-1 items-center">
                      {[0,150,300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask anything about your data..."
            className="resize-none text-sm min-h-[56px] max-h-[120px]"
            rows={2}
          />
          <Button onClick={send} disabled={!input.trim() || loading} size="sm" className="self-end">
            Send
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
