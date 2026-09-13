import type { BreakTheme } from "@/features/session/break-types";
import type { SessionState } from "@/features/session/types";

export const springSoft = { type: "spring" as const, stiffness: 260, damping: 28 };

/** Snappy chrome nav — ~180ms settle, no bounce. */
export const springChrome = {
  type: "spring" as const,
  stiffness: 520,
  damping: 42,
  mass: 0.7,
};

/** Enter-only page/tab content fade + rise for chrome switches. */
export const pageTabMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: springChrome,
};

/** Overdamped melt settle — turns progress ticks into organic squash/sink. */
export const springMelt = { type: "spring" as const, stiffness: 48, damping: 22 };

export type StateAccent = ReturnType<typeof stateAccent>;

const BREAK_THEME_ACCENTS: Record<
  BreakTheme,
  Omit<StateAccent, "card"> & { card: string }
> = {
  sky: {
    text: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-400/10",
    border: "border-sky-200 dark:border-sky-400/25",
    glow: "0 0 0 1px rgba(14,165,233,0.2), 0 8px 24px rgba(14,165,233,0.18)",
    ring: "rgba(14, 165, 233, 0.45)",
    solid: "#0ea5e9",
    button:
      "bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-300 dark:bg-sky-400/15 dark:text-sky-300 dark:hover:bg-sky-400/25 dark:border-sky-400/30",
    card: "border-sky-200 bg-white dark:border-sky-400/25 dark:bg-zinc-950",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-400/10",
    border: "border-amber-200 dark:border-amber-400/25",
    glow: "0 0 0 1px rgba(245,158,11,0.2), 0 8px 24px rgba(245,158,11,0.18)",
    ring: "rgba(245, 158, 11, 0.45)",
    solid: "#f59e0b",
    button:
      "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 dark:bg-amber-400/15 dark:text-amber-300 dark:hover:bg-amber-400/25 dark:border-amber-400/30",
    card: "border-amber-200 bg-white dark:border-amber-400/25 dark:bg-zinc-950",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-400/10",
    border: "border-emerald-200 dark:border-emerald-400/25",
    glow: "0 0 0 1px rgba(16,185,129,0.2), 0 8px 24px rgba(16,185,129,0.18)",
    ring: "rgba(16, 185, 129, 0.45)",
    solid: "#10b981",
    button:
      "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 dark:bg-emerald-400/15 dark:text-emerald-300 dark:hover:bg-emerald-400/25 dark:border-emerald-400/30",
    card: "border-emerald-200 bg-white dark:border-emerald-400/25 dark:bg-zinc-950",
  },
  slate: {
    text: "text-slate-600 dark:text-zinc-300",
    bg: "bg-slate-50 dark:bg-white/5",
    border: "border-slate-300 dark:border-white/10",
    glow: "0 0 0 1px rgba(100,116,139,0.2), 0 8px 24px rgba(100,116,139,0.15)",
    ring: "rgba(100, 116, 139, 0.4)",
    solid: "#64748b",
    button:
      "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/15 dark:border-white/15",
    card: "border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-950",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-400/10",
    border: "border-rose-200 dark:border-rose-400/25",
    glow: "0 0 0 1px rgba(244,63,94,0.2), 0 8px 24px rgba(244,63,94,0.16)",
    ring: "rgba(244, 63, 94, 0.4)",
    solid: "#f43f5e",
    button:
      "bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300 dark:bg-rose-400/15 dark:text-rose-300 dark:hover:bg-rose-400/25 dark:border-rose-400/30",
    card: "border-rose-200 bg-white dark:border-rose-400/25 dark:bg-zinc-950",
  },
  orange: {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-400/10",
    border: "border-orange-200 dark:border-orange-400/25",
    glow: "0 0 0 1px rgba(249,115,22,0.2), 0 8px 24px rgba(249,115,22,0.16)",
    ring: "rgba(249, 115, 22, 0.4)",
    solid: "#f97316",
    button:
      "bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-300 dark:bg-orange-400/15 dark:text-orange-300 dark:hover:bg-orange-400/25 dark:border-orange-400/30",
    card: "border-orange-200 bg-white dark:border-orange-400/25 dark:bg-zinc-950",
  },
  teal: {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-400/10",
    border: "border-teal-200 dark:border-teal-400/25",
    glow: "0 0 0 1px rgba(20,184,166,0.2), 0 8px 24px rgba(20,184,166,0.16)",
    ring: "rgba(20, 184, 166, 0.4)",
    solid: "#14b8a6",
    button:
      "bg-teal-100 text-teal-800 hover:bg-teal-200 border border-teal-300 dark:bg-teal-400/15 dark:text-teal-300 dark:hover:bg-teal-400/25 dark:border-teal-400/30",
    card: "border-teal-200 bg-white dark:border-teal-400/25 dark:bg-zinc-950",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-400/10",
    border: "border-violet-200 dark:border-violet-400/25",
    glow: "0 0 0 1px rgba(139,92,246,0.2), 0 8px 24px rgba(139,92,246,0.16)",
    ring: "rgba(139, 92, 246, 0.4)",
    solid: "#8b5cf6",
    button:
      "bg-violet-100 text-violet-800 hover:bg-violet-200 border border-violet-300 dark:bg-violet-400/15 dark:text-violet-300 dark:hover:bg-violet-400/25 dark:border-violet-400/30",
    card: "border-violet-200 bg-white dark:border-violet-400/25 dark:bg-zinc-950",
  },
  warm: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50/80 dark:bg-amber-400/10",
    border: "border-amber-300 dark:border-amber-400/30",
    glow: "0 0 0 1px rgba(217,119,6,0.2), 0 8px 24px rgba(217,119,6,0.16)",
    ring: "rgba(217, 119, 6, 0.4)",
    solid: "#d97706",
    button:
      "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-400 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:bg-amber-400/25 dark:border-amber-400/35",
    card: "border-amber-200 bg-white dark:border-amber-400/25 dark:bg-zinc-950",
  },
};

