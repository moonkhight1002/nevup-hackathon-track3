type Props = {
  userName: string;
  traderType?: string;
  winRate?: number;
  sessionsCount?: number;
};

export function Header({ userName, traderType, winRate, sessionsCount }: Props) {
  return (
    <header className="glass-card rounded-2xl p-4 sm:p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent/80">[ SYSTEM OF ENGAGEMENT ]</p>
          <h1 className="mt-1 break-words text-xl font-semibold sm:text-2xl md:text-3xl">
            Welcome back, {userName || "Trader"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Review your behavior signals, inspect pressure points, and complete your post-session debrief in one flow.
          </p>
        </div>
        <div className="flex w-full flex-col items-start gap-2 text-sm sm:w-auto sm:items-end">
          <span className="rounded-sm border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-accent break-words shadow-[0_0_10px_rgba(74,222,128,0.2)]">
            {traderType || "Syncing Profile..."}
          </span>
          <span className="text-slate-300">Win rate: {winRate !== undefined ? `${(winRate * 100).toFixed(0)}%` : "-"}</span>
          <span className="text-slate-300">Sessions: {sessionsCount ?? "-"}</span>
        </div>
      </div>
    </header>
  );
}
