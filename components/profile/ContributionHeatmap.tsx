"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  "bg-slate-100 text-slate-500",
  "bg-emerald-100 text-emerald-800",
  "bg-emerald-300 text-emerald-950",
  "bg-emerald-500 text-white",
  "bg-emerald-600 text-white",
] as const;

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

type CalendarCell =
  | { kind: "empty"; key: string }
  | { kind: "day"; key: string; date: string; dayNum: number; ms: number; isToday: boolean };

function buildMonthCells(
  year: number,
  month: number,
  msByDay: Map<string, number>,
): CalendarCell[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = first.getDay(); // 0 = Sunday
  const todayKey = toDayKey(new Date());

  const cells: CalendarCell[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ kind: "empty", key: `pad-start-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = toDayKey(new Date(year, month, day));
    cells.push({
      kind: "day",
      key: date,
      date,
      dayNum: day,
      ms: msByDay.get(date) ?? 0,
      isToday: date === todayKey,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ kind: "empty", key: `pad-end-${cells.length}` });
  }
  return cells;
}

export function ContributionHeatmap({
  days = [],
  onDayClick,
  emptyHint,
}: {
  days?: HeatmapDay[];
  onDayClick?: (date: string, ms: number) => void;
  emptyHint?: boolean;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const msByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of days) {
      const key =
        typeof d.day === "string"
          ? d.day.slice(0, 10)
          : String(d.day).slice(0, 10);
      map.set(key, Number(d.active_ms) || 0);
    }
    return map;
  }, [days]);

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month, msByDay),
    [cursor.year, cursor.month, msByDay],
  );

  const monthMs = useMemo(
    () =>
      cells.reduce(
        (sum, c) => (c.kind === "day" ? sum + c.ms : sum),
        0,
      ),
    [cells],
  );

  const totalMs = useMemo(
    () => [...msByDay.values()].reduce((a, b) => a + b, 0),
    [msByDay],
  );

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="w-full max-w-md">
      {emptyHint && totalMs <= 0 ? (
        <p className="mb-3 text-sm text-slate-400">
          No focus yet —{" "}
          <Link href="/lockin" className="font-medium text-slate-700 underline">
            LOCK IN
          </Link>{" "}
          to light up the calendar.
        </p>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-display text-sm font-semibold text-slate-800">
          {monthLabel(cursor.year, cursor.month)}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          if (cell.kind === "empty") {
            return <div key={cell.key} className="aspect-square" />;
          }
          const level = levelFromMs(cell.ms);
          const label = `${cell.date}: ${formatMs(cell.ms, true)}`;
          const className = cn(
            "flex aspect-square min-h-[2.5rem] items-center justify-center rounded-xl text-sm font-medium tabular-nums transition sm:min-h-[2.75rem]",
            LEVEL_CLASS[level],
            cell.isToday && "ring-2 ring-slate-400 ring-offset-1",
            onDayClick &&
              "cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          );

          if (onDayClick) {
            return (
              <button
                key={cell.key}
                type="button"
                className={className}
                aria-label={label}
                title={label}
                onClick={() => onDayClick(cell.date, cell.ms)}
              >
                {cell.dayNum}
              </button>
            );
          }

          return (
            <div
              key={cell.key}
              className={className}
              aria-label={label}
              title={label}
            >
              {cell.dayNum}
            </div>
          );
        })}
      </div>

      {monthMs <= 0 && totalMs > 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          No sessions this month — try another month.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400">
        <span>Less</span>
        {LEVEL_CLASS.map((c, i) => (
          <span
            key={i}
            className={cn("h-3 w-3 rounded-md", c.split(" ")[0])}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
