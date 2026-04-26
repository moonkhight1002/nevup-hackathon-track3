"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Emotion, Trade } from "@/lib/types";

type DebriefState = {
  currentStep: number;
  selectedEmotions: Record<string, Emotion>;
  adherenceRatings: Record<string, number>;
  takeaway: string;
  completedSteps: number[];
  setStep: (step: number) => void;
  setEmotion: (tradeId: string, emotion: Emotion) => void;
  setRating: (tradeId: string, rating: number) => void;
  setTakeaway: (takeaway: string) => void;
  markStepComplete: (step: number) => void;
  initializeFromTrades: (trades: Trade[]) => void;
  reset: () => void;
};

const initialState = {
  currentStep: 0,
  selectedEmotions: {},
  adherenceRatings: {},
  takeaway: "",
  completedSteps: [],
};

export const useDebriefStore = create<DebriefState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setStep: (step) => set({ currentStep: Math.max(0, Math.min(4, step)) }),
      setEmotion: (tradeId, emotion) =>
        set((state) => ({ selectedEmotions: { ...state.selectedEmotions, [tradeId]: emotion } })),
      setRating: (tradeId, rating) =>
        set((state) => ({
          adherenceRatings: { ...state.adherenceRatings, [tradeId]: Math.max(1, Math.min(5, rating)) },
        })),
      setTakeaway: (takeaway) => set({ takeaway }),
      markStepComplete: (step) =>
        set((state) => ({
          completedSteps: state.completedSteps.includes(step)
            ? state.completedSteps
            : [...state.completedSteps, step].sort((a, b) => a - b),
        })),
      initializeFromTrades: (trades) => {
        const { selectedEmotions, adherenceRatings } = get();
        const nextEmotions = { ...selectedEmotions };
        const nextRatings = { ...adherenceRatings };
        for (const trade of trades) {
          if (!nextEmotions[trade.tradeId]) {
            nextEmotions[trade.tradeId] = (trade.emotionalState as Emotion) || "neutral";
          }
          if (!nextRatings[trade.tradeId]) {
            nextRatings[trade.tradeId] = trade.planAdherence ? Number(trade.planAdherence) : 3;
          }
        }
        set({ selectedEmotions: nextEmotions, adherenceRatings: nextRatings });
      },
      reset: () => set(initialState),
    }),
    {
      name: "nevup-debrief-store-v1",
      partialize: (state) => ({
        currentStep: state.currentStep,
        selectedEmotions: state.selectedEmotions,
        adherenceRatings: state.adherenceRatings,
        takeaway: state.takeaway,
        completedSteps: state.completedSteps,
      }),
    }
  )
);
