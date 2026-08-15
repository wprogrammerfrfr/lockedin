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

type DayMeta = { ms: number; title: string | null };

type CalendarCell =
  | { kind: "empty"; key: string }
  | {
      kind: "day";
      key: string;
      date: string;
      dayNum: number;
      ms: number;
      title: string | null;
      isToday: boolean;
    };

function buildMonthCells(
  year: number,
  month: number,
  byDay: Map<string, DayMeta>,
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
    const meta = byDay.get(date);
    cells.push({
      kind: "day",
      key: date,
      date,
      dayNum: day,
      ms: meta?.ms ?? 0,
      title: meta?.title ?? null,
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

  const byDay = useMemo(() => {
    const map = new Map<string, DayMeta>();
    for (const d of days) {
      const key =
        typeof d.day === "string"
          ? d.day.slice(0, 10)
          : String(d.day).slice(0, 10);
      map.set(key, {
        ms: Number(d.active_ms) || 0,
        title: d.title?.trim() || null,
      });
    }
    return map;
  }, [days]);

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month, byDay),
    [cursor.year, cursor.month, byDay],
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
    () => [...byDay.values()].reduce((a, b) => a + b.ms, 0),
    [byDay],
  );

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="w-full">
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

      <div className="mb-1.5 grid grid-cols-7 gap-2">
        {WEEKDAYS.map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          if (cell.kind === "empty") {
            return <div key={cell.key} className="min-h-[4.5rem] sm:min-h-[5.5rem]" />;
          }
          const level = levelFromMs(cell.ms);
          const label = cell.title
            ? `${cell.date}: ${cell.title} · ${formatMs(cell.ms, true)}`
            : `${cell.date}: ${formatMs(cell.ms, true)}`;
          const className = cn(
            "flex min-h-[4.5rem] flex-col items-stretch justify-start gap-0.5 rounded-xl p-1.5 text-left transition sm:min-h-[5.5rem] sm:p-2",
            LEVEL_CLASS[level],
            cell.isToday && "ring-2 ring-slate-400 ring-offset-1",
            onDayClick &&
              "cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          );

          const content = (
            <>
              <span className="text-xs font-semibold tabular-nums sm:text-sm">
                {cell.dayNum}
              </span>
              {cell.title ? (
                <span className="line-clamp-2 text-[9px] font-medium leading-tight opacity-90 sm:text-[10px]">
                  {cell.title}
                </span>
              ) : null}
            </>
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
                {content}
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
              {content}
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
