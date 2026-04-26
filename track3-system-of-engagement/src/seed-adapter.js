import { PATHOLOGY_LABELS, SEED_DATA_PATH, STORAGE_KEYS } from "./config.js";
import {
  average,
  formatDate,
  groupBy,
  loadJson,
  rollingAverage,
  saveJson,
  sum,
} from "./utils.js";

let cachedDataset;

async function loadSeedDataset() {
  if (!cachedDataset) {
    const response = await fetch(SEED_DATA_PATH);
    if (!response.ok) {
      throw new Error(`Unable to load seed dataset from ${SEED_DATA_PATH}`);
    }
    cachedDataset = await response.json();
  }

  return cachedDataset;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function allTradesForTrader(trader) {
  return trader.sessions.flatMap((session) =>
    session.trades.map((trade) => ({ ...trade, sessionDate: session.date }))
  );
}

function getDebriefKey(sessionId) {
  return `${STORAGE_KEYS.debriefPrefix}${sessionId}`;
}

function loadDebrief(sessionId) {
  return loadJson(getDebriefKey(sessionId), null);
}

function saveDebrief(sessionId, payload) {
  saveJson(getDebriefKey(sessionId), payload);
}

function loadCreatedTrades() {
  return loadJson(STORAGE_KEYS.createdTrades, []);
}

function saveCreatedTrades(trades) {
  saveJson(STORAGE_KEYS.createdTrades, trades);
}

function getTraders(dataset) {
  return dataset.traders.map((trader) => {
    const trades = allTradesForTrader(trader);
    return {
      userId: trader.userId,
      name: trader.name,
      description: trader.description,
      stats: trader.stats,
      totalPnl: sum(trades.map((trade) => trade.pnl || 0)),
      sessions: trader.sessions.map((session) => ({
        sessionId: session.sessionId,
        date: session.date,
        tradeCount: session.tradeCount,
        winRate: session.winRate,
        totalPnl: session.totalPnl,
      })),
    };
  });
}

function findTrader(dataset, userId) {
  return dataset.traders.find((trader) => trader.userId === userId);
}

function findSession(dataset, sessionId) {
  for (const trader of dataset.traders) {
    const session = trader.sessions.find((entry) => entry.sessionId === sessionId);
    if (session) {
      return { trader, session };
    }
  }

  return null;
}

function findTrade(dataset, tradeId) {
  for (const trader of dataset.traders) {
    for (const session of trader.sessions) {
      const trade = session.trades.find((entry) => entry.tradeId === tradeId);
      if (trade) {
        return { trader, session, trade };
      }
    }
  }

  return null;
}

function computeTradePnl(payload) {
  const entryPrice = Number(payload.entryPrice);
  const exitPrice = Number(payload.exitPrice);
  const quantity = Number(payload.quantity);
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || !Number.isFinite(quantity)) {
    return null;
  }

  const direction = payload.direction === "short" ? "short" : "long";
  const multiplier = direction === "short" ? entryPrice - exitPrice : exitPrice - entryPrice;
  return Number((multiplier * quantity).toFixed(2));
}

function buildTradeRecord(payload) {
  const now = new Date().toISOString();
  const pnl =
    payload.status === "closed" && payload.exitPrice !== null && payload.exitPrice !== undefined
      ? computeTradePnl(payload)
      : null;

  return {
    ...payload,
    exitPrice: payload.exitPrice ?? null,
    exitAt: payload.exitAt ?? null,
    planAdherence: payload.planAdherence ?? null,
    emotionalState: payload.emotionalState ?? null,
    entryRationale: payload.entryRationale ?? null,
    outcome: pnl === null ? null : pnl >= 0 ? "win" : "loss",
    pnl,
    revengeFlag: false,
    createdAt: now,
    updatedAt: now,
  };
}

function getMetricRange(trader) {
  const trades = allTradesForTrader(trader);
  const sorted = trades.slice().sort((a, b) => new Date(a.entryAt) - new Date(b.entryAt));
  return {
    from: sorted[0]?.entryAt,
    to: sorted[sorted.length - 1]?.exitAt || sorted[sorted.length - 1]?.entryAt,
  };
}

function buildBucket(bucket, trades) {
  const wins = trades.filter((trade) => trade.outcome === "win").length;
  return {
    bucket,
    tradeCount: trades.length,
    winRate: wins / trades.length || 0,
    pnl: sum(trades.map((trade) => trade.pnl || 0)),
    avgPlanAdherence: average(trades.map((trade) => trade.planAdherence || 0)),
    _trades: trades,
  };
}

