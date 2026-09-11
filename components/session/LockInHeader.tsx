"use client";

import { Flame } from "lucide-react";

import { LockedInLogo } from "@/components/brand/LockedInLogo";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";

export function LockInHeader({
  streak,
  muted,
}: {
  streak: number;
  muted?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-2 transition-[filter,opacity] sm:gap-4",
        muted && "opacity-80 saturate-50",
      )}
    >
      <LockedInLogo
        as="h1"
        className="hidden text-3xl tracking-tight lg:inline-flex"
      />

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <InstallAppButton />
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3 py-1.5",
            muted
              ? "border-red-200/70 bg-red-50/70 dark:border-red-400/30 dark:bg-red-500/10"
              : "border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10",
          )}
        >
          <Flame
            className={cn(
              "h-4 w-4",
              muted
                ? "text-red-400"
                : "text-amber-500 dark:text-amber-400",
            )}
          />
          <CountUp
            value={streak}
            className={cn(
              "text-sm font-semibold",
              muted
                ? "text-red-600/80 dark:text-red-300/90"
                : "text-amber-700 dark:text-amber-400",
            )}
          />
          <span
            className={cn(
              "text-xs",
              muted
                ? "text-red-500/70 dark:text-red-400/70"
                : "text-amber-600/80 dark:text-amber-400/80",
            )}
          >
            streak
          </span>
        </div>
      </div>
    </header>
  );
}
