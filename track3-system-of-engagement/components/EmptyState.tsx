type Props = {
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export function EmptyState({ title, message, ctaLabel, onCta }: Props) {
  return (
    <div className="glass-card rounded-xl p-5 text-sm text-slate-200">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-slate-300">{message}</p>
      {ctaLabel && onCta ? (
        <button
          type="button"
          onClick={onCta}
          className="mt-3 rounded-md border border-cyan-300/50 px-3 py-1.5 text-xs font-semibold hover:bg-cyan-400/10"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
