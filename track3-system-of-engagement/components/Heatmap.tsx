"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { HeatmapPoint } from "@/lib/types";
import { dateShort, normalizeDate } from "@/lib/utils";

type Props = {
  points: HeatmapPoint[];
  onOpenSession: (sessionId: string) => void;
};

const CELL = 14;
const GAP = 5;

function scoreColor(score: number) {
  if (score === 0) return "rgba(10, 10, 10, 0.8)"; // Deep black/slate for 0/empty
  if (score >= 80) return "#4ade80"; // Bright neon green
  if (score >= 60) return "rgba(74, 222, 128, 0.7)"; // Dimmer green
  if (score >= 40) return "rgba(74, 222, 128, 0.4)"; // Faint green
  if (score >= 20) return "rgba(74, 222, 128, 0.2)"; // Very faint green
  return "rgba(255, 255, 255, 0.1)"; // Almost nothing
}

export function Heatmap({ points, onOpenSession }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const entries = useMemo(() => {
    if (!mounted) return [];
    const map = new Map(points.map((point) => [normalizeDate(point.date), point]));
    
    let maxTime = new Date().getTime();
    if (points.length > 0) {
      maxTime = Math.max(...points.map((p) => new Date(p.date).getTime()));
    }
    const latestDate = new Date(maxTime);
    latestDate.setHours(0, 0, 0, 0);

    const values: HeatmapPoint[] = [];
    for (let i = 89; i >= 0; i -= 1) {
      const day = new Date(latestDate);
      day.setDate(latestDate.getDate() - i);
      const key = normalizeDate(day);
      values.push(map.get(key) || { date: key, score: 0, sessionId: null });
    }
    return values;
  }, [points, mounted]);

  const width = 13 * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  return (
    <article className="glass-card rounded-xl p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent/80">[ 90-DAY HEATMAP ]</p>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[245px]"
          role="img"
          aria-label="Behavioral score heatmap"
        >
          {entries.map((point, idx) => {
            const week = Math.floor(idx / 7);
            const day = idx % 7;
            const x = week * (CELL + GAP);
            const y = day * (CELL + GAP);
            const interactive = Boolean(point.sessionId);
            return (
              <motion.rect
                key={idx}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, delay: idx * 0.002 }}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={4}
                fill={scoreColor(point.score)}
                stroke={hoveredIdx === idx ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)"}
                strokeWidth={hoveredIdx === idx ? 1.5 : 1}
                tabIndex={interactive ? 0 : -1}
                role={interactive ? "button" : "img"}
                aria-label={`${dateShort(point.date)} score ${point.score}${interactive ? ", open session" : ""}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
                onClick={() => point.sessionId && onOpenSession(point.sessionId)}
                onKeyDown={(event) => {
                  if (point.sessionId && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onOpenSession(point.sessionId);
                  }
                }}
                className={interactive ? "cursor-pointer" : undefined}
              />
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs font-mono uppercase text-slate-400">
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-white/10" /> lower
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-accent" /> higher
        </span>
      </div>

      <div className="mt-3 rounded-sm border border-slate-700/60 bg-[#050505] p-3 text-xs font-mono text-slate-300" aria-live="polite">
        {hoveredIdx !== null
          ? `${dateShort(entries[hoveredIdx].date)} score ${entries[hoveredIdx].score}${entries[hoveredIdx].sessionId ? " - click to open debrief" : ""}`
          : "Hover a day to inspect score and open linked sessions."}
      </div>
    </article>
  );
}
