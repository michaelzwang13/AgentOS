"use client";

import { useEffect, useRef, useState } from "react";
import type { Message, LinkupResult, TeachingMode } from "@/types";
import ModeSelector from "./ModeSelector";

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  highlightedText: string;
  mode: TeachingMode;
  slidesLoaded: boolean;
  onSend: (request: string) => void;
  onModeChange: (mode: TeachingMode) => void;
  onClearHighlight: () => void;
}

function parseResponse(content: string): {
  intro: string;
  fromSlides: string;
  additional: string;
  sources: string;
} {
  const fromSlidesMatch = content.match(
    /\*\*From the slides:\*\*\s*([\s\S]*?)(?=\*\*Additional context:\*\*|\*\*Sources used:\*\*|$)/i
  );
  const additionalMatch = content.match(
    /\*\*Additional context:\*\*\s*([\s\S]*?)(?=\*\*Sources used:\*\*|$)/i
  );
  const sourcesMatch = content.match(/\*\*Sources used:\*\*\s*([\s\S]*?)$/i);

  const afterIntro = content.search(/\*\*From the slides:\*\*/i);
  const intro = afterIntro > 0 ? content.slice(0, afterIntro).trim() : "";

  return {
    intro,
    fromSlides: fromSlidesMatch?.[1]?.trim() ?? "",
    additional: additionalMatch?.[1]?.trim() ?? "",
    sources: sourcesMatch?.[1]?.trim() ?? "",
  };
}

function SourceChips({ linkupResults }: { linkupResults?: LinkupResult[] }) {
  if (!linkupResults || linkupResults.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {linkupResults.flatMap((r) =>
        r.sources.slice(0, 2).map((s, i) => (
          <a
            key={`${r.query}-${i}`}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-700/50 text-xs text-purple-300 hover:bg-purple-800/40 transition-colors"
          >
            <span>🔗</span>
            <span className="truncate max-w-[150px]">{s.name}</span>
          </a>
        ))
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const { intro, fromSlides, additional, sources } = parseResponse(message.content);
  const hasStructure = fromSlides || additional || sources;

  if (!hasStructure) {
    return (
      <div className="max-w-[90%] bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>
    );
  }

  return (
    <div className="max-w-[90%] space-y-2">
      {intro && (
        <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
          {intro}
        </div>
      )}
      {fromSlides && (
        <div className="bg-gray-800/60 rounded-xl px-4 py-3 border-l-2 border-blue-500">
          <p className="text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wide">
            From the slides
          </p>
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{fromSlides}</p>
        </div>
      )}
      {additional && (
        <div className="bg-gray-800/60 rounded-xl px-4 py-3 border-l-2 border-green-500">
          <p className="text-xs font-semibold text-green-400 mb-1.5 uppercase tracking-wide">
            Additional context
          </p>
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{additional}</p>
        </div>
      )}
      {sources && (
        <div className="bg-gray-800/40 rounded-xl px-4 py-3 border-l-2 border-purple-500">
          <p className="text-xs font-semibold text-purple-400 mb-1.5 uppercase tracking-wide">
            Sources used
          </p>
          <p className="text-sm text-gray-400 whitespace-pre-wrap">{sources}</p>
          <SourceChips linkupResults={message.linkupResults} />
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({
  messages,
  isLoading,
  streamingContent,
  highlightedText,
  mode,
  slidesLoaded,
  onSend,
  onModeChange,
  onClearHighlight,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !slidesLoaded) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">
          AI Companion
        </h2>
        <ModeSelector mode={mode} onChange={onModeChange} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-2">
            <div className="text-3xl">🎓</div>
            <p className="text-sm">
              {slidesLoaded
                ? 'Select text or click "Teach this slide" to get started'
                : "Upload a PDF slide deck to begin"}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Streaming indicator */}
        {isLoading && (
          <div className="max-w-[90%] space-y-2">
            {streamingContent ? (
              <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {streamingContent}
                <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-xs text-gray-500">Thinking...</span>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-800 space-y-2">
        {highlightedText && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/30 border border-yellow-700/40 rounded-lg">
            <span className="text-xs text-yellow-400 font-medium">Selected:</span>
            <span className="text-xs text-yellow-200 truncate flex-1">
              &quot;{highlightedText}&quot;
            </span>
            <button
              onClick={onClearHighlight}
              className="text-yellow-500 hover:text-yellow-300 text-xs ml-1"
            >
              ×
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              slidesLoaded ? "Ask about this slide..." : "Upload slides first"
            }
            disabled={!slidesLoaded || isLoading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || !slidesLoaded || isLoading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
