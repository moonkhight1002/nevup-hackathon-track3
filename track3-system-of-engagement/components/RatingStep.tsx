import { Trade } from "@/lib/types";
import { classNames } from "@/lib/utils";

type Props = {
  trades: Trade[];
  ratings: Record<string, number>;
  onRate: (tradeId: string, rating: number) => void;
};

export function RatingStep({ trades, ratings, onRate }: Props) {
  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <div key={trade.tradeId} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <p className="mb-2 text-sm font-medium">{trade.asset}</p>
          <div className="flex gap-2" role="radiogroup" aria-label={`Adherence rating for ${trade.asset}`}>
            {[1, 2, 3, 4, 5].map((value) => {
              const active = ratings[trade.tradeId] === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onRate(trade.tradeId, value)}
                  className={classNames(
                    "h-8 w-8 rounded-md border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-accent",
                    active
                      ? "border-cyan-300/80 bg-cyan-500/20 text-cyan-100"
                      : "border-slate-600 text-slate-300 hover:border-cyan-300/60"
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