function buildTimeBuckets(trades, granularity) {
  if (!trades.length) {
    return [];
  }

  if (granularity === "hourly") {
    return [...groupBy(trades, (trade) => {
      const date = new Date(trade.entryAt);
      date.setMinutes(0, 0, 0);
      return date.toISOString();
    })]
      .map(([bucket, bucketTrades]) => buildBucket(bucket, bucketTrades))
      .sort((a, b) => new Date(a.bucket) - new Date(b.bucket));
  }

  if (granularity === "rolling30d") {
    const dailyBuckets = [...groupBy(trades, (trade) => {
      const date = new Date(trade.entryAt);
      date.setHours(0, 0, 0, 0);
      return date.toISOString();
    })]
      .map(([bucket, bucketTrades]) => buildBucket(bucket, bucketTrades))
      .sort((a, b) => new Date(a.bucket) - new Date(b.bucket));

    return dailyBuckets.map((bucket, index) => {
      const start = Math.max(0, index - 29);
      const windowTrades = dailyBuckets.slice(start, index + 1).flatMap((entry) => entry._trades);
      return buildBucket(bucket.bucket, windowTrades);
    });
  }

  return [...groupBy(trades, (trade) => {
    const date = new Date(trade.entryAt);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  })]
    .map(([bucket, bucketTrades]) => buildBucket(bucket, bucketTrades))
    .sort((a, b) => new Date(a.bucket) - new Date(b.bucket));
}

function computeSessionTiltIndex(sessions) {
  const scores = sessions.map((session) => {
    let lossSeen = false;
    let reactiveTrades = 0;
    session.trades.forEach((trade) => {
      if (lossSeen) {
        reactiveTrades += 1;
      }
      if (trade.outcome === "loss") {
        lossSeen = true;
      }
    });
    return reactiveTrades / Math.max(1, session.trades.length);
  });

  return average(scores);
}

function computeOvertradingEvents(sessions) {
  let total = 0;
  sessions.forEach((session) => {
    const sorted = session.trades
      .slice()
      .sort((a, b) => new Date(a.entryAt) - new Date(b.entryAt));
    for (let index = 3; index < sorted.length; index += 1) {
      const first = new Date(sorted[index - 3].entryAt);
      const current = new Date(sorted[index].entryAt);
      if ((current - first) / 60000 <= 30) {
        total += 1;
      }
    }
  });
  return total;
}

function detectEvidence(trader, pathology) {
  const sessions = trader.sessions;
  const trades = allTradesForTrader(trader);

  const tradeMatchers = {
    revenge_trading: (trade) => trade.revengeFlag,
    fomo_entries: (trade) =>
      trade.emotionalState === "greedy" ||
      /chase|breakout|late/i.test(trade.entryRationale || "") ||
      (trade.planAdherence || 0) <= 2,
    plan_non_adherence: (trade) => (trade.planAdherence || 0) <= 2,
    premature_exit: (trade) =>
      trade.outcome === "win" &&
      trade.exitAt &&
      (new Date(trade.exitAt) - new Date(trade.entryAt)) / 60000 <= 20,
    loss_running: (trade) =>
      trade.outcome === "loss" &&
      trade.exitAt &&
      (new Date(trade.exitAt) - new Date(trade.entryAt)) / 60000 >= 120,
    time_of_day_bias: (trade) => {
      const hour = new Date(trade.entryAt).getUTCHours();
      return hour < 11 || hour >= 18;
    },
    position_sizing_inconsistency: (trade, allTraderTrades) => {
      const quantities = allTraderTrades.map((entry) => Number(entry.quantity) || 0);
      const mean = average(quantities);
      const variance = average(quantities.map((qty) => (qty - mean) ** 2));
      const deviation = Math.sqrt(variance);
      return Math.abs((Number(trade.quantity) || 0) - mean) > deviation;
    },
  };

  const sessionMatchers = {
    revenge_trading: (session) => session.trades.some((trade) => trade.revengeFlag),
    overtrading: (session) => session.tradeCount >= 8 || computeOvertradingEvents([session]) > 0,
    fomo_entries: (session) => session.trades.some((trade) => tradeMatchers.fomo_entries(trade)),
    plan_non_adherence: (session) => session.trades.some((trade) => tradeMatchers.plan_non_adherence(trade)),
    premature_exit: (session) => session.trades.some((trade) => tradeMatchers.premature_exit(trade)),
    loss_running: (session) => session.trades.some((trade) => tradeMatchers.loss_running(trade)),
    session_tilt: (session) => {
      const lossFirstHalf = session.trades.slice(0, 2).some((trade) => trade.outcome === "loss");
      const revengeCount = session.trades.filter((trade) => trade.revengeFlag).length;
      return lossFirstHalf && revengeCount >= 1;
    },
    time_of_day_bias: (session) => session.trades.some((trade) => tradeMatchers.time_of_day_bias(trade)),
    position_sizing_inconsistency: (session) =>
      session.trades.some((trade) => tradeMatchers.position_sizing_inconsistency(trade, trades)),
  };

  const tradeMatcher =
    pathology === "position_sizing_inconsistency"
      ? (trade) => tradeMatchers.position_sizing_inconsistency(trade, trades)
      : tradeMatchers[pathology] || (() => false);

  const sessionMatcher = sessionMatchers[pathology] || (() => false);
  const evidenceTrades = trades.filter((trade) => tradeMatcher(trade)).slice(0, 4);
  const evidenceSessions = sessions.filter((session) => sessionMatcher(session)).slice(0, 3);

  return {
    evidenceTrades: evidenceTrades.map((trade) => trade.tradeId),
    evidenceSessions: evidenceSessions.map((session) => session.sessionId),
    confidence: Math.min(0.98, 0.56 + evidenceTrades.length * 0.08 + evidenceSessions.length * 0.06),
  };
}

