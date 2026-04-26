import { Emotion, Trade } from "@/lib/types";
import { classNames, emotionLabel } from "@/lib/utils";

type Props = {
  trades: Trade[];
  selected: Record<string, Emotion>;
  onSelect: (tradeId: string, emotion: Emotion) => void;
};

const emotions: Emotion[] = ["calm", "anxious", "greedy", "fearful", "neutral"];

export function EmotionTagger({ trades, selected, onSelect }: Props) {
  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <div key={trade.tradeId} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <p className="mb-2 text-sm font-medium">
            {trade.asset} - {trade.direction}
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Emotion for ${trade.asset}`}>
            {emotions.map((emotion) => {
              const active = selected[trade.tradeId] === emotion;
              return (
                <button
                  key={emotion}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(trade.tradeId, emotion)}
                  className={classNames(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-accent",
                    active
                      ? "border-cyan-300/70 bg-cyan-400/10 text-cyan-100"
                      : "border-slate-600 text-slate-300 hover:border-cyan-300/60"
                  )}
                >
                  {emotionLabel[emotion]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
