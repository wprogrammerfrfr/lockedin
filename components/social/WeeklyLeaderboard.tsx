"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMs } from "@/features/session/format";
import { weeklyLeaderboard } from "@/features/social/api";
import type { LeaderboardEntry } from "@/features/social/types";
import { publicAvatarUrl } from "@/features/profile/api";
import { createClient } from "@/lib/supabase/client";

export function WeeklyLeaderboard({
  timezone = "UTC",
  compact = false,
}: {
  timezone?: string;
  compact?: boolean;
}) {
  const { status, isAuthenticated } = useAuth();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        if (!isAuthenticated) {
          if (!cancelled) {
            setNeedsAuth(true);
            setRows([]);
            setError(false);
          }
          return;
        }
        if (!cancelled) setNeedsAuth(false);
        const board = await weeklyLeaderboard(supabase, timezone);
        if (!cancelled) {
          setRows(board);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setRows([]);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [timezone, status, isAuthenticated]);

  const alone = !needsAuth && !error && rows.length <= 1;

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-slate-200 bg-white p-3"
          : "rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4"
      }
    >
      <p className="font-display text-sm font-semibold text-slate-800">
        This week&apos;s top lock ins
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Mutual friends · active hours this week (your timezone).
      </p>

      {needsAuth && (
        <p className="mt-3 text-xs text-slate-400">
          Please log in to use this feature
        </p>
      )}

      {!needsAuth && error && (
        <p className="mt-3 text-xs text-slate-400">
          Ranks will appear once the leaderboard is available.
        </p>
      )}

      {!needsAuth && !error && rows.length === 0 && (
        <p className="mt-3 text-xs text-slate-400">
          No activity yet.{" "}
          <Link href="/lockin" className="font-medium text-slate-700 underline">
            LOCK IN
          </Link>{" "}
          to start the week.
        </p>
      )}

      {alone && rows.length === 1 ? (
        <p className="mt-3 text-xs text-slate-500">
          Just you for now. Accept follow-backs to climb with friends —{" "}
          <Link href="/explore" className="font-medium text-slate-800 underline">
            find students on Explore
          </Link>
          .
        </p>
      ) : null}

      {!needsAuth && rows.length > 0 && (
        <ol className="mt-3 space-y-2">
          {rows.slice(0, compact ? 5 : 10).map((r) => {
            const url = publicAvatarUrl(r.avatar_path);
            return (
              <li key={r.user_id}>
                <Link
                  href={`/u/${r.username}`}
                  className="flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="w-5 font-mono text-xs tabular-nums text-amber-600">
                    {r.rank}
                  </span>
                  <Avatar className="h-7 w-7 rounded-lg">
                    {url ? <AvatarImage src={url} alt="" /> : null}
                    <AvatarFallback className="rounded-lg bg-slate-100 text-[10px]">
                      {r.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {r.username}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-500">
                    {formatMs(r.active_ms, true)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
