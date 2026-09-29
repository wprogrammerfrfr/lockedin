"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildActivityStats } from "@/features/dev-mode/activity-stats";
import { WEEKDAYS, buildMonthGrid, monthLabel, toDayKey } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { ProjectCommitRow } from "@/types/database";

function levelFromCount(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n < 3) return 1;
  if (n < 6) return 2;
  if (n < 10) return 3;
  return 4;
}

const LEVEL_CLASS = [
  "bg-muted text-muted-foreground",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200",
  "bg-emerald-300 text-emerald-950 dark:bg-emerald-400/40 dark:text-emerald-50",
  "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white",
  "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-zinc-950",
] as const;

const MAX_CELL_MESSAGES = 2;

function cursorFor(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() };
}

function formatDayTitle(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function CellBadge({
  children,
  tone,
}: {
  children: string;
  tone: "amber" | "ink";
}) {
  return (
    <span
      className={cn(
        "rounded-md px-1 text-[8px] font-bold uppercase tracking-wider sm:text-[9px]",
        tone === "amber" ? "bg-amber-400 text-zinc-950" : "bg-zinc-950 text-white",
      )}
    >
      {children}
    </span>
  );
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function CommitCalendar({
  commits,
  firstCommitAt,
}: {
  commits: ProjectCommitRow[];
  firstCommitAt?: string | null;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, ProjectCommitRow[]>();
    for (const c of commits) {
      const key = toDayKey(new Date(c.committed_at));
      const list = map.get(key);
      if (list) list.push(c);
      else map.set(key, [c]);
    }
    return map;
  }, [commits]);

  const activity = useMemo(() => buildActivityStats(commits), [commits]);
  const lateNightDays = useMemo(
    () => new Set(activity.lateNightDayKeys),
    [activity],
  );
  const fixDays = useMemo(() => new Set(activity.fixDayKeys), [activity]);

  const startKey = firstCommitAt ? toDayKey(new Date(firstCommitAt)) : null;
  const latestAt = commits.length
    ? commits[commits.length - 1].committed_at
    : null;

  const [cursor, setCursor] = useState(() =>
    cursorFor(latestAt ? new Date(latestAt) : new Date()),
  );
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [cursorAnchor, setCursorAnchor] = useState(latestAt);

  if (cursorAnchor !== latestAt) {
    setCursorAnchor(latestAt);
    setCursor(cursorFor(latestAt ? new Date(latestAt) : new Date()));
  }

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const monthCount = useMemo(
    () =>
      cells.reduce(
        (sum, c) =>
          c.kind === "day" ? sum + (byDay.get(c.date)?.length ?? 0) : sum,
        0,
      ),
    [cells, byDay],
  );

  function shiftMonth(delta: number) {
    setCursor((prev) =>
      cursorFor(new Date(prev.year, prev.month + delta, 1)),
    );
  }

  function marksFor(date: string | null): string[] {
    if (!date) return [];
    const marks: string[] = [];
    if (activity.bestCommitDay?.key === date) marks.push("Best day");
    if (
      activity.bestTimeDay?.key === date &&
      activity.bestTimeDay.key !== activity.bestCommitDay?.key
    ) {
      marks.push("Longest");
    }
    if (lateNightDays.has(date)) marks.push("Late night");
    if (fixDays.has(date)) marks.push("Fix");
    return marks;
  }

  const openCommits = openDay ? (byDay.get(openDay) ?? []) : [];
  const openMarks = marksFor(openDay);

  return (
    <div className="w-full">
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
        <div className="flex flex-col items-center">
          <p className="font-display text-sm font-semibold text-foreground">
            {monthLabel(cursor.year, cursor.month)}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {monthCount} {monthCount === 1 ? "commit" : "commits"}
          </p>
        </div>
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
            className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          if (cell.kind === "empty") {
            return (
              <div key={cell.key} className="min-h-[4.5rem] sm:min-h-[5.5rem]" />
            );
          }
          const dayCommits = byDay.get(cell.date) ?? [];
          const count = dayCommits.length;
          const isStart = cell.date === startKey;
          const isBest = activity.bestCommitDay?.key === cell.date;
          const isLongest =
            activity.bestTimeDay?.key === cell.date &&
            activity.bestTimeDay.key !== activity.bestCommitDay?.key;
          const isNight = lateNightDays.has(cell.date);
          const isFix = fixDays.has(cell.date);
          const shown = dayCommits.slice(0, MAX_CELL_MESSAGES);
          const extra = count - shown.length;
          const marks = marksFor(cell.date);
          const label = `${cell.date}: ${count} ${count === 1 ? "commit" : "commits"}${isStart ? " (project start)" : ""}${marks.length ? ` · ${marks.join(" · ")}` : ""}`;

          return (
            <button
              key={cell.key}
              type="button"
              aria-label={label}
              title={label}
              disabled={count === 0 && !isStart}
              onClick={() => setOpenDay(cell.date)}
              className={cn(
                "flex min-h-[4.5rem] min-w-0 flex-col items-stretch justify-start gap-0.5 overflow-hidden rounded-xl p-1.5 text-left transition sm:min-h-[5.5rem] sm:p-2",
                LEVEL_CLASS[levelFromCount(count)],
                cell.isToday && "ring-2 ring-slate-400 ring-offset-1",
                isStart &&
                  "ring-2 ring-amber-400 ring-offset-1 ring-offset-background shadow-[0_0_18px_rgba(251,191,36,0.35)]",
                count > 0 || isStart
                  ? "cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  : "cursor-default",
              )}
            >
              <span className="flex flex-wrap items-center gap-0.5">
                <span className="font-mono text-xs font-semibold tabular-nums sm:text-sm">
                  {cell.dayNum}
                </span>
                {isStart ? <CellBadge tone="amber">Started</CellBadge> : null}
                {isBest ? <CellBadge tone="amber">Best</CellBadge> : null}
                {isLongest ? <CellBadge tone="amber">Longest</CellBadge> : null}
                {isNight ? <CellBadge tone="ink">Night</CellBadge> : null}
                {isFix ? <CellBadge tone="ink">Fix</CellBadge> : null}
              </span>
              {shown.map((c) => (
                <span
                  key={c.sha}
                  className="line-clamp-1 break-all text-[9px] font-medium leading-tight opacity-90 sm:text-[10px]"
                >
                  {c.message || c.sha.slice(0, 7)}
                </span>
              ))}
              {extra > 0 ? (
                <span className="font-mono text-[9px] tabular-nums opacity-75 sm:text-[10px]">
                  +{extra} more
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Less</span>
          {LEVEL_CLASS.map((c, i) => (
            <span
              key={i}
              className={cn("h-3 w-3 rounded-md", c.split(" ")[0])}
            />
          ))}
          <span>More</span>
        </div>
        {firstCommitAt ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-xs"
            onClick={() => setCursor(cursorFor(new Date(firstCommitAt)))}
          >
            <Flag className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            Jump to start
          </Button>
        ) : null}
      </div>

      {commits.length > 0 && monthCount === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No commits this month — try another month.
        </p>
      ) : null}

      <Dialog
        open={openDay != null}
        onOpenChange={(open) => {
          if (!open) setOpenDay(null);
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openDay ? formatDayTitle(openDay) : ""}</DialogTitle>
            <DialogDescription>
              <span className="font-mono tabular-nums">{openCommits.length}</span>{" "}
              {openCommits.length === 1 ? "commit" : "commits"}
              {openDay && openDay === startKey ? " · project started" : ""}
              {openMarks.length ? ` · ${openMarks.join(" · ")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {openCommits.map((c) => (
              <li
                key={c.sha}
                className="flex items-start gap-3 rounded-xl border border-border bg-background p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm text-foreground">
                    {c.message || "(no message)"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatTime(c.committed_at)} · {c.sha.slice(0, 7)}
                  </p>
                </div>
                {c.html_url ? (
                  <a
                    href={c.html_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open commit on GitHub"
                    className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
