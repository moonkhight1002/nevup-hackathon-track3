"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { EmotionChart } from "@/components/EmotionChart";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Header } from "@/components/Header";
import { Heatmap } from "@/components/Heatmap";
import { ProfileCard } from "@/components/ProfileCard";
import { SessionList } from "@/components/SessionList";
import { BlockSkeleton, CardGridSkeleton } from "@/components/Skeletons";
import { StatCard } from "@/components/StatCard";
import { fetchMetrics, fetchProfile, fetchSession, getApiBase } from "@/lib/api";
import { SessionSummary } from "@/lib/types";
import { deriveHeatmap, decodeJwtSub, decodeJwtName, percent } from "@/lib/utils";

const DEMO_TRADERS = [
  { name: "Alex Mercer", userId: "f412f236-4edc-47a2-8f54-8763a6ed2ce8", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZjQxMmYyMzYtNGVkYy00N2EyLThmNTQtODc2M2E2ZWQyY2U4IiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJBbGV4IE1lcmNlciJ9.xmvRSdHi9nZkDDU04gG5-5edWPZedR8JYWvx3BpOnQ8" },
  { name: "Jordan Lee", userId: "fcd434aa-2201-4060-aeb2-f44c77aa0683", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZmNkNDM0YWEtMjIwMS00MDYwLWFlYjItZjQ0Yzc3YWEwNjgzIiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJKb3JkYW4gTGVlIn0.BNxdzSBtqdzeb0NivRrrho30gCnrWVn28yzS0s705OI" },
  { name: "Sam Rivera", userId: "84a6a3dd-f2d0-4167-960b-7319a6033d49", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiODRhNmEzZGQtZjJkMC00MTY3LTk2MGItNzMxOWE2MDMzZDQ5IiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJTYW0gUml2ZXJhIn0.y5gvT4IhsCvwLYOBQIVpgDtLKJSWl1qyzMSLEk0oEQY" },
  { name: "Casey Kim", userId: "4f2f0816-f350-4684-b6c3-29bbddbb1869", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiNGYyZjA4MTYtZjM1MC00Njg0LWI2YzMtMjliYmRkYmIxODY5IiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJDYXNleSBLaW0ifQ.4oQNbc2SXIr9kuue6GYRvHfcf2MaPOM7qbc7ZLu1pBY" },
  { name: "Morgan Bell", userId: "75076413-e8e8-44ac-861f-c7acb3902d6d", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiNzUwNzY0MTMtZThlOC00NGFjLTg2MWYtYzdhY2IzOTAyZDZkIiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJNb3JnYW4gQmVsbCJ9.byVJ9xCBSUKt65EQaXWEHr2YtNGLcIrbZOJbyBigGec" },
  { name: "Taylor Grant", userId: "8effb0f2-f16b-4b5f-87ab-7ffca376f309", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiOGVmZmIwZjItZjE2Yi00YjVmLTg3YWItN2ZmY2EzNzZmMzA5IiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJUYXlsb3IgR3JhbnQifQ.264t7JpAmntZKlnDwqzSMqL47YJXoUOzWbrgm2ojhf4" },
  { name: "Riley Stone", userId: "50dd1053-73b0-43c5-8d0f-d2af88c01451", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiNTBkZDEwNTMtNzNiMC00M2M1LThkMGYtZDJhZjg4YzAxNDUxIiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJSaWxleSBTdG9uZSJ9.C9R1pf7k5nOJronSOD1inZnWMT2M_EjgKsozj2wH2g8" },
  { name: "Drew Patel", userId: "af2cfc5e-c132-4989-9c12-2913f89271fb", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiYWYyY2ZjNWUtYzEzMi00OTg5LTljMTItMjkxM2Y4OTI3MWZiIiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJEcmV3IFBhdGVsIn0.KEOmG7CS4i-M4Uv98E5RAl2CKq-bscP6DQjwcWA-UuA" },
  { name: "Quinn Torres", userId: "9419073a-3d58-4ee6-a917-be2d40aecef2", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiOTQxOTA3M2EtM2Q1OC00ZWU2LWE5MTctYmUyZDQwYWVjZWYyIiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJRdWlubiBUb3JyZXMifQ.oZEde9RtHvef7rSCMUsImzZY-_LZ6y9jzAw7OeMyX-A" },
  { name: "Avery Chen", userId: "e84ea28c-e5a7-49ef-ac26-a873e32667bd", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZTg0ZWEyOGMtZTVhNy00OWVmLWFjMjYtYTg3M2UzMjY2N2JkIiwgImlhdCI6IDE3NzcxMzg2NjUsICJleHAiOiAxNzc3MjI1MDY1LCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJBdmVyeSBDaGVuIn0.jZoJawVXiFQTFn-Lk2LShkqLVa7-6TyuW67JXWJ0aBc" },
  { name: "[ TEST ] Empty Trader", userId: "empty-trader-id", token: "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZW1wdHktdHJhZGVyLWlkIiwgImlhdCI6IDE3MzYxNTA0MDAsICJleHAiOiAxNzM2MjM3ODAwLCAicm9sZSI6ICJ0cmFkZXIiLCAibmFtZSI6ICJFbXB0eSBUcmFkZXIifQ.fake-sig" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState("SEED");
  const [token, setToken] = useState(DEMO_TRADERS[0].token);
  const [userId, setUserId] = useState(DEMO_TRADERS[0].userId);

  useEffect(() => {
    // Default to SEED mode for hackathon presentation
  }, []);

  const effectiveUserId = userId.trim() || decodeJwtSub(token.trim());

  const profileQuery = useQuery({
    queryKey: ["profile", baseUrl, effectiveUserId, token],
    queryFn: () => fetchProfile(effectiveUserId, { baseUrl, token }),
    enabled: Boolean(effectiveUserId),
  });

  const metricsQuery = useQuery({
    queryKey: ["metrics", baseUrl, effectiveUserId, token],
    queryFn: () => fetchMetrics(effectiveUserId, { baseUrl, token }),
    enabled: Boolean(effectiveUserId),
  });

  const sessionIds = useMemo(() => {
    const fromPathologies = profileQuery.data?.dominantPathologies
      ?.flatMap((p: any) => p.evidenceSessions || []) || [];
    const fromMetrics = metricsQuery.data?.timeseries
      ?.map((t: any) => t.sessionId)
      .filter((id: any): id is string => Boolean(id)) || [];
    
    return [...new Set([...fromPathologies, ...fromMetrics])].slice(0, 50);
  }, [profileQuery.data, metricsQuery.data]);

  const sessionQueries = useQueries({
    queries: sessionIds.map((id) => ({
      queryKey: ["session-preview", baseUrl, id, token],
      queryFn: () => fetchSession(id, { baseUrl, token }),
      enabled: Boolean(id),
    })),
  });

  const sessions = useMemo(() => {
    return sessionQueries
      .map((query) => query.data)
      .filter((item): item is SessionSummary => Boolean(item))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessionQueries]);

  const emotionChartData = useMemo(() => {
    const source = metricsQuery.data?.emotionalStats || metricsQuery.data?.winRateByEmotionalState || {};
    return Object.entries(source).map(([emotion, entry]: [string, any]) => ({
      emotion,
      wins: entry.wins,
      losses: entry.losses,
    }));
  }, [metricsQuery.data]);

  const heatmapPoints = useMemo(() => deriveHeatmap(metricsQuery.data || {}, sessions), [metricsQuery.data, sessions]);

  const avgAdherence = metricsQuery.data?.planAdherenceScore ?? 0;
  const bestEmotion = [...emotionChartData].sort((a, b) => b.wins - a.wins)[0]?.emotion ?? "n/a";

  return (
    <motion.main 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-7xl space-y-4 px-2 py-3 sm:space-y-5 sm:px-4 sm:py-6"
    >
      <section className="glass-card rounded-xl p-3 sm:p-4">
        <p className="mb-2 text-xs font-mono uppercase tracking-[0.2em] text-accent/80">[ CONNECTION ]</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-mono uppercase tracking-wide text-slate-400">API Base URL</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              spellCheck={false}
              className="w-full min-w-0 rounded-sm border border-slate-700 bg-[#050505] px-3 py-2 text-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs font-mono uppercase tracking-wide text-slate-400">JWT</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              spellCheck={false}
              className="w-full min-w-0 rounded-sm border border-slate-700 bg-[#050505] px-3 py-2 text-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-mono uppercase tracking-wide text-slate-400">Demo Trader</span>
            <select
              value={userId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const selectedId = e.target.value;
                const trader = DEMO_TRADERS.find((t) => t.userId === selectedId);
                if (trader) {
                  setUserId(trader.userId);
                  setToken(trader.token);
                } else {
                  setUserId(selectedId);
                }
              }}
              className="w-full rounded-sm border border-slate-700 bg-[#050505] px-3 py-2 text-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer appearance-none"
            >
              <option value="" disabled>Select a trader</option>
              {DEMO_TRADERS.map((t: any) => (
                <option key={t.userId} value={t.userId} className="bg-[#050505] text-slate-200">
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <Header
        userName={decodeJwtName(token) || "Trader"}
        traderType={profileQuery.data?.traderType}
        winRate={metricsQuery.data?.winRate}
        sessionsCount={sessions.length}
      />

      {!effectiveUserId ? (
        <EmptyState
          title="Authentication required"
          message="Please select a Demo Trader from the dropdown to load the dashboard."
          ctaLabel="Load Alex Mercer"
          onCta={() => {
            const alex = DEMO_TRADERS[0];
            setUserId(alex.userId);
            setToken(alex.token);
          }}
        />
      ) : null}

      {profileQuery.isLoading || metricsQuery.isLoading ? <CardGridSkeleton /> : null}
      {profileQuery.isError ? (
        <ErrorState message={(profileQuery.error as Error).message} onRetry={() => profileQuery.refetch()} />
      ) : null}
      {metricsQuery.isError ? (
        <ErrorState message={(metricsQuery.error as Error).message} onRetry={() => metricsQuery.refetch()} />
      ) : null}

      {metricsQuery.data && profileQuery.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Win Rate" value={metricsQuery.data.winRate !== undefined ? percent(metricsQuery.data.winRate) : "—"} />
            <StatCard label="Avg Adherence" value={metricsQuery.data.planAdherenceScore !== undefined ? metricsQuery.data.planAdherenceScore.toFixed(1) : "—"} />
            <StatCard label="Sessions Completed" value={String(sessions.length)} />
            <StatCard label="Best Emotional State" value={bestEmotion} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <ProfileCard profile={profileQuery.data} userName={decodeJwtName(token)} />
            {emotionChartData.length ? (
              <EmotionChart data={emotionChartData} />
            ) : (
              <EmptyState title="No emotional analytics" message="Metrics response did not include emotion data." />
            )}
          </div>

          {heatmapPoints.length ? (
            <Heatmap
              points={heatmapPoints}
              onOpenSession={(sessionId) => {
                router.push(`/session/${sessionId}?baseUrl=${encodeURIComponent(baseUrl)}&token=${encodeURIComponent(token)}`);
              }}
            />
          ) : (
            <EmptyState
              title="No heatmap data"
              message="No 90-day metrics are available yet. Start recording sessions to populate behavior history."
            />
          )}

          {sessionQueries.some((query) => query.isLoading) ? <BlockSkeleton lines={6} /> : null}
          {sessions.length ? (
            <SessionList sessions={sessions} baseUrl={baseUrl} token={token} />
          ) : (
            <EmptyState
              title="No sessions linked"
              message="No recent sessions were resolved from metrics heatmap data."
            />
          )}
        </>
      ) : null}
    </motion.main>
  );
}
