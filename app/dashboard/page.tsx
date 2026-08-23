"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SessionHistoryPanel } from "@/components/dashboard/SessionHistoryPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { formatMs, formatTotalHours } from "@/features/session/format";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import type { HeatmapDay } from "@/types/database";

type DashboardStats = {
  today_ms?: number;
  streak_days?: number;
  pr_ms?: number;
  total_sessions?: number;
  group_sessions?: number;
  total_active_ms?: number;
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const { status, isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;
  const [gateOpen, setGateOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [timeZone, setTimeZone] = useState("UTC");
  const [username, setUsername] = useState<string | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);

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

  const primaryStats = [
    {
      label: t("dash.today"),
      value: stats?.today_ms ?? 0,
      format: (n: number) => formatMs(Math.round(n), true),
    },
    {
      label: t("dash.streak"),
      value: stats?.streak_days ?? 0,
      format: (n: number) => `${Math.round(n)}d`,
    },
    {
      label: t("dash.pr"),
      value: stats?.pr_ms ?? 0,
      format: (n: number) => formatMs(Math.round(n), true),
    },
  ];

  const lifetimeStats = [
    {
      label: t("dash.sessions"),
      value: stats?.total_sessions ?? 0,
      format: (n: number) => String(Math.round(n)),
    },
    {
      label: t("dash.groupSessions"),
      value: stats?.group_sessions ?? 0,
      format: (n: number) => String(Math.round(n)),
    },
    {
      label: t("dash.totalHours"),
      value: stats?.total_active_ms ?? 0,
      format: (n: number) => formatTotalHours(Math.round(n)),
    },
  ];

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {t("dash.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("dash.subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {primaryStats.map((s) => (
            <Card key={s.label} className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isAuthenticated ? (
                  <CountUp
                    value={s.value}
                    format={s.format}
                    className="text-2xl font-semibold text-slate-900"
                  />
                ) : (
                  <p className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                    —
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {lifetimeStats.map((s) => (
            <Card key={s.label} className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isAuthenticated ? (
                  <CountUp
                    value={s.value}
                    format={s.format}
                    className="text-2xl font-semibold text-slate-900"
                  />
                ) : (
                  <p className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                    —
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {isAuthenticated ? (
          <SessionHistoryPanel
            username={username}
            timezone={timeZone}
            heatmapDays={heatmapDays}
            canShare
            emptyHint
            unavailable={unavailable}
          />
        ) : (
          <Card className="border-slate-200 bg-white">
            <CardContent className="py-8 text-center text-sm text-slate-400">
              Sign in to see your session history.
            </CardContent>
          </Card>
        )}
      </div>

      <AuthGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        reason="save_sync"
        onContinueAsGuest={() => setGateOpen(false)}
      />
    </ChromePage>
  );
}
