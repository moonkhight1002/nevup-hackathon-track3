export const DEFAULT_API_BASE_URL = "http://localhost:4010";
export const SEED_DATA_PATH = "./data/nevup_seed_dataset.json";
export const STORAGE_KEYS = {
  settings: "nevup-pulse-settings",
  debriefPrefix: "nevup-pulse-debrief-",
  createdTrades: "nevup-pulse-created-trades",
};

export const PATHOLOGY_LABELS = {
  revenge_trading: "Revenge trading",
  overtrading: "Overtrading",
  fomo_entries: "FOMO entries",
  plan_non_adherence: "Plan non-adherence",
  premature_exit: "Premature exits",
  loss_running: "Running losses",
  session_tilt: "Session tilt",
  time_of_day_bias: "Time-of-day bias",
  position_sizing_inconsistency: "Sizing inconsistency",
};

export const EMOTION_LABELS = {
  calm: "Calm",
  anxious: "Anxious",
  greedy: "Greedy",
  fearful: "Fearful",
  neutral: "Neutral",
};
