"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { DaySessionsDialog } from "@/components/dashboard/DaySessionsDialog";
import { ContributionHeatmap } from "@/components/profile/ContributionHeatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMs } from "@/features/session/format";
import { createClient } from "@/lib/supabase/client";
import type { HeatmapDay } from "@/types/database";

type DashboardStats = {
  today_ms?: number;
  streak_days?: number;
  pr_ms?: number;
};

export default function DashboardPage() {
  const { status, isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;
  const [gateOpen, setGateOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [timeZone, setTimeZone] = useState("UTC");
  const [username, setUsername] = useState<string | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated || !userId) {
      setGateOpen(true);
      setStats(null);
      setHeatmapDays([]);
      setUsername(null);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    async function load() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("timezone, username")
          .eq("id", userId)
          .maybeSingle();
        const tz =
          profile?.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "UTC";
        const uname = profile?.username?.trim() || null;

        if (!cancelled) {
          setTimeZone(tz);
          setUsername(uname);
        }

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "dashboard_stats",
          { p_tz: tz },
        );

        if (cancelled) return;
        if (rpcError) {
          setUnavailable(true);
          setStats(null);
        } else {
          setUnavailable(false);
          setStats((rpcData ?? {}) as DashboardStats);
        }

        if (uname) {
          const { data: heat, error: heatErr } = await supabase.rpc(
            "profile_activity_heatmap",
            { p_username: uname, p_tz: tz },
          );
          if (!cancelled) {
            setHeatmapDays(
              heatErr ? [] : ((heat ?? []) as HeatmapDay[]),
            );
          }
        } else if (!cancelled) {
          setHeatmapDays([]);
        }
      } catch {
        if (cancelled) return;
        setUnavailable(true);
        setStats(null);
        setHeatmapDays([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [status, isAuthenticated, userId]);

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Today totals, streaks, PRs, and your focus heatmap.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Today",
              value: formatMs(stats?.today_ms ?? 0, true),
            },
            {
              label: "Streak",
              value: `${stats?.streak_days ?? 0}d`,
            },
            {
              label: "PR",
              value: formatMs(stats?.pr_ms ?? 0, true),
            },
          ].map((s) => (
            <Card key={s.label} className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                  {isAuthenticated ? s.value : "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Focus calendar</CardTitle>
            <p className="text-xs text-slate-500">
              Click a date to review sessions and share to Explore.
            </p>
          </CardHeader>
          <CardContent>
            {unavailable && (
              <p className="mb-3 text-sm text-slate-400">
                Stats will appear once your sessions sync.
              </p>
            )}
            {!isAuthenticated ? (
              <p className="text-sm text-slate-400">Sign in to see your grid.</p>
            ) : !username ? (
              <p className="text-sm text-slate-400">
                Set a username on your profile to unlock the heatmap.
              </p>
            ) : (
              <ContributionHeatmap
                days={heatmapDays}
                emptyHint
                onDayClick={(date) => {
                  setSelectedDay(date);
                  setDayOpen(true);
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {username ? (
        <DaySessionsDialog
          open={dayOpen}
          onOpenChange={setDayOpen}
          username={username}
          day={selectedDay}
          timezone={timeZone}
          canShare
        />
      ) : null}

      <AuthGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        reason="save_sync"
        onContinueAsGuest={() => setGateOpen(false)}
      />
    </ChromePage>
  );
}
