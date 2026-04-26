import { Emotion, MetricsResponse, SessionSummary } from "./types";

export const emotionLabel: Record<Emotion, string> = {
  calm: "Calm",
  anxious: "Anxious",
  greedy: "Greedy",
  fearful: "Fearful",
  neutral: "Neutral",
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatAsset(asset: string) {
  const map: Record<string, string> = {
    AAPL: "Apple",
    NVDA: "Nvidia",
    TSLA: "Tesla",
    MSFT: "Microsoft",
    AMZN: "Amazon",
    "BTC/USD": "Bitcoin",
    "ETH/USD": "Ethereum",
    "SOL/USD": "Solana",
  };
  return map[asset?.toUpperCase()] ?? asset;
}

export function currency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function percent(value: number | null | undefined, digits = 0) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

export function dateShort(input: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(input));
}

export function dateTimeShort(input: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(input));
}

export function normalizeDate(input: string | Date) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export function decodeJwtSub(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return "";
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(decoded) as { sub?: string };
    return data.sub ?? "";
  } catch {
    return "";
  }
}

export function decodeJwtName(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return "";
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(decoded) as { name?: string };
    return data.name ?? "";
  } catch {
    return "";
  }
}

export function describeDuration(start: string, end: string | null) {
  if (!end) return "Open";
  const minutes = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function deriveHeatmap(metrics: MetricsResponse, sessions: SessionSummary[]) {
  const sessionMap = new Map(sessions.map((s) => [normalizeDate(s.date), s.sessionId]));

  if (metrics.timeseries?.length) {
    const maxPnl = Math.max(1, ...metrics.timeseries.map((t) => Math.abs(t.pnl || 0)));
    return metrics.timeseries.map((t) => {
      const dateStr = normalizeDate(t.bucket);
      return {
        date: dateStr,
        score: Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (t.winRate || 0) * 60 + (((t.pnl || 0) / maxPnl + 1) / 2) * 30 + Math.min(t.tradeCount || 0, 10)
            )
          )
        ),
        sessionId: sessionMap.get(dateStr) ?? null,
      };
    });
  }

  const maxPnl = Math.max(1, ...sessions.map((s) => Math.abs(s.totalPnl)));
  return sessions.map((session) => ({
    date: normalizeDate(session.date),
    score: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          session.winRate * 60 + ((session.totalPnl / maxPnl + 1) / 2) * 30 + Math.min(session.tradeCount, 10)
        )
      )
    ),
    sessionId: session.sessionId,
  }));
}

// Trigger hot reload for decodeJwtName
