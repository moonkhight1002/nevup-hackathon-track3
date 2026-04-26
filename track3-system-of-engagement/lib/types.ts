export type Emotion = "calm" | "anxious" | "greedy" | "fearful" | "neutral";

export type Trade = {
  tradeId: string;
  userId: string;
  sessionId: string;
  asset: string;
  direction: "long" | "short";
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  entryAt: string;
  exitAt: string | null;
  pnl: number | null;
  entryRationale?: string;
  exitRationale?: string;
  emotionalState?: Emotion;
  planAdherence?: number | null;
};

export type SessionSummary = {
  sessionId: string;
  userId: string;
  date: string;
  summary?: string;
  notes?: string;
  tradeCount: number;
  winRate: number;
  totalPnl: number;
  trades: Trade[];
};

export type EmotionalStatsEntry = {
  wins: number;
  losses: number;
  winRate: number;
};

export type HeatmapPoint = {
  date: string;
  score: number;
  sessionId: string | null;
};

export type MetricsResponse = {
  heatmap?: HeatmapPoint[];
  winRate?: number;
  emotionalStats?: Record<string, EmotionalStatsEntry>;
  streaks?: {
    currentWin?: number;
    currentLoss?: number;
    bestWin?: number;
  };
  behaviorSignals?: string[];
  userId?: string;
  planAdherenceScore?: number;
  sessionTiltIndex?: number;
  winRateByEmotionalState?: Record<string, EmotionalStatsEntry>;
  revengeTrades?: number;
  overtradingEvents?: number;
  timeseries?: Array<{
    bucket: string;
    tradeCount: number;
    pnl: number;
    winRate?: number;
    sessionId?: string;
  }>;
};

export type ProfileResponse = {
  name?: string;
  traderType?: string;
  pathology?: string;
  strengths?: string[];
  weaknesses?: string[];
  peakPerformanceWindow?: {
    startHour?: number;
    endHour?: number;
    winRate?: number;
  } | null;
  dominantPathologies?: Array<{
    pathology: string;
    confidence: number;
    evidenceSessions: string[];
    evidenceTrades: string[];
  }>;
  summary?: string;
};

export type DebriefRequest = {
  takeaway: string;
  emotions: Array<{ tradeId: string; emotion: Emotion }>;
  ratings: Array<{ tradeId: string; rating: number }>;
  overallMood?: Emotion;
  keyMistake?: string | null;
  keyLesson?: string | null;
  planAdherenceRating?: number;
  willReviewTomorrow?: boolean;
};
