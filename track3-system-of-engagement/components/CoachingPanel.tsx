"use client";

import { useRef, useState } from "react";
import { streamCoaching } from "@/lib/sse";

type Props = {
  baseUrl: string;
  token: string;
  sessionId: string;
};

export function CoachingPanel({ baseUrl, token, sessionId }: Props) {
  const [status, setStatus] = useState("Idle");
  const [message, setMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const start = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setMessage("");

    await streamCoaching({
      baseUrl,
      token,
      sessionId,
      signal: controller.signal,
      onToken: (chunk) => setMessage((prev) => prev + chunk),
      onStatus: setStatus,
      onComplete: () => setStatus("Completed"),
      onError: (errorText) => {
        setStatus("Error");
        setMessage(errorText);
      },
    });
  };

  const stop = () => {
    abortRef.current?.abort();
    setStatus("Stopped");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={start}
          className="rounded-md border border-cyan-300/50 px-3 py-2 text-xs font-semibold hover:bg-cyan-400/10"
        >
          Start Stream
        </button>
        <button
          type="button"
          onClick={stop}
          className="rounded-md border border-slate-500/60 px-3 py-2 text-xs font-semibold hover:bg-slate-700/30"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={start}
          className="rounded-md border border-amber-300/60 px-3 py-2 text-xs font-semibold hover:bg-amber-400/10"
        >
          Manual Retry
        </button>
      </div>
      <p className="text-xs text-cyan-200/90" aria-live="polite">
        {status}
      </p>
      <div className="min-h-24 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
        {message || "Streaming output appears token-by-token here."}
      </div>
    </div>
  );
}
