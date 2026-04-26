import seedData from "../data/nevup_seed_dataset.json";
import { MetricsResponse, ProfileResponse, SessionSummary, Emotion } from "./types";

export function getSeedProfile(userId: string): ProfileResponse | null {
  if (userId === "empty-trader-id") {
    return {
      name: "Empty Trader",
      traderType: "Adaptive Trader",
      dominantPathologies: [],
      strengths: [],
      weaknesses: [],
      summary: "This is a test account with no trading history. All behavioral analytics will show empty states."
    };
  }
  const trader = seedData.traders.find((t) => t.userId === userId);
  if (!trader) return null;

  return {
    name: trader.name,
    traderType: trader.groundTruthPathologies[0] ? "Pathological Trader" : "Adaptive Trader",
    dominantPathologies: trader.groundTruthPathologies.map(p => ({
      pathology: p,
      confidence: 0.95,
      evidenceSessions: trader.sessions.map(s => s.sessionId),
      evidenceTrades: trader.sessions.flatMap(s => s.trades.map(t => t.tradeId))
    })),
    strengths: ["Historical Data Consistency", "Pattern Recognition"],
    summary: trader.description
  };
}

export function getSeedMetrics(userId: string): MetricsResponse | null {
  if (userId === "empty-trader-id") {
    return {
      userId,
      winRate: 0,
      winRateByEmotionalState: {},
      timeseries: [],
      planAdherenceScore: 0,
      revengeTrades: 0
    };
  }
  const trader = seedData.traders.find((t) => t.userId === userId);
  if (!trader) return null;

  const winRateByEmotionalState: Record<string, any> = {};
  const allTrades = trader.sessions.flatMap(s => s.trades);
  
  allTrades.forEach(t => {
    const emotion = t.emotionalState || "neutral";
    if (!winRateByEmotionalState[emotion]) {
      winRateByEmotionalState[emotion] = { wins: 0, losses: 0, winRate: 0 };
    }
    if (t.outcome === "win") winRateByEmotionalState[emotion].wins++;
    else winRateByEmotionalState[emotion].losses++;
  });

  Object.values(winRateByEmotionalState).forEach((stat: any) => {
    stat.winRate = stat.wins / (stat.wins + stat.losses || 1);
  });

  const totalWins = allTrades.filter(t => t.outcome === "win").length;

  return {
    userId,
    winRate: totalWins / (allTrades.length || 1),
    winRateByEmotionalState,
    timeseries: trader.sessions.map(s => ({
      bucket: s.date,
      tradeCount: s.tradeCount,
      winRate: s.winRate,
      pnl: s.totalPnl,
      sessionId: s.sessionId,
      avgPlanAdherence: 3.5 // Estimated fallback
    })),
    planAdherenceScore: trader.stats.avgPlanAdherence,
    revengeTrades: allTrades.filter(t => t.revengeFlag).length
  };
}

export function getSeedSession(sessionId: string): SessionSummary | null {
  for (const trader of seedData.traders) {
    const session = trader.sessions.find(s => s.sessionId === sessionId);
    if (session) return session as unknown as SessionSummary;
  }
  return null;
}