function computePeakWindow(trader) {
  const trades = allTradesForTrader(trader);
  if (!trades.length) {
    return null;
  }

  const hourlyGroups = [...groupBy(trades, (trade) => new Date(trade.entryAt).getUTCHours())].map(
    ([hour, hourTrades]) => ({
      hour: Number(hour),
      trades: hourTrades,
      winRate: hourTrades.filter((trade) => trade.outcome === "win").length / hourTrades.length,
    })
  );

  let best = null;
  for (let hour = 0; hour < 24; hour += 1) {
    const windowHours = [hour, (hour + 1) % 24];
    const windowTrades = hourlyGroups
      .filter((group) => windowHours.includes(group.hour))
      .flatMap((group) => group.trades);
    if (windowTrades.length < 2) {
      continue;
    }
    const winRate =
      windowTrades.filter((trade) => trade.outcome === "win").length / windowTrades.length;
    if (!best || winRate > best.winRate) {
      best = { startHour: hour, endHour: (hour + 2) % 24, winRate };
    }
  }

  return best;
}

function computeStrengths(trader) {
  const trades = allTradesForTrader(trader);
  const calmTrades = trades.filter((trade) => trade.emotionalState === "calm");
  const calmWinRate =
    calmTrades.filter((trade) => trade.outcome === "win").length / Math.max(1, calmTrades.length);
  const highAdherence = trades.filter((trade) => (trade.planAdherence || 0) >= 4).length;
  const positiveSessions = trader.sessions.filter((session) => session.totalPnl > 0).length;

  const strengths = [];
  if (calmTrades.length) {
    strengths.push(
      `When calm, ${trader.name.split(" ")[0]} wins ${Math.round(calmWinRate * 100)}% of tracked trades.`
    );
  }
  if (highAdherence) {
    strengths.push(`${highAdherence} trades show disciplined execution with plan adherence of 4 or 5.`);
  }
  if (positiveSessions) {
    strengths.push(
      `${positiveSessions} sessions finish net positive, which gives the coach a repeatable baseline to reinforce.`
    );
  }

  return strengths.slice(0, 3);
}

function computeMetrics(trader, { from, to, granularity }) {
  const allTrades = allTradesForTrader(trader)
    .filter((trade) => !from || new Date(trade.entryAt) >= new Date(from))
    .filter((trade) => !to || new Date(trade.entryAt) <= new Date(to))
    .sort((a, b) => new Date(a.entryAt) - new Date(b.entryAt));

  const winRateByEmotionalState = {};
  allTrades.forEach((trade) => {
    const key = trade.emotionalState || "neutral";
    if (!winRateByEmotionalState[key]) {
      winRateByEmotionalState[key] = { wins: 0, losses: 0, winRate: 0 };
    }
    if (trade.outcome === "win") {
      winRateByEmotionalState[key].wins += 1;
    } else if (trade.outcome === "loss") {
      winRateByEmotionalState[key].losses += 1;
    }
  });

  Object.values(winRateByEmotionalState).forEach((entry) => {
    const total = entry.wins + entry.losses;
    entry.winRate = total ? entry.wins / total : 0;
  });

  const timeseries = buildTimeBuckets(allTrades, granularity).map(({ _trades, ...bucket }) => bucket);
  const adherenceSeries = rollingAverage(allTrades, 10, (trade) => trade.planAdherence || 0);
  const recentSessions = trader.sessions.filter((session) => {
    const date = new Date(session.date);
    return (!from || date >= new Date(from)) && (!to || date <= new Date(to));
  });

  return {
    userId: trader.userId,
    granularity,
    from,
    to,
    planAdherenceScore: adherenceSeries[adherenceSeries.length - 1] || 0,
    sessionTiltIndex: computeSessionTiltIndex(recentSessions),
    winRateByEmotionalState,
    revengeTrades: allTrades.filter((trade) => trade.revengeFlag).length,
    overtradingEvents: computeOvertradingEvents(recentSessions),
    timeseries,
  };
}

