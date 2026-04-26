import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#000000",
        surfaceAlt: "#0a0a0a",
        card: "rgba(10, 10, 10, 0.8)",
        accent: "#4ade80",
        accentAlt: "#22c55e",
        positive: "#4ade80",
        caution: "#f59e0b",
        danger: "#ef4444",
        glow: "rgba(74, 222, 128, 0.4)",
      },
      boxShadow: {
        glass: "0 18px 48px rgba(0, 0, 0, 0.35)",
      },
      backdropBlur: {
        xs: "3px",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.7" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
