import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
import { createApiClient } from "./api-client.js";
import { DEFAULT_API_BASE_URL, EMOTION_LABELS, PATHOLOGY_LABELS, STORAGE_KEYS } from "./config.js";
import { createSeedAdapter } from "./seed-adapter.js";
import {
  average,
  clamp,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
  loadJson,
  saveJson,
} from "./utils.js";

const html = htm.bind(React.createElement);

const settings = loadJson(STORAGE_KEYS.settings, {});

const defaultResource = { status: "idle", data: null, error: "" };
const stepAnimations = ["step-swipe", "step-lift", "step-zoom", "step-glow", "step-settle"];
const stepTitles = [
  "Trade replay",
  "Emotion tagging",
  "Plan adherence",
  "AI coaching",
  "Key takeaway",
];

function latestSessionId(sessions) {
  return sessions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.sessionId || "";
}

function normalizeDateKey(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function debriefDefaults(session) {
  const saved = session?.savedDebrief || {};
  const rating =
    saved.planAdherenceRating ||
    clamp(Math.round(average((session?.trades || []).map((trade) => Number(trade.planAdherence) || 3))), 1, 5) ||
    3;

  return {
    overallMood: saved.overallMood || "neutral",
    planAdherenceRating: String(rating),
    keyMistake: saved.keyMistake || "",
    keyLesson: saved.keyLesson || "",
    willReviewTomorrow: Boolean(saved.willReviewTomorrow),
    tradeEmotions: Object.fromEntries(
      (session?.trades || []).map((trade) => [trade.tradeId, saved.tradeEmotions?.[trade.tradeId] || trade.emotionalState || "neutral"])
    ),
  };
}

function getDebriefStorageKey(sessionId) {
  return `${STORAGE_KEYS.debriefPrefix}${sessionId}`;
}

function mergeStoredDebrief(session) {
  if (!session?.sessionId) {
    return session;
  }

  const stored = loadJson(getDebriefStorageKey(session.sessionId), null);
  if (!stored) {
    return session;
  }

  return {
    ...session,
    savedDebrief: {
      ...(session.savedDebrief || {}),
      ...stored,
    },
  };
}

function buildSavedDebrief(draft, savedResponse = {}) {
  return {
    ...savedResponse,
    overallMood: draft.overallMood,
    planAdherenceRating: Number(draft.planAdherenceRating),
    keyMistake: draft.keyMistake || null,
    keyLesson: draft.keyLesson || null,
    willReviewTomorrow: draft.willReviewTomorrow,
    tradeEmotions: { ...draft.tradeEmotions },
  };
}

function getStepTabId(sessionId, index) {
  return `debrief-tab-${sessionId}-${index}`;
}

function getStepPanelId(sessionId, index) {
  return `debrief-panel-${sessionId}-${index}`;
}

function getRatingId(sessionId, value) {
  return `debrief-rating-${sessionId}-${value}`;
}

function nextStepIndex(key, index, total) {
  if (key === "ArrowRight" || key === "ArrowDown") {
    return index === total - 1 ? 0 : index + 1;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return index === 0 ? total - 1 : index - 1;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return total - 1;
  }
  return index;
}

function nextRatingValue(key, value) {
  const current = Number(value) || 1;
  if (key === "ArrowRight" || key === "ArrowUp") {
    return clamp(current + 1, 1, 5);
  }
  if (key === "ArrowLeft" || key === "ArrowDown") {
    return clamp(current - 1, 1, 5);
  }
  if (key === "Home") {
    return 1;
  }
  if (key === "End") {
    return 5;
  }
  return current;
}

function resourceLoading() {
  return { status: "loading", data: null, error: "" };
}

function resourceSuccess(data) {
  return { status: "success", data, error: "" };
}

function resourceError(error) {
  return { status: "error", data: null, error: error?.message || String(error) };
}

function renderConnection(mode, liveFallbackActive, health) {
  if (mode === "live") {
    return liveFallbackActive
      ? { text: "Hybrid mode: seeded fallback in use", tone: "warn" }
      : { text: `Live API ${health?.status || "connected"}`, tone: "ok" };
  }
  return { text: "Demo data active", tone: "muted" };
}

function deriveTrigger(session, metrics) {
  if (session?.trades?.some((trade) => trade.revengeFlag)) {
    return "Losses followed by quick re-entry";
  }

  if ((metrics?.overtradingEvents || 0) >= 2) {
    return "Fast repeat entries";
  }

  if ((metrics?.planAdherenceScore || 0) <= 2.5) {
    return "Skipping the plan";
  }

  const topLossEmotion = Object.entries(metrics?.winRateByEmotionalState || {})
    .sort((a, b) => b[1].losses - a[1].losses)[0]?.[0];

  return topLossEmotion ? `${EMOTION_LABELS[topLossEmotion] || topLossEmotion} decision-making` : "Emotional drift";
}

function buildHeatmapEntries(trader) {
  if (!trader) {
    return [];
  }

  const sessions = trader.sessions || [];
  const maxAbsPnl = Math.max(1, ...sessions.map((session) => Math.abs(Number(session.totalPnl) || 0)));
  const sessionMap = new Map(
    sessions.map((session) => {
      const pnlScore = clamp((Number(session.totalPnl) || 0) / maxAbsPnl, -1, 1);
      const quality = clamp(
        Math.round((session.winRate * 0.5 + ((pnlScore + 1) / 2) * 0.3 + Math.min(session.tradeCount, 10) / 10 * 0.2) * 100),
        0,
        100
      );

      return [
        normalizeDateKey(session.date),
        {
          ...session,
          quality,
        },
      ];
    })
  );

  const entries = [];
  const latestSessionDate = sessions
    .map((session) => new Date(session.date))
    .sort((a, b) => b - a)[0];
  const today = latestSessionDate ? new Date(latestSessionDate) : new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = 89; index >= 0; index -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - index);
    const key = normalizeDateKey(day);
    entries.push({
      date: key,
      label: formatDate(key),
      session: sessionMap.get(key) || null,
    });
  }

  return entries;
}

