"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Clock, GitCommitHorizontal, Hammer, Wallet } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { buildCost, formatUsd } from "@/features/dev-mode/cost";
import { cn } from "@/lib/utils";
import type { ProjectRow } from "@/types/database";

const DAY_MS = 86_400_000;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysSince(iso: string, now: Date): number {
  const diff = startOfLocalDay(now) - startOfLocalDay(new Date(iso));
  return Math.max(0, Math.round(diff / DAY_MS));
}

function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime() + 1000;
}

/** Re-renders at local midnight so day and month counts roll over. */
function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const t = setTimeout(
      () => setToday(new Date()),
      msUntilNextMidnight(today),
    );
    return () => clearTimeout(t);
  }, [today]);
  return today;
}

function StatTile({
  icon,
  label,
  children,
  sub,
  accent,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-4 sm:p-5",
        accent ? "border-amber-400/30" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="min-w-0 text-3xl font-bold leading-none text-foreground sm:text-4xl">
        {children}
      </div>
      {sub ? (
        <div className="min-w-0 truncate text-xs text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}

export function OverviewStats({
  project,
  commitCount,
  activeMs,
}: {
  project: ProjectRow;
  commitCount: number;
  activeMs: number;
}) {
  const today = useToday();
  const start = project.first_commit_at ?? null;
  const cost = buildCost(project.monthly_cost_usd, start, today);
  const editHref = `/dev/projects?edit=${project.id}`;

  const startedLabel = start
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(start))
    : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        icon={<Hammer className="h-3.5 w-3.5 text-amber-400" />}
        label="Building since"
        sub={startedLabel ? `Started ${startedLabel}` : "Sync to find the first commit"}
      >
        {start ? (
          <span className="flex items-baseline gap-1.5">
            <CountUp value={daysSince(start, today)} />
            <span className="text-sm font-medium text-muted-foreground">days</span>
          </span>
        ) : (
          <span className="font-mono text-muted-foreground">—</span>
        )}
      </StatTile>

      <StatTile
        icon={<Wallet className="h-3.5 w-3.5 text-amber-400" />}
        label="Cost to build"
        accent={cost != null}
        sub={
          cost ? (
            <span className="font-mono tabular-nums">
              {cost.months} mo × {formatUsd(project.monthly_cost_usd, 2)}/mo
            </span>
          ) : project.monthly_cost_usd == null ? (
            <Link href={editHref} className="underline underline-offset-2 hover:text-foreground">
              Set a monthly cost
            </Link>
          ) : (
            "Sync to calculate"
          )
        }
      >
        {cost ? (
          <CountUp
            value={cost.total}
            format={(n) => formatUsd(n)}
            className="text-amber-300"
          />
        ) : (
          <span className="font-mono text-muted-foreground">—</span>
        )}
      </StatTile>

      <StatTile
        icon={<GitCommitHorizontal className="h-3.5 w-3.5" />}
        label="Commits"
        sub="by you"
      >
        <CountUp value={commitCount} />
      </StatTile>

      <StatTile
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Hours locked in"
        sub="sessions tagged to this project"
      >
        <CountUp
          value={activeMs / 3_600_000}
          format={(n) => `${n.toFixed(1)}h`}
        />
      </StatTile>
    </div>
  );
}
