"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMs, lockedInForLabel } from "@/features/session/format";
import { createClient } from "@/lib/supabase/client";

type RecentParticipant = {
  user_id?: string;
  username?: string | null;
  active_ms?: number;
  break_ms?: number;
  break_types_used?: unknown;
  status_at_end?: string | null;
  outcome?: string | null;
};

type RecentItem = {
  id?: string;
  kind?: "solo" | "room" | string;
  session_name?: string | null;
  active_ms?: number;
  break_ms?: number;
  break_types_used?: unknown;
  status?: string;
  started_at?: string;
  participants?: RecentParticipant[];
};

type DashboardStats = {
  today_ms?: number;
  streak_days?: number;
  pr_ms?: number;
  recent?: RecentItem[];
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function breakTypesLabel(value: unknown): string {
  const labels: Record<string, string> = {
    hydration: "Hydration",
    dynamic: "Dynamic",
    smart_alignment: "Smart alignment",
  };
  return asStringList(value)
    .map((t) => labels[t] ?? t.replaceAll("_", " "))
    .join(" · ");
}

function sessionMeta(item: RecentItem): string {
  const parts: string[] = [];
  if (item.status) parts.push(item.status.replaceAll("_", " "));
  if ((item.break_ms ?? 0) > 0) {
    parts.push(`break ${formatMs(item.break_ms ?? 0)}`);
  }
  const types = breakTypesLabel(item.break_types_used);
  if (types) parts.push(types);
  return parts.join(" · ");
}

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
            {(stats?.recent ?? []).map((s, i) => {
              const isRoom = s.kind === "room";
              const people = s.participants ?? [];
              return (
                <div
                  key={s.id ?? i}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {isRoom ? "Room · " : ""}
                        {s.session_name || (isRoom ? "Untitled room" : "Untitled")}
                      </p>
                      <p className="text-xs capitalize text-slate-400">
                        {sessionMeta(s)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-slate-600">
                      {lockedInForLabel(s.active_ms ?? 0)}
                    </span>
                  </div>
                  {isRoom && people.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                      {people.map((p, pi) => {
                        const types = breakTypesLabel(p.break_types_used);
                        return (
                          <li
                            key={p.user_id ?? `${s.id}-p-${pi}`}
                            className="flex items-center justify-between gap-3 text-xs text-slate-600"
                          >
                            <span className="truncate font-medium text-slate-700">
                              {p.username || "member"}
                              {p.status_at_end ? (
                                <span className="ml-1 font-normal capitalize text-slate-400">
                                  · {p.status_at_end.replaceAll("_", " ")}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-mono tabular-nums text-slate-500">
                              {formatMs(p.active_ms ?? 0)}
                              {(p.break_ms ?? 0) > 0
                                ? ` · break ${formatMs(p.break_ms ?? 0)}`
                                : ""}
                              {types ? ` · ${types}` : ""}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
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
