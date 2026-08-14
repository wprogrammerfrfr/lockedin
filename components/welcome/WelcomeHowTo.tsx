"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Pause, Play } from "lucide-react";
import { springSoft } from "@/components/session/state-accent";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "idle" as const,
    label: "LOCK IN",
    emoji: "🙂",
    icon: Play,
    title: "Start a session",
    body: "Hit LOCK IN to start a timed focus session. Name it if you want — CS midterm grind, lab report, whatever you’re in for.",
    wrap: "border-slate-200 bg-white",
    selected: "border-slate-800 ring-2 ring-slate-800/15",
    iconWrap: "bg-slate-800 text-white",
    glow: undefined as string | undefined,
  },
  {
    id: "locked" as const,
    label: "LOCKED IN",
    emoji: "😏",
    icon: Lock,
    title: "Time counts",
    body: "The clock runs while you’re locked in. A lime glow marks the live session. Only active minutes count toward your hours.",
    wrap: "border-emerald-200 bg-white",
    selected: "border-lime-400 ring-2 ring-lime-400/40",
    iconWrap: "bg-lime-400 text-slate-950",
    glow: "0 0 0 1px rgba(16,185,129,0.25), 0 8px 28px rgba(132,204,22,0.28)",
  },
  {
    id: "break" as const,
    label: "BREAK",
    emoji: "😑",
    icon: Pause,
    title: "Pause without losing it",
    body: "BREAK pauses active time. Hydration, doomscroll, or touch grass — break minutes never count toward locked-in hours.",
    wrap: "border-amber-200 bg-white",
    selected: "border-amber-400 ring-2 ring-amber-300/50",
    iconWrap: "bg-amber-100 text-amber-800",
    glow: "0 0 0 1px rgba(245,158,11,0.2), 0 8px 24px rgba(245,158,11,0.18)",
  },
  {
    id: "tapout" as const,
    label: "TAP OUT",
    emoji: "😭",
    icon: Lock,
    title: "End early",
    body: "TAP OUT ends the session before you’re done. The timer sighs out — no red flash. You can still share the card.",
    wrap: "border-slate-200 bg-white",
    selected: "border-[#a8a3b5] ring-2 ring-[#a8a3b5]/40",
    iconWrap: "bg-slate-200 text-slate-600",
    glow: undefined as string | undefined,
  },
];

export function WelcomeHowTo() {
  const [active, setActive] = useState<(typeof STEPS)[number]["id"]>("locked");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {STEPS.map((step) => {
        const selected = active === step.id;
        const Icon = step.icon;
        return (
          <motion.button
            key={step.id}
            type="button"
            layout
            transition={springSoft}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => setActive(step.id)}
            onMouseEnter={() => setActive(step.id)}
            className={cn(
              "rounded-2xl border p-5 text-left shadow-soft transition-colors",
              step.wrap,
              selected && step.selected,
            )}
            style={{ boxShadow: selected ? step.glow : undefined }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  step.iconWrap,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-display text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {step.label}
              </span>
              <span className="ml-auto text-lg leading-none" aria-hidden>
                {step.emoji}
              </span>
            </div>
            <p className="font-display text-lg font-bold text-slate-900">
              {step.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {step.body}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}
