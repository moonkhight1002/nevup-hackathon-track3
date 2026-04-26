type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  statusText: string;
};

export function TakeawayForm({ value, onChange, onSubmit, loading, statusText }: Props) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-3"
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">What will you improve next session?</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-600 bg-slate-950/60 p-3 text-sm text-slate-100"
          placeholder="I will reduce revenge entries after a losing close by waiting two minutes and re-checking setup quality."
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border border-emerald-300/60 px-3 py-2 text-xs font-semibold hover:bg-emerald-400/10 disabled:opacity-70 sm:w-auto"
        >
          {loading ? "Saving..." : "Save Debrief"}
        </button>
        <p className="break-words text-xs text-slate-300" aria-live="polite">
          {statusText}
        </p>
      </div>
    </form>
  );
}
