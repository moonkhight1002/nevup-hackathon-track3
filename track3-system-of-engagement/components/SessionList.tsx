import Link from "next/link";
import { SessionSummary } from "@/lib/types";
import { currency, dateShort } from "@/lib/utils";

type Props = {
  sessions: SessionSummary[];
  baseUrl: string;
  token: string;
};

export function SessionList({ sessions, baseUrl, token }: Props) {
  return (
    <article className="glass-card rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Recent Sessions</h3>
        <span className="text-xs text-slate-400">{sessions.length} entries</span>
      </div>
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.sessionId}
            className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{dateShort(session.date)}</p>
              <p className={session.totalPnl < 0 ? "text-[#FF0000]" : "text-slate-300"}>{currency(session.totalPnl)}</p>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Win rate {((Number(session.winRate) || 0) * 100).toFixed(0)}% - {session.tradeCount || 0} trades
            </p>
            <Link
              href={`/session/${session.sessionId}?baseUrl=${encodeURIComponent(baseUrl)}&token=${encodeURIComponent(token)}`}
              className="mt-2 inline-block rounded-md border border-cyan-300/40 px-2.5 py-1 text-xs font-semibold hover:bg-cyan-400/10"
            >
              Open Debrief
            </Link>
          </div>
        ))}
      </div>
    </article>
  );
}
