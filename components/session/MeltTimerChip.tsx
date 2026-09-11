"use client";

import { motion } from "framer-motion";
import { formatMs } from "@/features/session/format";
import { springSoft } from "@/components/session/state-accent";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

export function MeltTimerChip({
  elapsedMs,
  meltProgress,
  meltDurationMs,
  className,
  showElapsed = true,
}: {
  elapsedMs: number;
  meltProgress?: number;
  meltDurationMs?: number;
  className?: string;
  /** When false, only melt % / melts-in is shown (elapsed lives on FlipClock). */
  showElapsed?: boolean;
}) {
  const { t } = useTranslation();
  const pct = meltProgress !== undefined ? Math.round(meltProgress * 100) : null;
  const meltsInMs =
    meltDurationMs !== undefined && meltProgress !== undefined
      ? Math.max(0, meltDurationMs * (1 - meltProgress))
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className={cn(
        "rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-soft backdrop-blur-sm",
        className,
      )}
      role="status"
      aria-label={t("melt.timer.chipLabel", {
        elapsed: formatMs(elapsedMs, true),
        percent: pct ?? 0,
      })}
    >
      {showElapsed ? (
        <p className="font-mono text-sm tabular-nums text-foreground sm:text-base">
          {formatMs(elapsedMs, true)}
        </p>
      ) : null}
      {pct !== null && meltsInMs !== null ? (
        <p
          className={cn(
            "font-mono tabular-nums text-amber-700 dark:text-amber-400",
            showElapsed
              ? "text-center text-[9px]"
              : "text-xs sm:text-sm",
          )}
        >
          {t("melt.timer.meltsIn", {
            percent: pct,
            time: formatMs(meltsInMs, true),
          })}
        </p>
      ) : null}
    </motion.div>
  );
}
