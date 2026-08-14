"use client";

import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMs } from "@/features/session/format";
import type { HeatmapDay } from "@/types/database";
import { cn } from "@/lib/utils";

function levelFromMs(ms: number): 0 | 1 | 2 | 3 | 4 {
  if (ms <= 0) return 0;
  if (ms < 30 * 60_000) return 1;
  if (ms < 2 * 60 * 60_000) return 2;
  if (ms < 4 * 60 * 60_000) return 3;
  return 4;
}

const LEVEL_CLASS = [
  "bg-slate-100",
  "bg-emerald-100",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-600",
] as const;

function buildGrid(days: HeatmapDay[], weeks = 53) {
  const map = new Map(days.map((d) => [d.day, Number(d.active_ms) || 0]));
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const end = new Date(today);
  const cells: { date: string; ms: number }[] = [];
  const total = weeks * 7;
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, ms: map.get(key) ?? 0 });
  }
  return cells;
}

export function ContributionHeatmap({
  days = [],
}: {
  days?: HeatmapDay[];
}) {
  const [cells, setCells] = useState<{ date: string; ms: number }[] | null>(
    null,
  );

  useEffect(() => {
    setCells(buildGrid(days, 53));
  }, [days]);

  if (!cells) {
    return (
      <p className="text-sm text-slate-400">Loading contribution grid…</p>
    );
  }

  const weeks: (typeof cells)[] = [];
  for (let w = 0; w < 53; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  return (
    <div className="overflow-x-auto">
      <TooltipProvider delayDuration={100}>
        <div className="inline-flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((cell) => {
                const level = levelFromMs(cell.ms);
                return (
                  <Tooltip key={cell.date}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-sm sm:h-3 sm:w-3",
                          LEVEL_CLASS[level],
                        )}
                        aria-label={`${cell.date}: ${formatMs(cell.ms, true)}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      <p>{cell.date}</p>
                      <p className="font-mono tabular-nums">
                        {formatMs(cell.ms, true)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </TooltipProvider>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
        <span>Less</span>
        {LEVEL_CLASS.map((c) => (
          <span key={c} className={cn("h-2.5 w-2.5 rounded-sm", c)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
