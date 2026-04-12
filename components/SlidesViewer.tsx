"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { Slide } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDoc = any;

interface SlidesViewerProps {
  currentIndex: number;
  onSlidesLoaded: (slides: Slide[]) => void;
  onIndexChange: (index: number) => void;
  onHighlight: (text: string) => void;
  onTeach: () => void;
}

// ─── pdfjs loader ─────────────────────────────────────────────────────────────
async function getPdfJs() {
  const lib = await import("pdfjs-dist");
  if (!lib.GlobalWorkerOptions.workerSrc) {
    lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`;
  }
  return lib;
}

// ─── SlideCard ────────────────────────────────────────────────────────────────
interface SlideCardProps {
  pageNum: number;
  totalPages: number;
  pdfDoc: PDFDoc;
  isActive: boolean;
  renderWidth: number; // px — container width to scale canvas to
  onVisible: (pageNum: number) => void;
}

function SlideCard({
  pageNum,
  totalPages,
  pdfDoc,
  isActive,
  renderWidth,
  onVisible,
}: SlideCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  // Render once renderWidth is known
  useEffect(() => {
    if (renderedRef.current || !pdfDoc || !canvasRef.current || !textLayerRef.current) return;
    if (renderWidth <= 0) return;
    renderedRef.current = true;

    (async () => {
      const lib = await getPdfJs();
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current!;
      const textLayerDiv = textLayerRef.current!;

      // Scale to fill the full available width (no padding here — padding is on the wrapper)
      const base = page.getViewport({ scale: 1 });
      const scale = renderWidth / base.width;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;

      // Text layer — same dimensions as canvas
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      const { TextLayer } = lib;
      await new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayerDiv,
        viewport,
      }).render();
    })().catch(console.error);
  }, [pdfDoc, pageNum, renderWidth]);

  // Track which slide is most visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.4) onVisible(pageNum);
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pageNum, onVisible]);

  return (
    <div
      ref={containerRef}
      data-page={pageNum}
      className={`relative w-full rounded-xl overflow-hidden bg-white shadow-md transition-all duration-200 ${
        isActive
          ? "ring-2 ring-blue-500 shadow-blue-500/20"
          : "ring-1 ring-white/10 shadow-black/30"
      }`}
    >
      {/* Page badge */}
      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm text-xs text-white/80 select-none pointer-events-none">
        {pageNum} / {totalPages}
      </div>

      {/* Canvas — width set by JS, height follows naturally */}
      <canvas ref={canvasRef} className="block w-full" />

      {/* Selectable text layer */}
      <div ref={textLayerRef} className="pdfTextLayer" />
    </div>
  );
}

// ─── SlidesViewer ─────────────────────────────────────────────────────────────
export default function SlidesViewer({
  currentIndex,
  onSlidesLoaded,
  onIndexChange,
  onHighlight,
  onTeach,
}: SlidesViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDoc | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [renderWidth, setRenderWidth] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Measure inner width of the scroll container so slides scale to fit exactly
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setRenderWidth(entry.contentRect.width));
    ro.observe(el);
    setRenderWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [pdfDoc]); // re-attach after pdfDoc mounts the scroll div

  // ── PDF loading ──────────────────────────────────────────────────────────────
  const loadPDF = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a PDF file.");
        return;
      }
      setError("");
      setIsLoading(true);
      try {
        const lib = await getPdfJs();
        const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setFileName(file.name);

        // Extract text for all pages → Claude API
        const slides: Slide[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const tc = await page.getTextContent();
          const text = tc.items
            .map((item) => ("str" in item ? (item.str as string) : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          slides.push({
            pageNumber: p,
            text: text || "(No text)",
            title: text.split(/[.\n]/)[0].trim().slice(0, 60) || `Slide ${p}`,
          });
        }
        onSlidesLoaded(slides);
      } catch (e) {
        console.error(e);
        setError("Failed to parse PDF. Ensure it has selectable text.");
      } finally {
        setIsLoading(false);
      }
    },
    [onSlidesLoaded]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadPDF(f);
  };

  const handleMouseUp = () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel) onHighlight(sel);
  };

  const handleVisible = useCallback(
    (pageNum: number) => onIndexChange(pageNum - 1),
    [onIndexChange]
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-900">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-400 text-sm">📄</span>
          <span className="text-sm text-gray-300 font-medium truncate">
            {fileName || "Slides"}
          </span>
        </div>
        {totalPages > 0 && (
          <span className="text-xs text-gray-400 shrink-0 ml-2">
            {currentIndex + 1} / {totalPages}
          </span>
        )}
      </div>

      {/* Upload zone or slides */}
      {pdfDoc === null ? (
        <div
          className={`flex-1 flex flex-col items-center justify-center m-5 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
            isDragging
              ? "border-blue-400 bg-blue-900/10"
              : "border-gray-600 hover:border-gray-400 hover:bg-gray-800/30"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPDF(f); }}
          />
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Rendering slides…</p>
            </div>
          ) : (
            <div className="text-center space-y-2 px-6">
              <div className="text-4xl">📑</div>
              <p className="text-sm font-medium text-gray-300">Drop your PDF slide deck here</p>
              <p className="text-xs text-gray-500">or click to browse</p>
            </div>
          )}
          {error && <p className="mt-4 text-xs text-red-400 text-center">{error}</p>}
        </div>
      ) : (
        /* Vertical scroll strip — no horizontal padding so slides touch the edges */
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden select-text"
          onMouseUp={handleMouseUp}
        >
          <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <SlideCard
                key={pageNum}
                pageNum={pageNum}
                totalPages={totalPages}
                pdfDoc={pdfDoc}
                isActive={currentIndex === pageNum - 1}
                renderWidth={renderWidth > 0 ? renderWidth - 24 : 0} /* subtract gap/padding */
                onVisible={handleVisible}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {pdfDoc !== null && (
        <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-3 shrink-0">
          <button
            onClick={onTeach}
            className="flex-1 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 font-medium transition-colors text-white"
          >
            Teach this slide
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Change PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPDF(f); }}
          />
        </div>
      )}
    </div>
  );
}
