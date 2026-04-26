"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CoachingPanel } from "@/components/CoachingPanel";
import { DebriefStepper } from "@/components/DebriefStepper";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { EmotionTagger } from "@/components/EmotionTagger";
import { RatingStep } from "@/components/RatingStep";
import { BlockSkeleton } from "@/components/Skeletons";
import { TakeawayForm } from "@/components/TakeawayForm";
import { TradeReplay } from "@/components/TradeReplay";
import { fetchSession, getApiBase, submitDebrief } from "@/lib/api";
import { Emotion } from "@/lib/types";
import { useDebriefStore } from "@/store/debriefStore";

const stepAnimations = [
  { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 } },
  { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } },
  { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 } },
  { initial: { opacity: 0, x: -18 }, animate: { opacity: 1, x: 0 } },
  { initial: { opacity: 0, y: -18 }, animate: { opacity: 1, y: 0 } },
];

export function SessionDebriefClient({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const token = decodeURIComponent(searchParams.get("token") || "");
  const baseUrl = decodeURIComponent(searchParams.get("baseUrl") || getApiBase());

  const {
    currentStep,
    selectedEmotions,
    adherenceRatings,
    takeaway,
    completedSteps,
    setStep,
    setEmotion,
    setRating,
    setTakeaway,
    markStepComplete,
    initializeFromTrades,
    reset,
  } = useDebriefStore();

  const sessionQuery = useQuery({
    queryKey: ["session-detail", baseUrl, token, sessionId],
    queryFn: () => fetchSession(sessionId, { baseUrl, token }),
    enabled: Boolean(sessionId),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!sessionQuery.data) return;
      const emotions = sessionQuery.data.trades.map((trade: any) => ({
        tradeId: trade.tradeId,
        emotion: (selectedEmotions[trade.tradeId] || "neutral") as Emotion,
      }));
      const ratings = sessionQuery.data.trades.map((trade: any) => ({
        tradeId: trade.tradeId,
        rating: adherenceRatings[trade.tradeId] || 3,
      }));
      const avgRating =
        ratings.reduce((sum: number, item: any) => sum + item.rating, 0) / Math.max(1, ratings.length);
      const topEmotion = emotions[0]?.emotion || "neutral";
      return submitDebrief(
        sessionId,
        {
          takeaway,
          emotions,
          ratings,
          overallMood: topEmotion,
          keyLesson: takeaway,
          planAdherenceRating: Math.round(avgRating),
          willReviewTomorrow: true,
        },
        { baseUrl, token }
      );
    },
    onSuccess: () => {
      markStepComplete(4);
      reset();
    },
  });

  useEffect(() => {
    if (sessionQuery.data?.trades?.length) {
      initializeFromTrades(sessionQuery.data.trades);
      if (!selectedTradeId) {
        setSelectedTradeId(sessionQuery.data.trades[0].tradeId);
      }
    }
  }, [sessionQuery.data, initializeFromTrades, selectedTradeId]);

  const currentAnimation = stepAnimations[currentStep] || stepAnimations[0];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-2 py-3 sm:px-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Post-Session Debrief</h1>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-500/60 px-3 py-2 text-xs font-semibold hover:bg-slate-700/30"
        >
          Back to Dashboard
        </Link>
      </div>

      <DebriefStepper currentStep={currentStep} completedSteps={completedSteps} onStepChange={setStep} />

      {sessionQuery.isLoading ? <BlockSkeleton lines={8} /> : null}
      {sessionQuery.isError ? (
        <ErrorState message={(sessionQuery.error as Error).message} onRetry={() => sessionQuery.refetch()} />
      ) : null}

      {sessionQuery.data ? (
        <AnimatePresence mode="wait">
          <motion.section
            key={currentStep}
            id={`debrief-panel-${currentStep}`}
            role="tabpanel"
            tabIndex={-1}
            ref={(node: HTMLElement | null) => {
              if (node) node.focus();
            }}
            initial={currentAnimation.initial}
            animate={currentAnimation.animate}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="glass-card rounded-xl p-3 sm:p-4 outline-none"
          >
            {currentStep === 0 ? (
              <TradeReplay
                trades={sessionQuery.data.trades}
                selectedTradeId={selectedTradeId}
                onSelectTrade={(tradeId) => {
                  setSelectedTradeId(tradeId);
                  markStepComplete(0);
                }}
              />
            ) : null}

            {currentStep === 1 ? (
              <EmotionTagger
                trades={sessionQuery.data.trades}
                selected={selectedEmotions}
                onSelect={(tradeId, emotion) => {
                  setEmotion(tradeId, emotion);
                  markStepComplete(1);
                }}
              />
            ) : null}

            {currentStep === 2 ? (
              <RatingStep
                trades={sessionQuery.data.trades}
                ratings={adherenceRatings}
                onRate={(tradeId, rating) => {
                  setRating(tradeId, rating);
                  markStepComplete(2);
                }}
              />
            ) : null}

            {currentStep === 3 ? (
              <CoachingPanel baseUrl={baseUrl} token={token} sessionId={sessionId} />
            ) : null}

            {currentStep === 4 ? (
              <TakeawayForm
                value={takeaway}
                onChange={setTakeaway}
                onSubmit={() => saveMutation.mutate()}
                loading={saveMutation.isPending}
                statusText={
                  saveMutation.isSuccess
                    ? "Saved successfully."
                    : saveMutation.isError
                      ? (saveMutation.error as Error).message.slice(0, 100) + "..."
                      : "Ready to submit"
                }
              />
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="w-full rounded-md border border-slate-500/60 px-3 py-2 text-xs font-semibold hover:bg-slate-700/30 disabled:opacity-60 sm:w-auto"
              >
                Back
              </button>
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(4, currentStep + 1);
                    setStep(next);
                    markStepComplete(currentStep);
                  }}
                  className="w-full rounded-md border border-cyan-300/60 px-3 py-2 text-xs font-semibold hover:bg-cyan-400/10 disabled:opacity-60 sm:w-auto"
                >
                  Next Step
                </button>
              ) : (
                <Link
                  href="/dashboard"
                  className="w-full rounded-md bg-accent/20 border border-accent/40 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/30 text-center sm:w-auto"
                >
                  Finish & Return to Dashboard
                </Link>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      ) : null}

      {!sessionQuery.isLoading && !sessionQuery.data && !sessionQuery.isError ? (
        <EmptyState title="No session data" message="Session could not be loaded from the API." />
      ) : null}
    </main>
  );
}