function buildProfile(trader) {
  const dominantPathologies = trader.groundTruthPathologies.map((pathology) => {
    const evidence = detectEvidence(trader, pathology);
    return {
      pathology,
      confidence: evidence.confidence,
      evidenceSessions: evidence.evidenceSessions,
      evidenceTrades: evidence.evidenceTrades,
    };
  });

  return {
    userId: trader.userId,
    generatedAt: new Date().toISOString(),
    dominantPathologies,
    strengths: computeStrengths(trader),
    peakPerformanceWindow: computePeakWindow(trader),
    summary: `${trader.name} is primarily exhibiting ${PATHOLOGY_LABELS[
      trader.groundTruthPathologies[0]
    ].toLowerCase()}, with evidence drawn from ${
      dominantPathologies[0]?.evidenceSessions.length || 0
    } sessions.`,
  };
}

function buildCoachingMessage(session, profile, metrics, trader) {
  const dominant = profile.dominantPathologies[0];
  const topEmotion =
    Object.entries(metrics.winRateByEmotionalState).sort((a, b) => b[1].losses - a[1].losses)[0]?.[0] ||
    "neutral";
  const strongest =
    profile.strengths[0] || `${trader.name.split(" ")[0]} still has a recoverable process edge.`;

  return [
    `${trader.name}, this session closed at ${session.totalPnl >= 0 ? "a gain" : "a loss"} of ${session.totalPnl.toFixed(2)} with a ${Math.round(session.winRate * 100)}% win rate.`,
    `The strongest behavior signal remains ${PATHOLOGY_LABELS[dominant.pathology].toLowerCase()}, backed by ${dominant.evidenceTrades.length} evidence trades.`,
    `Loss pressure was most visible during ${topEmotion} states, so the next intervention is to slow entries immediately after a losing close and restage your checklist before the next position.`,
    strongest,
    "For the next session, cap rapid follow-up trades, prioritize A-grade setups only, and review this debrief before the open.",
  ].join(" ");
}

export async function createSeedAdapter() {
  const dataset = await loadSeedDataset();

  return {
    async listTraders() {
      return clone(getTraders(dataset));
    },

    async getTraderRange(userId) {
      const trader = findTrader(dataset, userId);
      return clone(getMetricRange(trader));
    },

    async getSession(sessionId) {
      const result = findSession(dataset, sessionId);
      if (!result) {
        throw new Error("Session not found in seed dataset");
      }

      const session = clone(result.session);
      session.savedDebrief = loadDebrief(sessionId);
      session.userName = result.trader.name;
      return session;
    },

    async getTrade(tradeId) {
      const createdTrade = loadCreatedTrades().find((trade) => trade.tradeId === tradeId);
      if (createdTrade) {
        return clone(createdTrade);
      }

      const result = findTrade(dataset, tradeId);
      if (!result) {
        throw new Error("Trade not found in seed dataset");
      }

      return clone(result.trade);
    },

    async createTrade(payload) {
      const createdTrades = loadCreatedTrades();
      const storedTrade = createdTrades.find((trade) => trade.tradeId === payload.tradeId);
      if (storedTrade) {
        return clone(storedTrade);
      }

      const seedTrade = findTrade(dataset, payload.tradeId);
      if (seedTrade) {
        return clone(seedTrade.trade);
      }

      const trade = buildTradeRecord(payload);
      createdTrades.push(trade);
      saveCreatedTrades(createdTrades);
      return clone(trade);
    },

    async getMetrics(userId, query) {
      const trader = findTrader(dataset, userId);
      return clone(computeMetrics(trader, query));
    },

    async getProfile(userId) {
      const trader = findTrader(dataset, userId);
      return clone(buildProfile(trader));
    },

    async submitDebrief(sessionId, payload) {
      const submission = {
        ...payload,
        savedAt: new Date().toISOString(),
      };
      saveDebrief(sessionId, submission);
      return clone({ status: "saved", sessionId, ...submission });
    },

    async buildCoachingPayload(sessionId) {
      const result = findSession(dataset, sessionId);
      if (!result) {
        throw new Error("Unable to prepare coaching message");
      }

      const trader = result.trader;
      const range = getMetricRange(trader);
      const metrics = computeMetrics(trader, {
        from: range.from,
        to: range.to,
        granularity: "daily",
      });
      const profile = buildProfile(trader);
      return {
        tokens: buildCoachingMessage(result.session, profile, metrics, trader)
          .split(/(\s+)/)
          .filter(Boolean),
      };
    },

    async getEvidenceLabel(sessionIds) {
      return sessionIds.map((sessionId) => {
        const result = findSession(dataset, sessionId);
        return result ? `${formatDate(result.session.date)} session` : sessionId;
      });
    },
  };
}
