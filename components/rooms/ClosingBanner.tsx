"use client";

import { motion } from "framer-motion";
import { springSoft } from "@/components/session/state-accent";

export function ClosingBanner({ secondsLeft }: { secondsLeft: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-display font-semibold">Room closing</p>
      <p className="mt-1 text-amber-800/80">
        Not enough members. Auto-closes in{" "}
        <span className="font-mono tabular-nums">{secondsLeft}s</span>.
      </p>
    </motion.div>
  );
}