function scoreColor(score) {
  if (score === null || score === undefined) {
    return "rgba(255,255,255,0.06)";
  }
  if (score >= 80) {
    return "#39ff14";
  }
  if (score >= 60) {
    return "#87e83b";
  }
  if (score >= 40) {
    return "#ffc107";
  }
  if (score >= 20) {
    return "#ff8f39";
  }
  return "#ff5d2a";
}

function LoadingSkeleton({ rows = 3 }) {
  return html`
    <div className="state-block" aria-live="polite">
      ${Array.from({ length: rows }, (_, index) =>
        html`<div key=${index} className="skeleton-line ${index === 0 ? "wide" : ""}"></div>`
      )}
    </div>
  `;
}

function ErrorState({ message, onRetry }) {
  return html`
    <div className="state-block error-state" role="alert">
      <strong>Could not load this section.</strong>
      <p>${message || "Something went wrong while fetching data."}</p>
      <button type="button" onClick=${onRetry}>Retry</button>
    </div>
  `;
}

function EmptyState({ title, body }) {
  return html`
    <div className="state-block empty-block">
      <strong>${title}</strong>
      <p>${body}</p>
    </div>
  `;
}

function MetricPanel({ metricsResource, onRetry, trader }) {
  if (metricsResource.status === "loading") {
    return html`<${LoadingSkeleton} rows=${4} />`;
  }
  if (metricsResource.status === "error") {
    return html`<${ErrorState} message=${metricsResource.error} onRetry=${onRetry} />`;
  }
  if (!metricsResource.data || !metricsResource.data.timeseries?.length) {
    return html`<${EmptyState} title="No metrics yet" body="Select a trader and session range to populate the dashboard." />`;
  }

  const metrics = metricsResource.data;
  const tradeCount = metrics.timeseries.reduce((total, bucket) => total + bucket.tradeCount, 0);
  const totalPnl = metrics.timeseries.reduce((total, bucket) => total + bucket.pnl, 0);
  const winCount = Object.values(metrics.winRateByEmotionalState).reduce((total, entry) => total + entry.wins, 0);
  const winRate = tradeCount ? winCount / tradeCount : 0;

  return html`
    <div className="dashboard-grid-react">
      <article className="metric-card-react">
        <span>Net P&L</span>
        <strong>${formatCurrency(totalPnl)}</strong>
        <small>${tradeCount} trades in range</small>
      </article>
      <article className="metric-card-react">
        <span>Win rate</span>
        <strong>${formatPercent(winRate)}</strong>
        <small>Across ${trader?.sessions?.length || 0} sessions</small>
      </article>
      <article className="metric-card-react">
        <span>Plan adherence</span>
        <strong>${metrics.planAdherenceScore.toFixed(1)}</strong>
        <small>Rolling 10-trade average</small>
      </article>
      <article className="metric-card-react">
        <span>Revenge trades</span>
        <strong>${String(metrics.revengeTrades)}</strong>
        <small>${metrics.overtradingEvents} overtrading events</small>
      </article>
    </div>
  `;
}

function HeatmapPanel({ trader, hovered, setHovered, onDayClick, status, error, onRetry }) {
  if (status === "loading") {
    return html`<${LoadingSkeleton} rows=${5} />`;
  }
  if (status === "error") {
    return html`<${ErrorState} message=${error} onRetry=${onRetry} />`;
  }
  if (!trader?.sessions?.length) {
    return html`<${EmptyState} title="No session history" body="Heatmap cells appear once a trader has recorded sessions in the selected range." />`;
  }

  const entries = buildHeatmapEntries(trader);
  const cell = 16;
  const gap = 6;
  const width = 13 * (cell + gap);
  const height = 7 * (cell + gap);

  return html`
    <div className="heatmap-wrap">
      <svg viewBox=${`0 0 ${width} ${height}`} className="heatmap-svg" role="img" aria-label="Daily trade quality heatmap">
        ${entries.map((entry, index) => {
          const week = Math.floor(index / 7);
          const day = index % 7;
          const x = week * (cell + gap);
          const y = day * (cell + gap);
          const session = entry.session;
          const score = session?.quality ?? null;
          return html`
            <rect
              key=${entry.date}
              x=${x}
              y=${y}
              width=${cell}
              height=${cell}
              rx="5"
              fill=${scoreColor(score)}
              stroke=${hovered?.date === entry.date ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.05)"}
              strokeWidth=${hovered?.date === entry.date ? 1.8 : 1}
              tabIndex=${session ? 0 : -1}
              role=${session ? "button" : "img"}
              aria-label=${session ? `${entry.label}, quality ${score}, open ${session.sessionId}` : `${entry.label}, no session`}
              onMouseEnter=${() => setHovered({ ...entry })}
              onMouseLeave=${() => setHovered(null)}
              onFocus=${() => session && setHovered({ ...entry })}
              onBlur=${() => setHovered(null)}
              onClick=${() => session && onDayClick(session.sessionId)}
              onKeyDown=${(event) => {
                if (session && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onDayClick(session.sessionId);
                }
              }}
            />
          `;
        })}
      </svg>

      <div className="heatmap-legend">
        <span><i style=${{ background: scoreColor(20) }}></i> lower quality</span>
        <span><i style=${{ background: scoreColor(80) }}></i> higher quality</span>
      </div>

      ${hovered?.session
        ? html`
            <div className="tooltip-card" role="status" aria-live="polite">
              <strong>${hovered.label}</strong>
              <p>${hovered.session.tradeCount} trades - ${formatPercent(hovered.session.winRate)} - ${formatCurrency(hovered.session.totalPnl)}</p>
              <p>Click to open that session in the debrief flow.</p>
            </div>
          `
        : html`
            <div className="tooltip-card empty-tip" role="status">
              Hover a filled day to inspect the session summary and click it to jump into the debrief flow.
            </div>
          `}
    </div>
  `;
}

