"use client";

import dynamic from "next/dynamic";

const Chart = dynamic(
  () => import("./EmotionChartClient").then((mod) => mod.EmotionChartClient),
  { ssr: false }
);

type Item = {
  emotion: string;
  wins: number;
  losses: number;
};

export function EmotionChart({ data }: { data: Item[] }) {
  return <Chart data={data} />;
}
