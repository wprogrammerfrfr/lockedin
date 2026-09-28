"use client";

import { Code2 } from "lucide-react";
import { LockedInLogo } from "@/components/brand/LockedInLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { formatMs } from "@/features/session/format";

const DEMO_HOURS_MS = 4 * 60 * 60 * 1000 + 12 * 60 * 1000;
const DEMO_DAYS = 73;
const DEMO_MONTHS = 3;
const DEMO_MONTHLY = 20;

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function WelcomeDevShowcase() {
  return (
    <Card className="border-border">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Code2 className="h-5 w-5 text-emerald-600" />
          Developer Mode
        </CardTitle>
        <div>
          <p className="font-display text-lg font-bold tracking-tight text-foreground">
            Track the cost and time of building software.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Connect GitHub to see every commit on a calendar, how long
            you&apos;ve been building since the first one, and the cost to
            build (your monthly spend × months building).
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <p className="font-display text-base font-semibold text-foreground">
            <LockedInLogo className="text-base" /> web
          </p>
          <p className="font-mono text-xs text-muted-foreground">acme/lockedin</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Commits</p>
              <CountUp
                value={47}
                className="mt-1 block font-mono text-sm tabular-nums text-foreground"
              />
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">+LOC</p>
              <CountUp
                value={1284}
                format={(n) =>
                  Math.round(n).toLocaleString("en-US")
                }
                className="mt-1 block font-mono text-sm tabular-nums text-emerald-700"
              />
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">−LOC</p>
              <CountUp
                value={312}
                className="mt-1 block font-mono text-sm tabular-nums text-rose-600"
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Hours locked in:{" "}
            <span className="font-mono tabular-nums">
              {formatMs(DEMO_HOURS_MS, true)}
            </span>
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Building since
              </p>
              <CountUp
                value={DEMO_DAYS}
                format={(n) => `${Math.round(n)} days`}
                className="mt-1 block font-display text-xl font-bold text-foreground"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                from the first commit
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cost to build
              </p>
              <CountUp
                value={DEMO_MONTHS * DEMO_MONTHLY}
                format={(n) => money(Math.round(n))}
                className="mt-1 block font-display text-xl font-bold text-amber-300"
              />
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                {DEMO_MONTHS} mo × {money(DEMO_MONTHLY)}/mo
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