function ProfilePanel({ profileResource, onRetry }) {
  if (profileResource.status === "loading") {
    return html`<${LoadingSkeleton} rows=${5} />`;
  }
  if (profileResource.status === "error") {
    return html`<${ErrorState} message=${profileResource.error} onRetry=${onRetry} />`;
  }
  if (!profileResource.data) {
    return html`<${EmptyState} title="No profile available" body="Profile insights appear once trader data is loaded." />`;
  }

  const profile = profileResource.data;
  return html`
    <div className="profile-stack-react">
      <p className="profile-generated">Generated ${formatDateTime(profile.generatedAt)}</p>
      <div className="pathology-list-react">
        ${profile.dominantPathologies.map(
          (entry) => html`
            <article key=${entry.pathology} className="pathology-card-react">
              <div className="subheading">
                <h4>${PATHOLOGY_LABELS[entry.pathology]}</h4>
                <span>${formatPercent(entry.confidence, 0)} confidence</span>
              </div>
              <div className="pill-row">
                ${entry.evidenceSessions.map((sessionId) => html`<span key=${sessionId} className="pill">${sessionId.slice(0, 8)}</span>`)}
                ${entry.evidenceTrades.map((tradeId) => html`<span key=${tradeId} className="pill">${tradeId.slice(0, 8)}</span>`)}
              </div>
            </article>
          `
        )}
      </div>
      <div className="profile-columns-react">
        <div>
          <h4>Strengths</h4>
          <ul className="plain-list">
            ${profile.strengths.map((item) => html`<li key=${item}>${item}</li>`)}
          </ul>
        </div>
        <div className="peak-card-react">
          <h4>Peak window</h4>
          ${profile.peakPerformanceWindow
            ? html`
                <strong>
                  ${profile.peakPerformanceWindow.startHour}:00 - ${profile.peakPerformanceWindow.endHour}:00 UTC
                </strong>
                <p>${formatPercent(profile.peakPerformanceWindow.winRate)} win rate in this band.</p>
              `
            : html`<p>No clear peak window available yet.</p>`}
        </div>
      </div>
    </div>
  `;
}

function SessionDetailPanel({ sessionResource, onRetry }) {
  if (sessionResource.status === "loading") {
    return html`<${LoadingSkeleton} rows=${6} />`;
  }
  if (sessionResource.status === "error") {
    return html`<${ErrorState} message=${sessionResource.error} onRetry=${onRetry} />`;
  }
  if (!sessionResource.data) {
    return html`<${EmptyState} title="No session selected" body="Choose a session to inspect trades and start the debrief flow." />`;
  }

  const session = sessionResource.data;
  return html`
    <div className="session-detail-react">
      <div className="dashboard-grid-react">
        <article className="metric-card-react compact">
          <span>Date</span>
          <strong>${formatDate(session.date)}</strong>
          <small>${session.userName || "Trader session"}</small>
        </article>
        <article className="metric-card-react compact">
          <span>Total P&L</span>
          <strong>${formatCurrency(session.totalPnl)}</strong>
          <small>${formatPercent(session.winRate)} win rate</small>
        </article>
        <article className="metric-card-react compact">
          <span>Trade count</span>
          <strong>${session.tradeCount}</strong>
          <small>${session.trades.length} trades loaded</small>
        </article>
      </div>

      <div className="trade-list-react">
        ${session.trades.map(
          (trade) => html`
            <article key=${trade.tradeId} className="trade-card-react">
              <div className="subheading">
                <h4>${trade.asset}</h4>
                <span>${formatCurrency(trade.pnl)}</span>
              </div>
              <p>${trade.direction} - ${EMOTION_LABELS[trade.emotionalState] || trade.emotionalState || "Neutral"} - adherence ${trade.planAdherence ?? "N/A"}</p>
              <small>${trade.entryRationale || "No rationale captured."}</small>
            </article>
          `
        )}
      </div>
    </div>
  `;
}

