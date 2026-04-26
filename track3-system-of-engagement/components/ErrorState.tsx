type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ title = "Something went wrong", message, onRetry }: Props) {
  return (
    <div className="glass-card rounded-xl border border-red-400/40 p-4 text-sm text-red-100" role="alert">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-red-200/90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300/60 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/10"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