export function breakTypeAccent(theme: BreakTheme): StateAccent {
  return BREAK_THEME_ACCENTS[theme];
}

export function stateAccent(state: SessionState) {
  switch (state) {
    case "LOCKED_IN":
      return {
        text: "text-emerald-600 dark:text-lime-400",
        bg: "bg-emerald-50 dark:bg-lime-400/10",
        border: "border-emerald-200 dark:border-lime-400/25",
        glow: "0 0 0 1px rgba(16,185,129,0.25), 0 8px 28px rgba(132,204,22,0.28)",
        ring: "rgba(132, 204, 22, 0.55)",
        solid: "#84cc16",
        button:
          "bg-lime-400 text-slate-950 hover:bg-lime-300 border border-lime-500/40",
        card: "border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-950",
      };
    case "CHOOSING_BREAK":
    case "ON_BREAK":
    case "BREAK_DONE":
      return {
        text: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-400/10",
        border: "border-amber-200 dark:border-amber-400/25",
        glow: "0 0 0 1px rgba(245,158,11,0.2), 0 8px 24px rgba(245,158,11,0.18)",
        ring: "rgba(245, 158, 11, 0.45)",
        solid: "#f59e0b",
        button:
          "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 dark:bg-amber-400/15 dark:text-amber-300 dark:hover:bg-amber-400/25 dark:border-amber-400/30",
        card: "border-amber-200 bg-white dark:border-amber-400/25 dark:bg-zinc-950",
      };
    case "TAPPED_OUT":
      return {
        text: "text-red-400/80 dark:text-red-300/90",
        bg: "bg-red-50 dark:bg-red-500/10",
        border: "border-red-200/70 dark:border-red-400/30",
        glow: "none",
        ring: "rgba(248, 113, 113, 0.35)",
        solid: "#f87171",
        button:
          "bg-red-100/80 text-red-700/80 hover:bg-red-100 border border-red-200/80 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 dark:border-red-400/30",
        card: "border-red-200/60 bg-red-50/40 dark:border-red-400/25 dark:bg-red-500/10",
      };
    default:
      return {
        text: "text-slate-500 dark:text-zinc-400",
        bg: "bg-slate-100 dark:bg-white/5",
        border: "border-slate-200 dark:border-white/10",
        glow: "none",
        ring: "rgba(148, 163, 184, 0.35)",
        solid: "#94a3b8",
        button:
          "bg-slate-800 text-white hover:bg-slate-700 border border-slate-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:border-zinc-200",
        card: "border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-950",
      };
  }
}
