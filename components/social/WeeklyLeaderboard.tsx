"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMs } from "@/features/session/format";
import { weeklyLeaderboard } from "@/features/social/api";
import type { LeaderboardEntry } from "@/features/social/types";
import { publicAvatarUrl } from "@/features/profile/api";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

export function WeeklyLeaderboard({
  timezone = "UTC",
  compact = false,
}: {
  timezone?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
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
          ? "rounded-xl border border-border bg-card p-3"
          : "rounded-2xl border border-dashed border-border bg-background p-4"
      }
    >
      <p className="font-display text-sm font-semibold text-foreground">
        {t("leaderboard.title")}
      </p>

      {needsAuth && (
        <p className="mt-3 text-xs text-muted-foreground">{t("auth.loginRequired")}</p>
      )}

      {!needsAuth && error && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("leaderboard.unavailable")}
        </p>
      )}

      {!needsAuth && !error && rows.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("leaderboard.empty")}{" "}
          <Link href="/lockin" className="font-medium text-foreground underline">
            {t("nav.lockin")}
          </Link>{" "}
          {t("leaderboard.emptyCta")}
        </p>
      )}

      {alone && rows.length === 1 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("leaderboard.alone")}{" "}
          <Link href="/explore" className="font-medium text-foreground underline">
            {t("leaderboard.exploreLink")}
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
                  className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5 hover:bg-background"
                >
                  <span className="w-5 font-mono text-xs tabular-nums text-amber-600">
                    {r.rank}
                  </span>
                  <Avatar className="h-7 w-7 rounded-lg">
                    {url ? <AvatarImage src={url} alt="" /> : null}
                    <AvatarFallback className="rounded-lg bg-muted text-[10px]">
                      {r.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {r.username}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
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
