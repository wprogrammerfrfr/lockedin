"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Clock,
  Code,
  GitCommitHorizontal,
  Moon,
  SunMedium,
  Sunrise,
  Wrench,
} from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import {
  buildActivityStats,
  formatCodingDuration,
  formatCodingDurationTick,
  type DayActivity,
  type LateNightSession,
} from "@/features/dev-mode/activity-stats";
import { billingMonths } from "@/features/dev-mode/cost";
import type { ProjectStats } from "@/features/dev-mode/DevModeProvider";
import { cn } from "@/lib/utils";
import type { ProjectRow } from "@/types/database";

function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime() + 1000;
}

function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const t = setTimeout(() => setToday(new Date()), msUntilNextMidnight(today));
    return () => clearTimeout(t);
  }, [today]);
  return today;
}

function StatTile({
  icon,
  label,
  children,
  sub,
  dense,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  dense?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div
        className={cn(
          "min-w-0 font-bold text-foreground",
          dense ? "text-lg leading-snug sm:text-xl" : "text-3xl leading-none sm:text-4xl",
        )}
      >
        {children}
      </div>
      {sub ? (
        <div className="min-w-0 text-xs leading-snug text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}

function Dash() {
  return <span className="font-mono text-muted-foreground">—</span>;
}

function formatRate(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString("en-US");
  return n.toFixed(1);
}

function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function shareLabel(part: number, total: number): string {
  if (total <= 0) return "";
  return `${Math.round((part / total) * 100)}% of commits`;
}

function formatDayKey(key: string, now: Date): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: year === now.getFullYear() ? undefined : "numeric",
  }).format(new Date(year, month - 1, day));
}

function dayHours(day: DayActivity): string {
  return formatCodingDuration(day.codingMs / 3_600_000);
}

function formatSession(session: LateNightSession): string {
  const start = new Date(session.start);
  const end = new Date(session.end);
  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const sameMinute =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate() &&
    start.getHours() === end.getHours() &&
    start.getMinutes() === end.getMinutes();

  if (sameMinute) {
    const point = `${date.format(start)} · ${time.format(start)}`;
    return session.commits > 1 ? `${point} · ${session.commits} commits` : point;
  }

  const sameDay = start.toDateString() === end.toDateString();
  const range = sameDay
    ? `${date.format(start)}, ${time.format(start)} – ${time.format(end)}`
    : `${date.format(start)}, ${time.format(start)} – ${date.format(end)}, ${time.format(end)}`;
  const noun = session.commits === 1 ? "commit" : "commits";
  return `${range} · ${session.commits} ${noun}`;
}

const CHRONOTYPE_LABEL = {
  morning: "Morning",
  night: "Night",
  split: "Split",
} as const;

export function NerdStats({
  project,
  commits,
  code,
}: {
  project: ProjectRow;
  commits: { committed_at: string; message?: string }[];
  code?: ProjectStats;
}) {
  const today = useToday();
  const activity = buildActivityStats(commits, {
    startIso: project.first_commit_at,
    now: today,
  });
  const hasCommits = activity.commitCount > 0;
  const sameBestDay =
    activity.bestCommitDay != null &&
    activity.bestTimeDay != null &&
    activity.bestCommitDay.key === activity.bestTimeDay.key;

  const months =
    activity.months > 0
      ? activity.months
      : project.first_commit_at
        ? billingMonths(project.first_commit_at, today)
        : 0;
  const lineReady = Boolean(code) && !code?.error && !code?.pending;
  const additions = code?.additions ?? 0;
  const deletions = code?.deletions ?? 0;
  const changedPerMonth = months > 0 ? (additions + deletions) / months : 0;

  return (
    <div className="flex flex-col gap-5">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Avg coding"
        sub={
          hasCommits
            ? `per month · ${formatCodingDuration(activity.avgHoursPerDay)} per day`
            : undefined
        }
      >
        {hasCommits ? (
          <CountUp
            value={activity.avgHoursPerMonth}
            format={(n) => formatCodingDurationTick(activity.avgHoursPerMonth, n)}
          />
        ) : (
          <Dash />
        )}
      </StatTile>

      <StatTile
        icon={<CalendarDays className="h-3.5 w-3.5 text-amber-400" />}
        label="Best day"
        dense={!sameBestDay && hasCommits}
        sub={
          hasCommits && sameBestDay && activity.bestCommitDay
            ? `${activity.bestCommitDay.commits} commits · ${dayHours(activity.bestCommitDay)}`
            : undefined
        }
      >
        {hasCommits && activity.bestCommitDay && activity.bestTimeDay ? (
          sameBestDay ? (
            <span className="font-mono tabular-nums">
              {formatDayKey(activity.bestCommitDay.key, today)}
            </span>
          ) : (
            <span className="flex flex-col gap-1 font-mono tabular-nums">
              <span>
                {formatDayKey(activity.bestCommitDay.key, today)} ·{" "}
                {activity.bestCommitDay.commits} commits
              </span>
              <span className="text-muted-foreground">
                {formatDayKey(activity.bestTimeDay.key, today)} ·{" "}
                {dayHours(activity.bestTimeDay)}
              </span>
            </span>
          )
        ) : (
          <Dash />
        )}
      </StatTile>

      <StatTile
        icon={<GitCommitHorizontal className="h-3.5 w-3.5" />}
        label="Avg commits"
        sub={hasCommits ? "per month" : undefined}
      >
        {hasCommits ? (
          <CountUp value={activity.avgCommitsPerMonth} format={formatRate} />
        ) : (
          <Dash />
        )}
      </StatTile>

      <StatTile
        icon={
          activity.chronotype === "morning" ? (
            <Sunrise className="h-3.5 w-3.5 text-amber-400" />
          ) : activity.chronotype === "night" ? (
            <Moon className="h-3.5 w-3.5" />
          ) : (
            <SunMedium className="h-3.5 w-3.5" />
          )
        }
        label="Morning or night"
        sub={
          hasCommits
            ? `${activity.nightCommits} night · ${activity.morningCommits} morning`
            : undefined
        }
      >
        {hasCommits && activity.chronotype ? (
          <span className="font-display">{CHRONOTYPE_LABEL[activity.chronotype]}</span>
        ) : (
          <Dash />
        )}
      </StatTile>

      <StatTile
        icon={<Wrench className="h-3.5 w-3.5" />}
        label="Fix commits"
        sub={hasCommits ? shareLabel(activity.fixCommits, activity.commitCount) : undefined}
      >
        {hasCommits ? <CountUp value={activity.fixCommits} format={formatCount} /> : <Dash />}
      </StatTile>

      <StatTile
        icon={<Moon className="h-3.5 w-3.5" />}
        label="Late night"
        sub={
          hasCommits
            ? shareLabel(activity.lateNightCommits, activity.commitCount)
            : undefined
        }
      >
        {hasCommits ? (
          <CountUp value={activity.lateNightCommits} format={formatCount} />
        ) : (
          <Dash />
        )}
      </StatTile>

      <StatTile
        icon={<Code className="h-3.5 w-3.5 text-lime-400" />}
        label="Lines written"
        sub={
          lineReady
            ? `+${formatCount(additions)} / −${formatCount(deletions)}${
                months > 0 ? ` · ${formatRate(changedPerMonth)} changed / mo` : ""
              }`
            : undefined
        }
      >
        {code?.pending ? (
          <span className="font-mono text-lg text-muted-foreground sm:text-xl">Calculating…</span>
        ) : lineReady ? (
          <CountUp value={additions} format={formatCount} className="text-lime-400" />
        ) : (
          <Dash />
        )}
      </StatTile>
    </div>

    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <Moon className="h-3.5 w-3.5" />
        Late night sessions
      </h2>
      {activity.lateNightSessions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No late night sessions</p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {activity.lateNightSessions.map((session) => (
            <li
              key={`${session.start}-${session.end}`}
              className="font-mono text-sm tabular-nums text-foreground"
            >
              {formatSession(session)}
            </li>
          ))}
        </ul>
      )}
    </section>
    </div>
  );
}