function TradeApiPanel({
  client,
  mode,
  apiBaseUrl,
  token,
  selectedTrade,
  onFallback,
  onLiveState,
}) {
  const [tradeId, setTradeId] = useState(selectedTrade?.tradeId || "");
  const [payloadText, setPayloadText] = useState(selectedTrade ? JSON.stringify({
    tradeId: selectedTrade.tradeId,
    userId: selectedTrade.userId,
    sessionId: selectedTrade.sessionId,
    asset: selectedTrade.asset,
    assetClass: selectedTrade.assetClass,
    direction: selectedTrade.direction,
    entryPrice: selectedTrade.entryPrice,
    exitPrice: selectedTrade.exitPrice ?? null,
    quantity: selectedTrade.quantity,
    entryAt: selectedTrade.entryAt,
    exitAt: selectedTrade.exitAt ?? null,
    status: selectedTrade.status,
    planAdherence: selectedTrade.planAdherence ?? null,
    emotionalState: selectedTrade.emotionalState ?? null,
    entryRationale: selectedTrade.entryRationale ?? null,
  }, null, 2) : "");
  const [result, setResult] = useState("Choose a trade from the active session to verify trade endpoints.");
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    if (!selectedTrade) {
      setTradeId("");
      setPayloadText("");
      return;
    }

    setTradeId(selectedTrade.tradeId);
    setPayloadText(JSON.stringify({
      tradeId: selectedTrade.tradeId,
      userId: selectedTrade.userId,
      sessionId: selectedTrade.sessionId,
      asset: selectedTrade.asset,
      assetClass: selectedTrade.assetClass,
      direction: selectedTrade.direction,
      entryPrice: selectedTrade.entryPrice,
      exitPrice: selectedTrade.exitPrice ?? null,
      quantity: selectedTrade.quantity,
      entryAt: selectedTrade.entryAt,
      exitAt: selectedTrade.exitAt ?? null,
      status: selectedTrade.status,
      planAdherence: selectedTrade.planAdherence ?? null,
      emotionalState: selectedTrade.emotionalState ?? null,
      entryRationale: selectedTrade.entryRationale ?? null,
    }, null, 2));
  }, [selectedTrade]);

  async function handleFetch() {
    if (!tradeId.trim()) {
      setStatus("Enter a trade ID first");
      return;
    }

    let usedFallback = false;
    setStatus("Fetching trade...");
    try {
      const trade = await client.getTrade({
        baseUrl: apiBaseUrl,
        tradeId: tradeId.trim(),
        token,
        mode,
        onFallback: () => {
          usedFallback = true;
          onFallback();
        },
      });
      setResult(JSON.stringify(trade, null, 2));
      setStatus(usedFallback ? "Returned from seeded fallback" : "Trade fetched");
      onLiveState(usedFallback);
    } catch (error) {
      setStatus("Fetch failed");
      setResult(error.message || "Unable to fetch the trade.");
    }
  }

  async function handleSubmit() {
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setStatus("Payload JSON is invalid");
      return;
    }

    let usedFallback = false;
    setStatus("Submitting trade...");
    try {
      const trade = await client.createTrade({
        baseUrl: apiBaseUrl,
        token,
        mode,
        payload,
        onFallback: () => {
          usedFallback = true;
          onFallback();
        },
      });
      setResult(JSON.stringify(trade, null, 2));
      setTradeId(trade.tradeId);
      setStatus(usedFallback ? "Saved through seeded fallback" : "Trade submitted");
      onLiveState(usedFallback);
    } catch (error) {
      setStatus("Submit failed");
      setResult(error.message || "Unable to submit the trade.");
    }
  }

  return html`
    <div className="trade-api-react">
      <div className="trade-api-grid">
        <label className="field">
          <span>Trade ID</span>
          <input value=${tradeId} onChange=${(event) => setTradeId(event.target.value)} placeholder="Paste a tradeId" />
        </label>
      </div>
      <label className="field">
        <span>Trade payload</span>
        <textarea rows="9" value=${payloadText} onChange=${(event) => setPayloadText(event.target.value)}></textarea>
      </label>
      <div className="button-row">
        <button type="button" onClick=${handleFetch}>Fetch trade</button>
        <button type="button" className="ghost-button" onClick=${handleSubmit}>Submit trade</button>
        <span className="status-copy">${status}</span>
      </div>
      <div className="trade-result"><pre>${result}</pre></div>
    </div>
  `;
}

