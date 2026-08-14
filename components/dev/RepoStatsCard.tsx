"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMs } from "@/features/session/format";
import { computeProjectCost } from "@/features/dev-mode/api";
import type { ProjectRow } from "@/types/database";

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function RepoStatsCard({
  project,
  activeMs = 0,
  commits = 0,
  additions = 0,
  deletions = 0,
}: {
  project: ProjectRow;
  activeMs?: number;
  commits?: number;
  additions?: number;
  deletions?: number;
}) {
  const cost = computeProjectCost(activeMs, project.hourly_rate_usd);
  const value = project.project_value_usd;

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-base">{project.display_name}</CardTitle>
        <p className="font-mono text-xs text-slate-400">
          {project.github_repo || "No repo linked"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-slate-400">Commits</p>
            <p className="font-mono text-sm tabular-nums text-slate-800">
              {commits}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-slate-400">+LOC</p>
            <p className="font-mono text-sm tabular-nums text-emerald-700">
              {additions}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-slate-400">−LOC</p>
            <p className="font-mono text-sm tabular-nums text-rose-600">
              {deletions}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Hours locked in:{" "}
          <span className="font-mono tabular-nums">
            {formatMs(activeMs, true)}
          </span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Project Cost
            </p>
            <p className="mt-1 font-display text-xl font-bold text-slate-900">
              {money(cost)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              hours × hourly rate
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Project Value
            </p>
            <p className="mt-1 font-display text-xl font-bold text-slate-900">
              {money(value)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              manual worth / revenue
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
