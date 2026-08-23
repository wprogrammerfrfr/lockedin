import type { BreakTheme } from "@/features/session/break-types";
import type { SessionState } from "@/features/session/types";

export const springSoft = { type: "spring" as const, stiffness: 260, damping: 28 };

export type StateAccent = ReturnType<typeof stateAccent>;

const BREAK_THEME_ACCENTS: Record<
  BreakTheme,
  Omit<StateAccent, "card"> & { card: string }
> = {
  sky: {
    text: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    glow: "0 0 0 1px rgba(14,165,233,0.2), 0 8px 24px rgba(14,165,233,0.18)",
    ring: "rgba(14, 165, 233, 0.45)",
    solid: "#0ea5e9",
    button:
      "bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-300",
    card: "border-sky-200 bg-white",
  },
  amber: {
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    glow: "0 0 0 1px rgba(245,158,11,0.2), 0 8px 24px rgba(245,158,11,0.18)",
    ring: "rgba(245, 158, 11, 0.45)",
    solid: "#f59e0b",
    button:
      "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300",
    card: "border-amber-200 bg-white",
  },
  emerald: {
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    glow: "0 0 0 1px rgba(16,185,129,0.2), 0 8px 24px rgba(16,185,129,0.18)",
    ring: "rgba(16, 185, 129, 0.45)",
    solid: "#10b981",
    button:
      "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300",
    card: "border-emerald-200 bg-white",
  },
  slate: {
    text: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-300",
    glow: "0 0 0 1px rgba(100,116,139,0.2), 0 8px 24px rgba(100,116,139,0.15)",
    ring: "rgba(100, 116, 139, 0.4)",
    solid: "#64748b",
    button:
      "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300",
    card: "border-slate-200 bg-white",
  },
  rose: {
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    glow: "0 0 0 1px rgba(244,63,94,0.2), 0 8px 24px rgba(244,63,94,0.16)",
    ring: "rgba(244, 63, 94, 0.4)",
    solid: "#f43f5e",
    button:
      "bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300",
    card: "border-rose-200 bg-white",
  },
  orange: {
    text: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    glow: "0 0 0 1px rgba(249,115,22,0.2), 0 8px 24px rgba(249,115,22,0.16)",
    ring: "rgba(249, 115, 22, 0.4)",
    solid: "#f97316",
    button:
      "bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-300",
    card: "border-orange-200 bg-white",
  },
  teal: {
    text: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
    glow: "0 0 0 1px rgba(20,184,166,0.2), 0 8px 24px rgba(20,184,166,0.16)",
    ring: "rgba(20, 184, 166, 0.4)",
    solid: "#14b8a6",
    button:
      "bg-teal-100 text-teal-800 hover:bg-teal-200 border border-teal-300",
    card: "border-teal-200 bg-white",
  },
  violet: {
    text: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    glow: "0 0 0 1px rgba(139,92,246,0.2), 0 8px 24px rgba(139,92,246,0.16)",
    ring: "rgba(139, 92, 246, 0.4)",
    solid: "#8b5cf6",
    button:
      "bg-violet-100 text-violet-800 hover:bg-violet-200 border border-violet-300",
    card: "border-violet-200 bg-white",
  },
  warm: {
    text: "text-amber-700",
    bg: "bg-amber-50/80",
    border: "border-amber-300",
    glow: "0 0 0 1px rgba(217,119,6,0.2), 0 8px 24px rgba(217,119,6,0.16)",
    ring: "rgba(217, 119, 6, 0.4)",
    solid: "#d97706",
    button:
      "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-400",
    card: "border-amber-200 bg-white",
  },
};

export function breakTypeAccent(theme: BreakTheme): StateAccent {
  return BREAK_THEME_ACCENTS[theme];
}

export function stateAccent(state: SessionState) {
  switch (state) {
    case "LOCKED_IN":
      return {
        text: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        glow: "0 0 0 1px rgba(16,185,129,0.25), 0 8px 28px rgba(132,204,22,0.28)",
        ring: "rgba(132, 204, 22, 0.55)",
        solid: "#84cc16",
        button:
          "bg-lime-400 text-slate-950 hover:bg-lime-300 border border-lime-500/40",
        card: "border-slate-200 bg-white",
      };
    case "CHOOSING_BREAK":
    case "ON_BREAK":
    case "BREAK_DONE":
      return {
        text: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        glow: "0 0 0 1px rgba(245,158,11,0.2), 0 8px 24px rgba(245,158,11,0.18)",
        ring: "rgba(245, 158, 11, 0.45)",
        solid: "#f59e0b",
        button:
          "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300",
        card: "border-amber-200 bg-white",
      };
    case "TAPPED_OUT":
      return {
        text: "text-red-400/80",
        bg: "bg-red-50",
        border: "border-red-200/70",
        glow: "none",
        ring: "rgba(248, 113, 113, 0.35)",
        solid: "#f87171",
        button:
          "bg-red-100/80 text-red-700/80 hover:bg-red-100 border border-red-200/80",
        card: "border-red-200/60 bg-red-50/40",
      };
    default:
      return {
        text: "text-slate-500",
        bg: "bg-slate-100",
        border: "border-slate-200",
        glow: "none",
        ring: "rgba(148, 163, 184, 0.35)",
        solid: "#94a3b8",
        button:
          "bg-slate-800 text-white hover:bg-slate-700 border border-slate-900",
        card: "border-slate-200 bg-white",
      };
  }
}
