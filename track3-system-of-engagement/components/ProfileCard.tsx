import { ProfileResponse } from "@/lib/types";

type Props = {
  profile: ProfileResponse;
  userName: string;
};

export function ProfileCard({ profile, userName }: Props) {
  const primaryPathology =
    profile.pathology || profile.dominantPathologies?.[0]?.pathology?.replaceAll("_", " ") || "N/A";
  const weaknesses =
    profile.weaknesses ||
    profile.dominantPathologies?.slice(0, 3).map((item) => item.pathology.replaceAll("_", " ")) ||
    [];

  const formatPeakWindow = (pw?: { startHour?: number; endHour?: number; winRate?: number } | null) => {
    if (!pw || pw.startHour === undefined || pw.endHour === undefined) return "See session logs";
    const formatHour = (h: number) => {
      const ampm = h >= 12 ? "PM" : "AM";
      const hour = h % 12 || 12;
      return `${hour} ${ampm}`;
    };
    return `${formatHour(pw.startHour)} - ${formatHour(pw.endHour)}`;
  };

  return (
    <article className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent/80">[ BEHAVIORAL PROFILE ]</p>
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent uppercase tracking-wider">
          {profile.traderType || "Adaptive"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700/70 p-3 overflow-hidden">
          <p className="text-xs font-mono uppercase tracking-wide text-slate-400">Pathology</p>
          <p className="mt-1 font-medium capitalize break-words text-accent">{primaryPathology}</p>
        </div>
        <div className="rounded-lg border border-slate-700/70 p-3 overflow-hidden">
          <p className="text-xs font-mono uppercase tracking-wide text-slate-400">Peak Window</p>
          <p className="mt-1 font-medium">{formatPeakWindow(profile.peakPerformanceWindow)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <p className="font-medium text-slate-200">Strengths</p>
        <ul className="list-disc space-y-1 pl-5 text-slate-300 break-words">
          {(profile.strengths || []).slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <p className="font-medium text-slate-200">Weaknesses</p>
        <ul className="list-disc space-y-1 pl-5 text-slate-300 break-words">
          {weaknesses.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