function DebriefFlow({
  sessionResource,
  draft,
  setDraft,
  activeStep,
  setActiveStep,
  coachingState,
  startCoaching,
  stopCoaching,
  submitDebrief,
  submitState,
  sessionRetry,
}) {
  const stepRef = useRef(null);

  useEffect(() => {
    stepRef.current?.focus();
  }, [activeStep]);

  useEffect(() => {
    if (activeStep === 3 && !coachingState.message && coachingState.status === "Idle") {
      startCoaching();
    }
  }, [activeStep]);

  if (sessionResource.status === "loading") {
    return html`<${LoadingSkeleton} rows=${8} />`;
  }
  if (sessionResource.status === "error") {
    return html`<${ErrorState} message=${sessionResource.error} onRetry=${sessionRetry} />`;
  }
  if (!sessionResource.data) {
    return html`<${EmptyState} title="Debrief ready when a session is selected" body="Pick a session from the heatmap or selector to start the 5-step review flow." />`;
  }

  const session = sessionResource.data;
  const animationClass = stepAnimations[activeStep] || stepAnimations[0];
  const trades = session.trades || [];
  const activeTabId = getStepTabId(session.sessionId, activeStep);
  const activePanelId = getStepPanelId(session.sessionId, activeStep);

  return html`
    <div className="debrief-shell">
      <div className="stepper-row" role="tablist" aria-label="Debrief steps">
        ${stepTitles.map((title, index) => html`
          <button
            key=${title}
            type="button"
            className=${`step-chip ${index === activeStep ? "active" : ""}`}
            id=${getStepTabId(session.sessionId, index)}
            role="tab"
            aria-selected=${index === activeStep}
            aria-controls=${getStepPanelId(session.sessionId, index)}
            tabIndex=${index === activeStep ? 0 : -1}
            onClick=${() => setActiveStep(index)}
            onKeyDown=${(event) => {
              const nextIndex = nextStepIndex(event.key, index, stepTitles.length);
              if (nextIndex === index) {
                return;
              }
              event.preventDefault();
              setActiveStep(nextIndex);
              requestAnimationFrame(() => {
                document.getElementById(getStepTabId(session.sessionId, nextIndex))?.focus();
              });
            }}
          >
            <span>${index + 1}</span> ${title}
          </button>
        `)}
      </div>

      <section
        key=${`${session.sessionId}-${activeStep}`}
        ref=${stepRef}
        id=${activePanelId}
        role="tabpanel"
        tabIndex="-1"
        className=${`step-pane ${animationClass}`}
        aria-labelledby=${activeTabId}
      >
        <div className="subheading">
          <h4 id="debrief-step-title">${stepTitles[activeStep]}</h4>
          <span>${formatDate(session.date)}</span>
        </div>

        ${activeStep === 0 && (trades.length
          ? html`
              <div className="replay-list">
                ${trades.map((trade, index) => html`
                  <article key=${trade.tradeId} className="replay-card">
                    <strong>Trade ${index + 1}: ${trade.asset}</strong>
                    <p>${trade.direction} - ${formatCurrency(trade.pnl)} - ${trade.entryRationale || "No rationale recorded"}</p>
                  </article>
                `)}
              </div>
            `
          : html`<${EmptyState} title="No trades recorded" body="This session has no trades to replay yet." />`)}

        ${activeStep === 1 && (trades.length
          ? html`
              <div className="emotion-grid">
                ${trades.map((trade, index) => html`
                  <label key=${trade.tradeId} className="field">
                    <span>Trade ${index + 1} - ${trade.asset}</span>
                    <select
                      value=${draft.tradeEmotions[trade.tradeId] || "neutral"}
                      onChange=${(event) =>
                        setDraft((current) => ({
                          ...current,
                          tradeEmotions: {
                            ...current.tradeEmotions,
                            [trade.tradeId]: event.target.value,
                          },
                        }))}
                    >
                      ${Object.entries(EMOTION_LABELS).map(([value, label]) => html`<option key=${value} value=${value}>${label}</option>`)}
                    </select>
                  </label>
                `)}
              </div>
            `
          : html`<${EmptyState} title="Nothing to tag yet" body="Emotion tagging activates once the session contains trades." />`)}

        ${activeStep === 2 && html`
          <div className="rating-stage">
            <p>Rate how well the trader followed the plan across this session.</p>
            <div className="rating-row" role="radiogroup" aria-label="Plan adherence">
              ${[1, 2, 3, 4, 5].map((value) => html`
                <button
                  key=${value}
                  id=${getRatingId(session.sessionId, value)}
                  type="button"
                  className=${`rating-pill ${String(value) === draft.planAdherenceRating ? "active" : ""}`}
                  role="radio"
                  aria-checked=${String(value) === draft.planAdherenceRating}
                  tabIndex=${String(value) === draft.planAdherenceRating ? 0 : -1}
                  onClick=${() => setDraft((current) => ({ ...current, planAdherenceRating: String(value) }))}
                  onKeyDown=${(event) => {
                    const nextValue = nextRatingValue(event.key, value);
                    if (nextValue === value) {
                      return;
                    }
                    event.preventDefault();
                    setDraft((current) => ({ ...current, planAdherenceRating: String(nextValue) }));
                    requestAnimationFrame(() => {
                      document.getElementById(getRatingId(session.sessionId, nextValue))?.focus();
                    });
                  }}
                >
                  ${value}
                </button>
              `)}
            </div>
          </div>
        `}

        ${activeStep === 3 && html`
          <div className="coach-stage">
            <div className="button-row">
              <button type="button" onClick=${startCoaching}>Start coaching stream</button>
              <button type="button" className="ghost-button" onClick=${stopCoaching}>Stop</button>
              <span className="status-copy">${coachingState.status}</span>
            </div>
            <div className="coaching-message flow-message">
              ${coachingState.message || "The AI coaching step streams token-by-token here as soon as you start the flow."}
            </div>
          </div>
        `}

        ${activeStep === 4 && html`
          <form
            className="final-step-form"
            onSubmit=${(event) => {
              event.preventDefault();
              submitDebrief();
            }}
          >
            <label className="field">
              <span>Overall mood</span>
              <select value=${draft.overallMood} onChange=${(event) => setDraft((current) => ({ ...current, overallMood: event.target.value }))}>
                ${Object.entries(EMOTION_LABELS).map(([value, label]) => html`<option key=${value} value=${value}>${label}</option>`)}
              </select>
            </label>
            <label className="field">
              <span>Key mistake</span>
              <textarea rows="3" value=${draft.keyMistake} onChange=${(event) => setDraft((current) => ({ ...current, keyMistake: event.target.value }))}></textarea>
            </label>
            <label className="field">
              <span>Key takeaway</span>
              <textarea rows="3" value=${draft.keyLesson} onChange=${(event) => setDraft((current) => ({ ...current, keyLesson: event.target.value }))}></textarea>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked=${draft.willReviewTomorrow}
                onChange=${(event) => setDraft((current) => ({ ...current, willReviewTomorrow: event.target.checked }))}
              />
              <span>Review this session tomorrow</span>
            </label>
            <div className="button-row">
              <button type="submit">Save key takeaway</button>
              <span className="status-copy">${submitState}</span>
            </div>
          </form>
        `}

        <div className="button-row flow-nav">
          <button type="button" className="ghost-button" onClick=${() => setActiveStep((current) => Math.max(0, current - 1))} disabled=${activeStep === 0}>
            Back
          </button>
          ${activeStep < 4 &&
          html`
            <button type="button" onClick=${() => {
              if (activeStep === 2 && coachingState.status === "Idle") {
                startCoaching();
              }
              setActiveStep((current) => Math.min(4, current + 1));
            }}>
              Next step
            </button>
          `}
        </div>
      </section>
    </div>
  `;
}

