"use client";

import { motion } from "framer-motion";
import { springSoft } from "@/components/session/state-accent";

export function ClosingBanner({ secondsLeft }: { secondsLeft: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="rounded-xl border border-amber-400 bg-amber-100 px-4 py-3 text-sm text-amber-950"
      style={{
        boxShadow:
          "0 0 0 1px rgba(245,158,11,0.25), 0 8px 24px rgba(245,158,11,0.22)",
      }}
    >
      <p className="font-display font-bold">Room closing</p>
      <p className="mt-1 text-amber-900/90">
        Not enough members. Auto-closes in{" "}
        <span className="font-mono font-bold tabular-nums">{secondsLeft}s</span>.
      </p>
    </motion.div>
  );
}
