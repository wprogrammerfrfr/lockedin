import type { SessionState } from "@/features/session/types";

export const springSoft = { type: "spring" as const, stiffness: 260, damping: 28 };

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
