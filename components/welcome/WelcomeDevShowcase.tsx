"use client";

import { Code2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { formatMs } from "@/features/session/format";

const DEMO_HOURS_MS = 4 * 60 * 60 * 1000 + 12 * 60 * 1000;
const DEMO_COST = 336;
const DEMO_VALUE = 12_000;

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function WelcomeDevShowcase() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Code2 className="h-5 w-5 text-emerald-600" />
          Developer Mode
        </CardTitle>
        <div>
          <p className="font-display text-lg font-bold tracking-tight text-slate-900">
            Track the cost and time of building software.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Connect GitHub, lock in hours, and see Project Cost (hours × hourly
            rate) next to commits and lines of code — plus the value you set
            for the project.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
          <p className="font-display text-base font-semibold text-slate-900">
            LockedIn web
          </p>
          <p className="font-mono text-xs text-slate-400">acme/lockedin</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-400">Commits</p>
              <CountUp
                value={47}
                className="mt-1 block font-mono text-sm tabular-nums text-slate-800"
              />
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-400">+LOC</p>
              <CountUp
                value={1284}
                format={(n) =>
                  Math.round(n).toLocaleString("en-US")
                }
                className="mt-1 block font-mono text-sm tabular-nums text-emerald-700"
              />
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-400">−LOC</p>
              <CountUp
                value={312}
                className="mt-1 block font-mono text-sm tabular-nums text-rose-600"
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Hours locked in:{" "}
            <span className="font-mono tabular-nums">
              {formatMs(DEMO_HOURS_MS, true)}
            </span>
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Project Cost
              </p>
              <CountUp
                value={DEMO_COST}
                format={(n) => money(Math.round(n))}
                className="mt-1 block font-display text-xl font-bold text-slate-900"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                hours × hourly rate
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Project Value
              </p>
              <CountUp
                value={DEMO_VALUE}
                format={(n) => money(Math.round(n))}
                className="mt-1 block font-display text-xl font-bold text-slate-900"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                manual worth / revenue
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