function App() {
  const [client, setClient] = useState(null);
  const [bootState, setBootState] = useState({ status: "loading", error: "" });
  const [traders, setTraders] = useState([]);
  const [mode, setMode] = useState(settings.mode || "seed");
  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl || DEFAULT_API_BASE_URL);
  const [token, setToken] = useState(settings.token || "");
  const [granularity, setGranularity] = useState(settings.granularity || "daily");
  const [selectedUserId, setSelectedUserId] = useState(settings.selectedUserId || "");
  const [selectedSessionId, setSelectedSessionId] = useState(settings.selectedSessionId || "");
  const [health, setHealth] = useState(null);
  const [liveFallbackActive, setLiveFallbackActive] = useState(false);
  const [metricsResource, setMetricsResource] = useState(defaultResource);
  const [profileResource, setProfileResource] = useState(defaultResource);
  const [sessionResource, setSessionResource] = useState(defaultResource);
  const [dashboardRetryToken, setDashboardRetryToken] = useState(0);
  const [sessionRetryToken, setSessionRetryToken] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [draft, setDraft] = useState(debriefDefaults(null));
  const [coachingState, setCoachingState] = useState({ status: "Idle", message: "" });
  const [submitState, setSubmitState] = useState("Ready to save");
  const [hoveredHeatmapDay, setHoveredHeatmapDay] = useState(null);
  const streamAbortRef = useRef(null);
  const debriefPanelRef = useRef(null);

  const selectedTrader = useMemo(
    () => traders.find((trader) => trader.userId === selectedUserId) || null,
    [traders, selectedUserId]
  );

  const selectedTrade = useMemo(
    () => sessionResource.data?.trades?.[0] || null,
    [sessionResource.data]
  );

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    saveJson(STORAGE_KEYS.settings, {
      mode,
      apiBaseUrl,
      token,
      granularity,
      selectedUserId,
      selectedSessionId,
    });
  }, [mode, apiBaseUrl, token, granularity, selectedUserId, selectedSessionId]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      setBootState({ status: "loading", error: "" });
      try {
        const seedAdapter = await createSeedAdapter();
        const api = createApiClient(seedAdapter);
        const traderList = await api.listTraders();
        if (!alive) {
          return;
        }

        const nextUserId = traderList.find((trader) => trader.userId === selectedUserId)?.userId || traderList[0]?.userId || "";
        const nextSessions = traderList.find((trader) => trader.userId === nextUserId)?.sessions || [];
        const nextSessionId =
          nextSessions.find((session) => session.sessionId === selectedSessionId)?.sessionId ||
          latestSessionId(nextSessions);

        setClient(api);
        setTraders(traderList);
        setSelectedUserId(nextUserId);
        setSelectedSessionId(nextSessionId);

        if (mode === "live") {
          try {
            const healthResponse = await api.checkHealth(apiBaseUrl);
            if (alive) {
              setHealth(healthResponse);
            }
          } catch {
            if (alive) {
              setMode("seed");
            }
          }
        }

        if (alive) {
          setBootState({ status: "ready", error: "" });
        }
      } catch (error) {
        if (alive) {
          setBootState({ status: "error", error: error.message || String(error) });
        }
      }
    }

    bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!client || !selectedUserId) {
      return;
    }

    let alive = true;
    async function loadDashboard() {
      setMetricsResource(resourceLoading());
      setProfileResource(resourceLoading());
      setLiveFallbackActive(false);

      try {
        const range = await client.getTraderRange(selectedUserId);
        let usedFallback = false;
        const markFallback = () => {
          usedFallback = true;
          if (alive) {
            setLiveFallbackActive(true);
          }
        };

        const [metrics, profile] = await Promise.all([
          client.getMetrics({
            baseUrl: apiBaseUrl,
            userId: selectedUserId,
            token,
            mode,
            query: { ...range, granularity },
            onFallback: markFallback,
          }),
          client.getProfile({
            baseUrl: apiBaseUrl,
            userId: selectedUserId,
            token,
            mode,
            onFallback: markFallback,
          }),
        ]);

        if (!alive) {
          return;
        }
        setMetricsResource(resourceSuccess(metrics));
        setProfileResource(resourceSuccess(profile));

        if (mode === "live" && !usedFallback) {
          try {
            const healthResponse = await client.checkHealth(apiBaseUrl);
            if (alive) {
              setHealth(healthResponse);
            }
          } catch {}
        }
      } catch (error) {
        if (!alive) {
          return;
        }
        setMetricsResource(resourceError(error));
        setProfileResource(resourceError(error));
      }
    }

    loadDashboard();
    return () => {
      alive = false;
    };
  }, [client, selectedUserId, granularity, apiBaseUrl, token, mode, dashboardRetryToken]);

  useEffect(() => {
    if (!client || !selectedSessionId) {
      return;
    }

    let alive = true;
    async function loadSession() {
      setSessionResource(resourceLoading());
      setSubmitState("Ready to save");
      stopCoaching();
      setCoachingState({ status: "Idle", message: "" });

      try {
        let usedFallback = false;
        const session = await client.getSession({
          baseUrl: apiBaseUrl,
          sessionId: selectedSessionId,
          token,
          mode,
          onFallback: () => {
            usedFallback = true;
            if (alive) {
              setLiveFallbackActive(true);
            }
          },
        });

        if (!alive) {
          return;
        }

        const hydratedSession = mergeStoredDebrief(session);
        setSessionResource(resourceSuccess(hydratedSession));
        setDraft(debriefDefaults(hydratedSession));
        setActiveStep(0);
        if (mode === "live" && !usedFallback) {
          try {
            const healthResponse = await client.checkHealth(apiBaseUrl);
            if (alive) {
              setHealth(healthResponse);
            }
          } catch {}
        }
      } catch (error) {
        if (alive) {
          setSessionResource(resourceError(error));
        }
      }
    }

    loadSession();
    return () => {
      alive = false;
    };
  }, [client, selectedSessionId, apiBaseUrl, token, mode, sessionRetryToken]);

  function stopCoaching() {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    setCoachingState((current) => ({
      ...current,
      status: "Stopped",
    }));
  }

  async function startCoaching() {
    if (!client || !selectedSessionId) {
      return;
    }

    stopCoaching();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    setCoachingState({ status: "Connecting...", message: "" });

    try {
      await client.streamCoaching({
        baseUrl: apiBaseUrl,
        sessionId: selectedSessionId,
        token,
        mode,
        signal: controller.signal,
        onToken: (tokenChunk) => {
          setCoachingState((current) => ({
            ...current,
            message: `${current.message}${tokenChunk}`,
          }));
        },
        onDone: () => {
          setCoachingState((current) => ({
            ...current,
            status: "Completed",
          }));
        },
        onStatus: (message) => {
          setCoachingState((current) => ({
            ...current,
            status: message,
          }));
        },
      });
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      setCoachingState({
        status: "Stream failed",
        message: "Coaching stream failed. Check the API token or continue in demo mode.",
      });
    } finally {
      streamAbortRef.current = null;
    }
  }

  async function submitDebrief() {
    if (!client || !selectedSessionId) {
      return;
    }

    setSubmitState("Saving debrief...");
    try {
      const payload = {
        overallMood: draft.overallMood,
        planAdherenceRating: Number(draft.planAdherenceRating),
        keyMistake: draft.keyMistake || null,
        keyLesson: draft.keyLesson || null,
        willReviewTomorrow: draft.willReviewTomorrow,
      };

      let usedFallback = false;
      const saved = await client.submitDebrief({
        baseUrl: apiBaseUrl,
        sessionId: selectedSessionId,
        token,
        mode,
        payload,
        onFallback: () => {
          usedFallback = true;
          setLiveFallbackActive(true);
        },
      });
      const persistedDebrief = buildSavedDebrief(draft, saved);
      saveJson(getDebriefStorageKey(selectedSessionId), persistedDebrief);

      setSubmitState(
        mode === "live"
          ? usedFallback
            ? `Saved via fallback ${formatDateTime(saved.savedAt || new Date().toISOString())}`
            : `Saved ${formatDateTime(saved.savedAt || new Date().toISOString())}`
          : `Saved ${formatDateTime(saved.savedAt || new Date().toISOString())}`
      );
      setSessionResource((current) => ({
        ...current,
        data: current.data ? { ...current.data, savedDebrief: persistedDebrief } : current.data,
      }));
    } catch (error) {
      setSubmitState(error.message || "Debrief save failed");
    }
  }

  async function reconnectLive() {
    if (!client) {
      return;
    }
    try {
      const response = await client.checkHealth(apiBaseUrl);
      setHealth(response);
      setMode("live");
      setLiveFallbackActive(false);
    } catch (error) {
      setMode("seed");
    }
  }

  function handleHeatmapClick(sessionId) {
    setSelectedSessionId(sessionId);
    setActiveStep(0);
    debriefPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (bootState.status === "loading") {
    return html`
      <div className="app-shell react-app-shell">
        <header className="topbar-react">
          <div>
            <p className="eyebrow">Track 3</p>
            <h1>NevUp Pulse Console</h1>
          </div>
        </header>
        <section className="panel-react">
          <${LoadingSkeleton} rows=${8} />
        </section>
      </div>
    `;
  }

  if (bootState.status === "error") {
    return html`
      <div className="app-shell react-app-shell">
        <section className="panel-react">
          <${ErrorState} message=${bootState.error} onRetry=${() => window.location.reload()} />
        </section>
      </div>
    `;
  }

  const connection = renderConnection(mode, liveFallbackActive, health);

  return html`
    <div className="app-shell react-app-shell">
      <header className="topbar-react">
        <div className="headline-block">
          <p className="eyebrow">System of Engagement</p>
          <h1>NevUp Pulse Console</h1>
          <p className="hero-copy-react">
            React-based behavioural dashboard and 5-step debrief flow designed for the NevUp Hackathon 2026 Track 3 brief.
          </p>
        </div>
        <div className="badge-row">
          <span className=${`badge badge-${connection.tone}`}>${connection.text}</span>
          <button type="button" className="ghost-button" onClick=${reconnectLive}>Refresh health</button>
        </div>
      </header>

      <main className="react-layout">
        <section className="panel-react controls-react">
          <div className="panel-heading">
            <p className="eyebrow">Controls</p>
            <h3>Data Source & Context</h3>
          </div>

          <label className="field">
            <span>Trader</span>
            <select value=${selectedUserId} onChange=${(event) => {
              const nextUserId = event.target.value;
              const nextSessions = traders.find((trader) => trader.userId === nextUserId)?.sessions || [];
              setSelectedUserId(nextUserId);
              setSelectedSessionId(latestSessionId(nextSessions));
            }}>
              ${traders.map((trader) => html`<option key=${trader.userId} value=${trader.userId}>${trader.name}</option>`)}
            </select>
          </label>

          <label className="field">
            <span>Session</span>
            <select value=${selectedSessionId} onChange=${(event) => setSelectedSessionId(event.target.value)}>
              ${(selectedTrader?.sessions || [])
                .slice()
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((session) => html`
                  <option key=${session.sessionId} value=${session.sessionId}>
                    ${formatDate(session.date)} - ${formatCurrency(session.totalPnl)}
                  </option>
                `)}
            </select>
          </label>

          <label className="field">
            <span>Granularity</span>
            <select value=${granularity} onChange=${(event) => setGranularity(event.target.value)}>
              <option value="daily">Daily</option>
              <option value="hourly">Hourly</option>
              <option value="rolling30d">Rolling 30d</option>
            </select>
          </label>

          <details className="devtools" open>
            <summary>Live API Tools</summary>
            <label className="field">
              <span>API base URL</span>
              <input value=${apiBaseUrl} onChange=${(event) => setApiBaseUrl(event.target.value)} />
            </label>
            <label className="field">
              <span>JWT token</span>
              <textarea rows="4" value=${token} onChange=${(event) => setToken(event.target.value)}></textarea>
            </label>
            <div className="button-row">
              <button type="button" onClick=${async () => {
                try {
                  const response = await client.checkHealth(apiBaseUrl);
                  setHealth(response);
                  setMode("live");
                  setLiveFallbackActive(false);
                } catch {
                  setMode("seed");
                }
              }}>Check live API</button>
              <button type="button" className="ghost-button" onClick=${() => setMode("seed")}>Use demo data</button>
            </div>
          </details>
        </section>

        <section className="panel-react metrics-react">
          <div className="panel-heading">
            <p className="eyebrow">Snapshot</p>
            <h3>Behavioural Dashboard</h3>
          </div>
          <div className="prompt-stack-react">
            <div className="prompt-row">
              <span>Typical trade cadence</span>
              <strong>${selectedTrader ? `${Math.round(average(selectedTrader.sessions.map((session) => session.tradeCount)))} trades/session` : "Loading"}</strong>
            </div>
            <div className="prompt-row">
              <span>When does confidence show up?</span>
              <strong>${profileResource.data?.peakPerformanceWindow ? `${profileResource.data.peakPerformanceWindow.startHour}:00-${profileResource.data.peakPerformanceWindow.endHour}:00 UTC` : "Still learning"}</strong>
            </div>
            <div className="prompt-row">
              <span>What tends to trigger mistakes?</span>
              <strong>${deriveTrigger(sessionResource.data, metricsResource.data)}</strong>
            </div>
          </div>
          <${MetricPanel} metricsResource=${metricsResource} onRetry=${() => setDashboardRetryToken((value) => value + 1)} trader=${selectedTrader} />
        </section>

        <section className="panel-react heatmap-react">
          <div className="panel-heading">
            <p className="eyebrow">90 Days</p>
            <h3>Behavioural Heatmap</h3>
          </div>
          <${HeatmapPanel}
            trader=${selectedTrader}
            hovered=${hoveredHeatmapDay}
            setHovered=${setHoveredHeatmapDay}
            onDayClick=${handleHeatmapClick}
            status=${metricsResource.status}
            error=${metricsResource.error}
            onRetry=${() => setDashboardRetryToken((value) => value + 1)}
          />
        </section>

        <section className="panel-react profile-react">
          <div className="panel-heading">
            <p className="eyebrow">Results</p>
            <h3>Evidence-Backed Profile</h3>
          </div>
          <${ProfilePanel} profileResource=${profileResource} onRetry=${() => setDashboardRetryToken((value) => value + 1)} />
        </section>

        <section className="panel-react session-react">
          <div className="panel-heading">
            <p className="eyebrow">Session</p>
            <h3>Replay Detail</h3>
          </div>
          <${SessionDetailPanel} sessionResource=${sessionResource} onRetry=${() => setSessionRetryToken((value) => value + 1)} />
        </section>

        <section className="panel-react trade-playground-react">
          <div className="panel-heading">
            <p className="eyebrow">Contract</p>
            <h3>Trade Endpoint Verification</h3>
          </div>
          ${client
            ? html`<${TradeApiPanel} client=${client} mode=${mode} apiBaseUrl=${apiBaseUrl} token=${token} selectedTrade=${selectedTrade} onFallback=${() => setLiveFallbackActive(true)} onLiveState=${(usedFallback) => usedFallback && setLiveFallbackActive(true)} />`
            : html`<${EmptyState} title="Trade tools unavailable" body="The API client is still booting." />`}
        </section>

        <section id="debriefFlowPanel" ref=${debriefPanelRef} className="panel-react debrief-react">
          <div className="panel-heading">
            <p className="eyebrow">Required Flow</p>
            <h3>Post-Session Debrief</h3>
          </div>
          <${DebriefFlow}
            sessionResource=${sessionResource}
            draft=${draft}
            setDraft=${setDraft}
            activeStep=${activeStep}
            setActiveStep=${setActiveStep}
            coachingState=${coachingState}
            startCoaching=${startCoaching}
            stopCoaching=${stopCoaching}
            submitDebrief=${submitDebrief}
            submitState=${submitState}
            sessionRetry=${() => setSessionRetryToken((value) => value + 1)}
          />
        </section>
      </main>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
