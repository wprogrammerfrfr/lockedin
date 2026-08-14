"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShareCardDialog } from "@/components/session/ShareCardDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatMs, lockedInForLabel } from "@/features/session/format";
import { profileSessionsForDay } from "@/features/social/api";
import type { ProfileDaySession } from "@/features/social/types";
import type { OutcomeKind } from "@/features/session/types";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

function sessionSummary(s: ProfileDaySession): string {
  if (s.pr_broken || s.outcome === "pr") return "PR";
  if (s.outcome === "tapout" || s.status === "tapped_out") return "Tapped out";
  if (s.outcome === "break") return "Break";
  if (s.outcome === "solid") return "Solid";
  if (s.status === "active" || s.status === "on_break") return "Live";
  return "Ended";
}

function asOutcome(s: ProfileDaySession): OutcomeKind {
  if (s.pr_broken || s.outcome === "pr") return "pr";
  if (s.outcome === "tapout" || s.status === "tapped_out") return "tapout";
  if (s.outcome === "break") return "break";
  if (s.outcome === "solid") return "solid";
  return "solid";
}

export function DaySessionsDialog({
  open,
  onOpenChange,
  username,
  day,
  timezone,
  canShare = false,
  locked = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  day: string | null;
  timezone: string;
  canShare?: boolean;
  /** Viewer cannot see sessions (not following). */
  locked?: boolean;
}) {
  const { isAuthenticated, profileLabel, avatarUrl } = useAuth();
  const [sessions, setSessions] = useState<ProfileDaySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareSession, setShareSession] = useState<ProfileDaySession | null>(
    null,
  );

  useEffect(() => {
    if (!open || !day || !username || locked) {
      setSessions([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const rows = await profileSessionsForDay(
          createClient(),
          username,
          day,
          timezone,
        );
        if (!cancelled) setSessions(rows);
      } catch (err) {
        if (!cancelled) {
          setSessions([]);
          setError(userFacingError(err, "Could not load sessions"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, day, username, timezone, locked]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle className="font-mono tabular-nums">
              {day ?? "Sessions"}
            </DialogTitle>
            <DialogDescription>
              {locked
                ? "Follow this student to see their session details."
                : "Sessions started on this day."}
            </DialogDescription>
          </DialogHeader>

          {locked ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-500">
                Session lists unlock after you follow them (accepted).
              </p>
              <Button asChild className="rounded-xl">
                <Link href={`/u/${username}`}>View profile</Link>
              </Button>
            </div>
          ) : loading ? (
            <p className="py-4 text-sm text-slate-400">Loading sessions…</p>
          ) : error ? (
            <p className="py-4 text-sm text-slate-500">{error}</p>
          ) : sessions.length === 0 ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-400">No sessions this day.</p>
              {canShare ? (
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/lockin">LOCK IN</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {s.session_name?.trim() || "Untitled"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                        {lockedInForLabel(s.active_ms ?? 0)}
                        {(s.break_ms ?? 0) > 0
                          ? ` · break ${formatMs(s.break_ms ?? 0)}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {sessionSummary(s)}
                      </p>
                    </div>
                    {canShare &&
                    s.status !== "active" &&
                    s.status !== "on_break" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 rounded-xl"
                        onClick={() => setShareSession(s)}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ShareCardDialog
        open={Boolean(shareSession)}
        onOpenChange={(next) => {
          if (!next) setShareSession(null);
        }}
        durationMs={shareSession?.active_ms ?? 0}
        outcome={shareSession ? asOutcome(shareSession) : "solid"}
        sessionId={shareSession?.id ?? null}
        canPost={isAuthenticated && Boolean(shareSession?.id)}
        sessionName={shareSession?.session_name ?? null}
        displayName={profileLabel}
        avatarUrl={avatarUrl}
      />
    </>
  );
}
