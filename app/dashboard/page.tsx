"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMs, lockedInForLabel } from "@/features/session/format";
import { createClient } from "@/lib/supabase/client";

type DashboardStats = {
  today_ms?: number;
  streak_days?: number;
  pr_ms?: number;
  recent?: Array<{
    id?: string;
    session_name?: string | null;
    active_ms?: number;
    break_ms?: number;
    break_types_used?: string[];
    status?: string;
    started_at?: string;
  }>;
};

export default function DashboardPage() {
  const { status, isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;
  const [gateOpen, setGateOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated || !userId) {
      setGateOpen(true);
      setStats(null);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    async function load() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("timezone")
          .eq("id", userId)
          .maybeSingle();
        const tz =
          profile?.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "UTC";

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "dashboard_stats",
          { p_tz: tz },
        );

        if (cancelled) return;
        if (rpcError) {
          setUnavailable(true);
          setStats(null);
          return;
        }
        setUnavailable(false);
        setStats((rpcData ?? {}) as DashboardStats);
      } catch {
        if (cancelled) return;
        setUnavailable(true);
        setStats(null);
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
            Session history, today totals, streaks, and PRs.
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
            <CardTitle className="text-base">Recent sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {unavailable && (
              <p className="text-slate-400">
                Stats will appear once your sessions sync.
              </p>
            )}
            {!unavailable && (!stats?.recent || stats.recent.length === 0) && (
              <p className="text-slate-400">No sessions yet.</p>
            )}
            {(stats?.recent ?? []).map((s, i) => (
              <div
                key={s.id ?? i}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {s.session_name || "Untitled"}
                  </p>
                  <p className="text-xs text-slate-400">{s.status}</p>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-600">
                  {lockedInForLabel(s.active_ms ?? 0)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
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
