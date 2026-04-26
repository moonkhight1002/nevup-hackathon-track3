"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Item = {
  emotion: string;
  wins: number;
  losses: number;
};

export function EmotionChartClient({ data }: { data: Item[] }) {
  return (
    <div className="glass-card h-[320px] flex flex-col rounded-xl p-4">
      <p className="mb-2 text-xs font-mono uppercase tracking-[0.2em] text-accent/80">[ EMOTIONAL ANALYTICS ]</p>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="emotion" stroke="#64748b" tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip
              contentStyle={{
                background: "#000",
                border: "1px solid #4ade80",
                borderRadius: 4,
                fontFamily: "monospace",
                color: "#4ade80",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px", fontFamily: "monospace", fontSize: "12px", color: "#94a3b8" }} />
            <Bar dataKey="wins" fill="#4ade80" radius={[2, 2, 0, 0]} />
            <Bar dataKey="losses" fill="#FF0000" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
