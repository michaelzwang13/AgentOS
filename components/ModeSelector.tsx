"use client";

import type { TeachingMode } from "@/types";

const MODES: TeachingMode[] = ["Professor", "Beginner", "Exam Prep", "Interview Prep"];

interface ModeSelectorProps {
  mode: TeachingMode;
  onChange: (mode: TeachingMode) => void;
}

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 font-medium">Mode:</span>
      <select
        value={mode}
        onChange={(e) => onChange(e.target.value as TeachingMode)}
        className="text-xs bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-gray-200 focus:outline-none focus:border-blue-400 cursor-pointer"
      >
        {MODES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
