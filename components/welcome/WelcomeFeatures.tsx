"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, BarChart3, Flame, Share2, Trophy } from "lucide-react";
import { SessionReceiptCard } from "@/components/session/SessionReceiptCard";
import { springSoft } from "@/components/session/state-accent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";

const WIN_MS = 1 * 60 * 60 * 1000 + 12 * 60 * 1000;
const L_MS = 23 * 1000;

function formatHoursMinutes(ms: number) {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function WelcomeFeatures() {
  const [shareWin, setShareWin] = useState(true);
  const durationMs = shareWin ? WIN_MS : L_MS;
  const started = new Date();
  started.setHours(9, 0, 0, 0);
  const ended = new Date(started.getTime() + durationMs);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Dashboard &amp; streaks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Today totals, personal records, streaks, and lifetime session
              counts live on the dashboard. Numbers count up — they don’t snap.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-background px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Today
                </p>
                <CountUp
                  value={72}
                  format={(n) => formatHoursMinutes(Math.round(n) * 60_000)}
                  className="mt-1 block text-sm font-semibold text-foreground"
                />
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-amber-600">
                  <Trophy className="h-3 w-3" />
                  PR
                </p>
                <CountUp
                  value={184}
                  format={(n) => formatHoursMinutes(Math.round(n) * 60_000)}
                  className="mt-1 block text-sm font-semibold text-amber-800"
                />
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-amber-600">
                  <Flame className="h-3 w-3" />
                  Streak
                </p>
                <CountUp
                  value={12}
                  className="mt-1 block text-sm font-semibold text-amber-800"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-4 w-4 text-emerald-600" />
              Session receipt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Screenshot-ready receipts show lock-in time, breaks, and outcome.
              Win state if you broke a PR.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={shareWin ? "default" : "outline"}
                className={cn(
                  shareWin &&
                    "bg-lime-400 text-slate-950 hover:bg-lime-300 border border-lime-500/40",
                )}
                onClick={() => setShareWin(true)}
              >
                Win 😎✌️
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!shareWin ? "default" : "outline"}
                className={cn(!shareWin && "bg-slate-700 text-white")}
                onClick={() => setShareWin(false)}
              >
                Tap out
              </Button>
            </div>
            <motion.div
              key={shareWin ? "win" : "l"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSoft}
            >
              <SessionReceiptCard
                data={{
                  sessionName: shareWin ? "Deep work block" : "Almost had it",
                  kind: "solo",
                  startedAt: started.toISOString(),
                  endedAt: ended.toISOString(),
                  activeMs: durationMs,
                  breakMs: shareWin ? 15 * 60_000 : 0,
                  breakTypesUsed: shareWin ? ["hydration"] : [],
                  outcome: shareWin ? "pr" : "tapout",
                  prBroken: shareWin,
                  flavorCaption: shareWin
                    ? "goated."
                    : "great work buddy 😭",
                }}
              />
            </motion.div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Profiles are public by default. Session activity never auto-posts —
              Explore only shows sessions you explicitly share. Badges tell you
              how hours were verified.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-lg bg-emerald-600 text-white">
                GitHub Verified ✓
              </Badge>
              <Badge variant="outline" className="rounded-lg">
                Self-Reported ✍️
              </Badge>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
