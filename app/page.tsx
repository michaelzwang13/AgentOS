"use client";

import { useState, useCallback } from "react";
import SlidesViewer from "@/components/SlidesViewer";
import ChatPanel from "@/components/ChatPanel";
import type { Slide, Message, TeachingMode, LinkupResult, TeachRequest } from "@/types";

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [highlightedText, setHighlightedText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<TeachingMode>("Professor");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const handleSlidesLoaded = useCallback((loaded: Slide[]) => {
    setSlides(loaded);
    setCurrentIndex(0);
    setMessages([]);
    setHighlightedText("");
  }, []);

  const handleSend = useCallback(
    async (userRequest: string) => {
      if (!slides.length || isLoading) return;

      const currentSlide = slides[currentIndex];
      const nearby = [slides[currentIndex - 1], slides[currentIndex + 1]]
        .filter(Boolean)
        .map((s) => s.text)
        .join("\n\n");

      const userMessage: Message = { role: "user", content: userRequest };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent("");

      const body: TeachRequest = {
        slideText: currentSlide.text,
        slideTitle: currentSlide.title,
        slideNumber: currentSlide.pageNumber,
        highlightedText,
        userRequest,
        mode,
        nearbyContext: nearby,
      };

      try {
        const res = await fetch("/api/teach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) throw new Error("Request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";
        let linkupResults: LinkupResult[] = [];
        let metaParsed = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          if (!metaParsed && chunk.includes("__META__")) {
            const metaStart = chunk.indexOf("__META__") + "__META__".length;
            const newlineIdx = chunk.indexOf("\n", metaStart);
            const metaLine = chunk.slice(metaStart, newlineIdx > -1 ? newlineIdx : undefined);
            try {
              const meta = JSON.parse(metaLine);
              linkupResults = meta.linkupResults ?? [];
            } catch {
              // ignore parse errors
            }
            fullContent += newlineIdx > -1 ? chunk.slice(newlineIdx + 1) : "";
            metaParsed = true;
          } else {
            fullContent += chunk;
          }

          setStreamingContent(fullContent);
        }

        const assistantMessage: Message = {
          role: "assistant",
          content: fullContent,
          linkupResults,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setHighlightedText("");
      } catch (err) {
        console.error(err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, something went wrong. Please check your API keys and try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
        setStreamingContent("");
      }
    },
    [slides, currentIndex, highlightedText, mode, isLoading]
  );

  const handleTeach = useCallback(() => {
    handleSend(
      "Explain this slide like a professor. Identify what's likely to confuse a student and address it."
    );
  }, [handleSend]);

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Top bar */}
      <header className="flex items-center px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎓</span>
          <h1 className="font-bold text-white text-sm tracking-tight">
            AI Lecture Companion
          </h1>
        </div>
        <span className="ml-3 text-xs text-gray-500">
          Powered by Claude + Linkup
        </span>
      </header>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Visual slides (60%) */}
        <div className="w-[60%] border-r border-gray-800 overflow-hidden flex flex-col">
          <SlidesViewer
            currentIndex={currentIndex}
            onSlidesLoaded={handleSlidesLoaded}
            onIndexChange={setCurrentIndex}
            onHighlight={setHighlightedText}
            onTeach={handleTeach}
          />
        </div>

        {/* Right: Teaching chat (40%) */}
        <div className="w-[40%] overflow-hidden flex flex-col">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            streamingContent={streamingContent}
            highlightedText={highlightedText}
            mode={mode}
            slidesLoaded={slides.length > 0}
            onSend={handleSend}
            onModeChange={setMode}
            onClearHighlight={() => setHighlightedText("")}
          />
        </div>
      </div>
    </div>
  );
}
