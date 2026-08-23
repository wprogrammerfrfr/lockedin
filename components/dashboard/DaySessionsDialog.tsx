"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
import {
  SessionReceiptCard,
  sessionToReceiptData,
} from "@/components/session/SessionReceiptCard";
import { SessionSummaryCard } from "@/components/session/SessionSummaryCard";
import {
  SessionCardViewToggle,
  useSessionCardView,
} from "@/components/session/SessionCardViewToggle";
import { springSoft } from "@/components/session/state-accent";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  buildShareCaption,
  formatMs,
  youLockedInForLabel,
} from "@/features/session/format";
import type { ProfileDaySession } from "@/features/social/types";
import type { OutcomeKind } from "@/features/session/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

export function asSessionOutcome(s: ProfileDaySession): OutcomeKind {
  if (s.pr_broken || s.outcome === "pr") return "pr";
  if (s.outcome === "tapout" || s.status === "tapped_out") return "tapout";
  if (s.outcome === "break") return "break";
  if (s.outcome === "solid") return "solid";
  return "solid";
}

function formatClock(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

function formatListDate(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(d);
}

export function SessionListRow({
  session,
  timeZone,
  onClick,
  showDate = false,
}: {
  session: ProfileDaySession;
  timeZone: string;
  onClick: () => void;
  showDate?: boolean;
}) {
  const { t } = useTranslation();
  const isRoom =
    session.kind === "room" || Boolean(session.room_session_id);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left transition-colors",
        "hover:border-slate-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">
            {session.session_name?.trim() ||
              session.room_name?.trim() ||
              t("dash.untitled")}
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {isRoom ? t("receipt.room") : t("receipt.solo")}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {youLockedInForLabel(session.active_ms ?? 0)}
            {(session.break_ms ?? 0) > 0
              ? ` · break ${formatMs(session.break_ms ?? 0)}`
              : ""}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-400">
            {showDate ? (
              <>
                {formatListDate(session.started_at, timeZone)}
                {" · "}
              </>
            ) : null}
            {formatClock(session.started_at, timeZone)}
            {" – "}
            {formatClock(session.ended_at, timeZone)}
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">
          {formatMs(session.active_ms ?? 0, true)}
        </span>
      </div>
    </button>
  );
}

/** Receipt detail + optional share actions for a history session. */
export function SessionDetailDialog({
  open,
  onOpenChange,
  session,
  timeZone,
  canShare = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ProfileDaySession | null;
  timeZone: string;
  canShare?: boolean;
}) {
  const { t } = useTranslation();
  const { isAuthenticated, profileLabel, avatarUrl, user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [cardView, setCardView] = useSessionCardView("summary");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!open) setShareOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !session) return;
    setCaption(
      buildShareCaption(session.active_ms ?? 0, asSessionOutcome(session)),
    );
  }, [open, session]);

  const receipt = session
    ? sessionToReceiptData(session, {
        viewerUserId: user?.id,
        flavorCaption: caption,
      })
    : null;
  const canPostShare =
    canShare &&
    session &&
    session.status !== "active" &&
    session.status !== "on_break";
  const outcome = session ? asSessionOutcome(session) : "solid";
  const sessionTitle =
    session?.session_name?.trim() ||
    session?.room_name?.trim() ||
    null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(90dvh,52rem)] max-w-md flex-col gap-3 overflow-hidden border-slate-200 bg-white">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {cardView === "summary"
                ? t("dash.sessionSummary")
                : t("dash.sessionReceipt")}
            </DialogTitle>
          </DialogHeader>

          {session && receipt ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <SessionCardViewToggle
                value={cardView}
                onChange={setCardView}
                className="shrink-0"
              />
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
                <AnimatePresence mode="wait" initial={false}>
                  {cardView === "summary" ? (
                    <motion.div
                      key="summary"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={springSoft}
                    >
                      <SessionSummaryCard
                        durationMs={session.active_ms ?? 0}
                        outcome={outcome}
                        sessionName={sessionTitle}
                        caption={caption}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="receipt"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={springSoft}
                    >
                      <SessionReceiptCard data={receipt} timeZone={timeZone} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {canPostShare ? (
                <Button
                  className="w-full shrink-0 rounded-xl"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 className="h-4 w-4" />
                  {t("dash.shareExport")}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="py-4 text-sm text-slate-400">
              {t("dash.noSessionSelected")}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <ShareCardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        durationMs={session?.active_ms ?? 0}
        outcome={session ? asSessionOutcome(session) : "solid"}
        displayName={profileLabel}
        avatarUrl={avatarUrl}
        sessionId={session?.id}
        sessionName={session?.session_name ?? session?.room_name}
        canPost={isAuthenticated && Boolean(session?.id)}
        timeZone={timeZone}
        receipt={receipt}
      />
    </>
  );
}

export function DaySessionsDialog({
  open,
  onOpenChange,
  username,
  day,
  timezone,
  canShare = false,
  locked = false,
  sessions,
  loading = false,
  error = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  day: string | null;
  timezone: string;
  canShare?: boolean;
  /** Viewer cannot see sessions (not following). */
  locked?: boolean;
  sessions: ProfileDaySession[];
  loading?: boolean;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<ProfileDaySession | null>(null);
  const tz = timezone || "UTC";

  useEffect(() => {
    if (!open) setDetail(null);
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle className="font-mono tabular-nums">
              {day ?? t("dash.daySessions")}
            </DialogTitle>
            <DialogDescription>
              {locked
                ? t("dash.followForDetails")
                : t("dash.clickForDetails")}
            </DialogDescription>
          </DialogHeader>

          {locked ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-500">
                {t("dash.followUnlockList")}
              </p>
              <Button asChild className="rounded-xl">
                <Link href={`/u/${username}`}>{t("dash.viewProfile")}</Link>
              </Button>
            </div>
          ) : loading ? (
            <p className="py-4 text-sm text-slate-400">{t("dash.loadingSessions")}</p>
          ) : error ? (
            <p className="py-4 text-sm text-slate-500">{error}</p>
          ) : sessions.length === 0 ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-400">{t("dash.noSessionsDay")}</p>
              {canShare ? (
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/lockin">{t("nav.lockin")}</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {sessions.map((s) => (
                <li key={s.id}>
                  <SessionListRow
                    session={s}
                    timeZone={tz}
                    onClick={() => setDetail(s)}
                  />
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <SessionDetailDialog
        open={Boolean(detail)}
        onOpenChange={(next) => {
          if (!next) setDetail(null);
        }}
        session={detail}
        timeZone={tz}
        canShare={canShare}
      />
    </>
  );
}
