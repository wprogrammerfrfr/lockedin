"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, BarChart3, Flame, Share2, Trophy } from "lucide-react";
import { WelcomeDevShowcase } from "@/components/welcome/WelcomeDevShowcase";
import { WelcomeRoomsShowcase } from "@/components/welcome/WelcomeRoomsShowcase";
import { springSoft } from "@/components/session/state-accent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Separator } from "@/components/ui/separator";
import {
  formatCentiseconds,
  lockedInForLabel,
  shareCardChrome,
} from "@/features/session/format";
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
  const chrome = shareCardChrome(durationMs, shareWin ? "pr" : "tapout");

  return (
    <div className="flex flex-col gap-6">
      <WelcomeRoomsShowcase />
      <WelcomeDevShowcase />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Dashboard &amp; streaks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-relaxed text-slate-600">
              Today totals, personal records, and streaks live on the dashboard.
              PRs glow gold. Numbers count up — they don’t snap.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  Today
                </p>
                <CountUp
                  value={72}
                  format={(n) => formatHoursMinutes(Math.round(n) * 60_000)}
                  className="mt-1 block text-sm font-semibold text-slate-900"
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
              Share card
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">
              Screenshot-ready cards show “Locked in for HH:MM:SS” plus the
              outcome emoji. Win state if you broke a PR. L state if you tapped
              out early.
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
                Took the L 😭
              </Button>
            </div>
            <motion.div
              key={shareWin ? "win" : "l"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSoft}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br p-5 shadow-soft",
                chrome.gradient,
              )}
            >
              <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-slate-700/80">
                LockedIn
              </p>
              <p className="mt-3 text-4xl leading-none">{chrome.emoji}</p>
              <p className="mt-3 font-display text-xl font-bold tracking-tight text-slate-900">
                {chrome.headline}
              </p>
              <Separator className="my-3 bg-white/50" />
              <div className="flex justify-between gap-3 text-xs text-slate-600">
                <span className="font-mono tabular-nums">
                  {lockedInForLabel(durationMs)}
                  <span className="ml-0.5 text-[0.65em] opacity-70">
                    :{formatCentiseconds(durationMs)}
                  </span>
                </span>
                <span className="shrink-0">{chrome.footerLabel}</span>
              </div>
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
            <p className="text-sm leading-relaxed text-slate-600">
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
    </div>
  );
}
