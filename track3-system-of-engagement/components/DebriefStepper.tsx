import { classNames } from "@/lib/utils";

type Props = {
  currentStep: number;
  completedSteps: number[];
  onStepChange: (step: number) => void;
};

const labels = [
  "Trade Replay",
  "Emotional Tagging",
  "Plan Adherence",
  "Live Coaching",
  "Key Takeaway",
];

export function DebriefStepper({ currentStep, completedSteps, onStepChange }: Props) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible md:pb-0"
      role="tablist"
      aria-label="Debrief steps"
    >
      {labels.map((label, index) => {
        const active = index === currentStep;
        const complete = completedSteps.includes(index);
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`debrief-panel-${index}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onStepChange(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") onStepChange(Math.min(4, index + 1));
              if (event.key === "ArrowLeft") onStepChange(Math.max(0, index - 1));
              if (event.key === "Home") onStepChange(0);
              if (event.key === "End") onStepChange(4);
            }}
            className={classNames(
              "min-w-[148px] rounded-lg border px-3 py-2 text-left text-xs font-semibold transition md:min-w-0",
              active
                ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-50"
                : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-cyan-400/50",
              complete && "border-emerald-300/60"
            )}
          >
            <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
              {complete ? "✓" : index + 1}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
