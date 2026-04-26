import { Trade } from "@/lib/types";
import { currency, dateTimeShort, describeDuration } from "@/lib/utils";

type Props = {
  trades: Trade[];
  selectedTradeId: string | null;
  onSelectTrade: (tradeId: string) => void;
};

export function TradeReplay({ trades, selectedTradeId, onSelectTrade }: Props) {
  const selected = trades.find((trade) => trade.tradeId === selectedTradeId) ?? trades[0];
  return (
    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
      <div className="max-h-[300px] space-y-2 overflow-auto pr-1 sm:max-h-[360px]">
        {trades.map((trade) => (
          <button
            key={trade.tradeId}
            type="button"
            onClick={() => onSelectTrade(trade.tradeId)}
            className={`w-full rounded-lg border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
              selected?.tradeId === trade.tradeId
                ? "border-cyan-300/70 bg-cyan-500/10"
                : "border-slate-700 bg-slate-900/40"
            }`}
          >
            <p className="break-words font-semibold">
              {trade.asset} - {trade.direction?.toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Qty {trade.quantity} - <span className={trade.pnl && trade.pnl < 0 ? "text-[#FF0000]" : "text-slate-300"}>{currency(trade.pnl)}</span>
            </p>
          </button>
        ))}
      </div>

      <aside className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-sm sm:p-4 overflow-y-auto max-h-[300px] sm:max-h-[360px]">
        {selected ? (
          <div className="space-y-3 break-words text-slate-200">
            <div>
              <p className="text-base font-semibold break-words text-cyan-100">{selected.asset}</p>
              <p className="text-xs text-slate-400 mt-1">
                {selected.direction?.toUpperCase()} &bull; Qty {selected.quantity} &bull; PnL <span className={selected.pnl && selected.pnl < 0 ? "text-[#FF0000]" : ""}>{currency(selected.pnl)}</span>
              </p>
            </div>
            
            <div className="rounded border border-slate-700/50 bg-slate-950/30 p-2">
              <p className="text-xs font-semibold text-slate-400">Entry: {dateTimeShort(selected.entryAt)}</p>
              {selected.entryRationale && (
                <p className="mt-1 text-xs break-words">{selected.entryRationale}</p>
              )}
            </div>

            <div className="rounded border border-slate-700/50 bg-slate-950/30 p-2">
              <p className="text-xs font-semibold text-slate-400">Exit: {selected.exitAt ? dateTimeShort(selected.exitAt) : "Open"}</p>
              {selected.exitRationale && (
                <p className="mt-1 text-xs break-words">{selected.exitRationale}</p>
              )}
            </div>
            
            <p className="text-xs text-slate-400 pt-1">Duration: {describeDuration(selected.entryAt, selected.exitAt)}</p>
          </div>
        ) : (
          <p>No trade selected.</p>
        )}
      </aside>
    </div>
  );
}
