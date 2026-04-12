"use client";

import { useRef, useState, useCallback } from "react";
import type { Slide } from "@/types";

interface SlidePanelProps {
  slides: Slide[];
  currentIndex: number;
  onSlidesLoaded: (slides: Slide[]) => void;
  onIndexChange: (index: number) => void;
  onHighlight: (text: string) => void;
  onTeach: () => void;
}

async function extractSlidesFromPDF(file: File): Promise<Slide[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const slides: Slide[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const firstLine = text.split(/[.\n]/)[0].trim().slice(0, 60) || `Slide ${pageNum}`;

    slides.push({
      pageNumber: pageNum,
      text: text || "(No text content on this slide)",
      title: firstLine,
    });
  }

  return slides;
}

export default function SlidePanel({
  slides,
  currentIndex,
  onSlidesLoaded,
  onIndexChange,
  onHighlight,
  onTeach,
}: SlidePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentSlide = slides[currentIndex];

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".pdf")) {
        setError("Please upload a PDF file.");
        return;
      }
      setError("");
      setIsLoading(true);
      try {
        const extracted = await extractSlidesFromPDF(file);
        onSlidesLoaded(extracted);
      } catch (e) {
        console.error(e);
        setError("Failed to parse PDF. Make sure it contains selectable text.");
      } finally {
        setIsLoading(false);
      }
    },
    [onSlidesLoaded]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleMouseUp = () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length > 0) {
      onHighlight(selection);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">
          Slides
        </h2>
        {slides.length > 0 && (
          <span className="text-xs text-gray-400">
            {currentIndex + 1} / {slides.length}
          </span>
        )}
      </div>

      {/* Upload zone or slide content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {slides.length === 0 ? (
          <div
            className={`flex-1 flex flex-col items-center justify-center m-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              isDragging
                ? "border-blue-400 bg-blue-900/20"
                : "border-gray-600 hover:border-gray-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Parsing slides...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <div className="text-4xl">📄</div>
                <p className="text-sm font-medium text-gray-300">
                  Drop a PDF slide deck here
                </p>
                <p className="text-xs text-gray-500">or click to browse</p>
              </div>
            )}
            {error && (
              <p className="mt-3 text-xs text-red-400 px-4 text-center">{error}</p>
            )}
          </div>
        ) : (
          <>
            {/* Slide title */}
            <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
              <p className="text-xs text-blue-400 font-medium truncate">
                {currentSlide?.title}
              </p>
            </div>

            {/* Slide text — selectable */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 text-sm text-gray-200 leading-relaxed select-text cursor-text"
              onMouseUp={handleMouseUp}
            >
              <p className="whitespace-pre-wrap">{currentSlide?.text}</p>
            </div>

            {/* Navigation */}
            <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-2">
              <button
                onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() =>
                  onIndexChange(Math.min(slides.length - 1, currentIndex + 1))
                }
                disabled={currentIndex === slides.length - 1}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
              <button
                onClick={onTeach}
                className="ml-auto px-4 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 font-medium transition-colors"
              >
                Teach this slide
              </button>
            </div>

            {/* Re-upload */}
            <div className="px-4 pb-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Upload different PDF
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
