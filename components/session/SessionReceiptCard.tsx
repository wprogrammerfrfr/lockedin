"use client";

import { forwardRef } from "react";
import { LockedInLogo } from "@/components/brand/LockedInLogo";
import type { BreakSegment } from "@/features/session/break-types";
import {
  breakDurationLabel,
  breakHistoryFromLegacy,
  breakReceiptLabel,
  formatHoursMinutesWords,
  formatMs,
  formatReceiptDurationValue,
  receiptOutcomeLabel,
  shareCardChrome,
  type TranslateFn,
} from "@/features/session/format";
import type { OutcomeKind } from "@/features/session/types";
import type {
  ProfileDaySession,
  ProfileDaySessionParticipant,
} from "@/features/social/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

export type ReceiptParticipant = {
  user_id?: string;
  username?: string | null;
  active_ms?: number;
  break_ms?: number;
  break_types_used?: unknown;
  break_history?: unknown;
  outcome?: string | null;
  isYou?: boolean;
};

export type SessionReceiptData = {
  sessionName?: string | null;
  kind?: "solo" | "room" | string;
  roomCode?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  activeMs?: number;
  breakMs?: number;
  breakTypesUsed?: unknown;
  breakHistory?: BreakSegment[];
  outcome?: OutcomeKind | string | null;
  prBroken?: boolean;
  participants?: ReceiptParticipant[];
  flavorCaption?: string | null;
};

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

function formatDate(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(d);
}

function parseBreakHistory(raw: unknown): BreakSegment[] {
  if (!Array.isArray(raw)) return [];
  const out: BreakSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const typeId = String(row.typeId ?? "").trim();
    const durationMs = Number(row.durationMs) || 0;
    if (!typeId || durationMs <= 0) continue;
    out.push({
      typeId: typeId as BreakSegment["typeId"],
      durationMs,
      openEnded: Boolean(row.openEnded),
    });
  }
  return out;
}

function resolveBreakLines(
  breakHistory: BreakSegment[] | undefined,
  breakTypesUsed: unknown,
  breakMs: number,
  t: (key: string) => string,
): { label: string; value: string }[] {
  const history =
    breakHistory && breakHistory.length > 0
      ? breakHistory
      : breakHistoryFromLegacy(breakTypesUsed, breakMs);

  if (history.length === 0) return [];

  return history.map((seg) => ({
    label: breakReceiptLabel(seg.typeId, t),
    value: formatMs(seg.durationMs, true),
  }));
}

function participantDisplayName(
  p: ReceiptParticipant,
  t: (key: string) => string,
): string {
  return p.isYou
    ? `${t("receipt.you")}${p.username ? ` (@${p.username})` : ""}`
    : `@${p.username?.trim() || t("receipt.member")}`;
}

function LineRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px] sm:text-xs">
      <span className="shrink-0 text-slate-600">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right font-medium text-slate-900",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function DashedRule({ className }: { className?: string }) {
  return (
    <div
      className={cn("border-t border-dashed border-slate-900/20", className)}
    />
  );
}

function ParticipantBlock({
  p,
  compact,
  t,
}: {
  p: ReceiptParticipant;
  compact?: boolean;
  t: TranslateFn;
}) {
  const name = participantDisplayName(p, t);
  const breakLines = resolveBreakLines(
    parseBreakHistory(p.break_history),
    p.break_types_used,
    p.break_ms ?? 0,
    t,
  );

  return (
    <div className={cn("space-y-1", compact && "space-y-0.5")}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-800 sm:text-xs">
        {name}
      </p>
      <LineRow
        label={t("receipt.lockedInFor")}
        value={formatReceiptDurationValue(
          p.active_ms ?? 0,
          formatMs(p.active_ms ?? 0, true),
          t,
        )}
      />
      {breakLines.length > 0 ? (
        breakLines.map((line, i) => (
          <LineRow key={`${line.label}-${i}`} label={line.label} value={line.value} />
        ))
      ) : (
        <LineRow
          label={breakDurationLabel(p.break_types_used, t)}
          value={formatMs(p.break_ms ?? 0, true)}
        />
      )}
    </div>
  );
}

function LockInLeaderboard({
  participants,
  compact,
  t,
}: {
  participants: ReceiptParticipant[];
  compact?: boolean;
  t: (key: string) => string;
}) {
  if (participants.length < 2) return null;

  const ranked = [...participants].sort((a, b) => {
    const diff = (b.active_ms ?? 0) - (a.active_ms ?? 0);
    if (diff !== 0) return diff;
    const an = (a.username ?? "").toLowerCase();
    const bn = (b.username ?? "").toLowerCase();
    return an.localeCompare(bn);
  });

  return (
    <div className={cn("space-y-1", compact && "space-y-0.5")}>
      <p
        className={cn(
          "font-semibold uppercase tracking-wide text-slate-700",
          compact ? "text-[10px]" : "text-[11px] sm:text-xs",
        )}
      >
        {t("receipt.leaderboard")}
      </p>
      {ranked.map((p, i) => {
        const rank = i + 1;
        return (
          <div
            key={p.user_id ?? `${p.username}-${i}`}
            className="flex items-baseline justify-between gap-3 text-[11px] sm:text-xs"
          >
            <span
              className={cn(
                "min-w-0 truncate font-medium",
                rank === 1 ? "text-amber-700" : "text-slate-800",
              )}
            >
              <span className="font-mono tabular-nums">{rank}.</span>{" "}
              {participantDisplayName(p, t)}
            </span>
            <span
              className={cn(
                "shrink-0 font-mono tabular-nums font-medium",
                rank === 1 ? "text-amber-700" : "text-slate-900",
              )}
            >
              {formatMs(p.active_ms ?? 0, true)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function sessionToReceiptData(
  s: ProfileDaySession,
  opts?: { viewerUserId?: string | null; flavorCaption?: string | null },
): SessionReceiptData {
  const isRoom = s.kind === "room" || Boolean(s.room_session_id);
  const participants = (s.participants ?? []).map(
    (p: ProfileDaySessionParticipant): ReceiptParticipant => ({
      ...p,
      isYou: Boolean(opts?.viewerUserId && p.user_id === opts.viewerUserId),
    }),
  );
  return {
    sessionName: s.session_name ?? s.room_name,
    kind: isRoom ? "room" : "solo",
    roomCode: s.room_code,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    activeMs: s.active_ms,
    breakMs: s.break_ms,
    breakTypesUsed: s.break_types_used,
    breakHistory: parseBreakHistory(s.break_history),
    outcome: s.outcome,
    prBroken: s.pr_broken,
    participants: isRoom ? participants : undefined,
    flavorCaption: opts?.flavorCaption,
  };
}

export const SessionReceiptCard = forwardRef<
  HTMLDivElement,
  {
    data: SessionReceiptData;
    timeZone?: string;
    className?: string;
    variant?: "card" | "story";
  }
>(function SessionReceiptCard(
  { data, timeZone = "UTC", className, variant = "card" },
  ref,
) {
  const { t } = useTranslation();
  const durationMs = data.activeMs ?? 0;
  const outcome = (data.prBroken
    ? "pr"
    : data.outcome === "tapout" || data.outcome === "tapped_out"
      ? "tapout"
      : data.outcome === "pr"
        ? "pr"
        : "solid") as OutcomeKind;
  const chrome = shareCardChrome(durationMs, outcome, t);
  const footer = receiptOutcomeLabel(data.outcome, data.prBroken);
  const isRoom = data.kind === "room";
  const title =
    (data.sessionName ?? "").trim() ||
    (isRoom ? t("receipt.roomSession") : t("receipt.soloSession"));
  const story = variant === "story";
  const participants = data.participants ?? [];
  const soloBreakLines = resolveBreakLines(
    data.breakHistory,
    data.breakTypesUsed,
    data.breakMs ?? 0,
    t,
  );
  const lockedInValue = formatReceiptDurationValue(
    durationMs,
    formatMs(durationMs, true),
    t,
  );
  const totalLockInValue = formatReceiptDurationValue(
    durationMs,
    formatHoursMinutesWords(durationMs, t),
    t,
  );

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden border border-slate-200 bg-gradient-to-br text-slate-900",
        chrome.gradient,
        story
          ? "flex h-[1920px] w-[1080px] flex-col justify-between rounded-none p-16"
          : "rounded-2xl p-5 shadow-soft sm:p-6",
        className,
      )}
      style={story ? { width: 1080, height: 1920 } : undefined}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <LockedInLogo
            className={cn("tracking-tight", story ? "text-4xl" : "text-sm")}
          />
          <span
            className={cn(
              "shrink-0 rounded-md border border-slate-900/15 bg-white/50 font-mono uppercase tracking-wider text-slate-700",
              story ? "px-4 py-2 text-2xl" : "px-2 py-0.5 text-[10px]",
            )}
          >
            {isRoom ? t("receipt.room") : t("receipt.solo")}
          </span>
        </div>

        <p
          className={cn(
            "mt-3 font-display font-bold tracking-tight text-slate-900",
            story ? "text-5xl" : "text-lg sm:text-xl",
          )}
        >
          {title}
        </p>
        {isRoom && data.roomCode ? (
          <p
            className={cn(
              "mt-1 font-mono tabular-nums text-slate-600",
              story ? "text-2xl" : "text-xs",
            )}
          >
            {t("receipt.code", { code: data.roomCode })}
          </p>
        ) : null}

        {data.flavorCaption ? (
          <p
            className={cn(
              "mt-2 text-slate-700/80",
              story ? "text-2xl" : "text-xs italic",
            )}
          >
            {data.flavorCaption}
          </p>
        ) : null}

        <DashedRule className={story ? "my-8" : "my-3"} />

        <div className={cn("space-y-1.5", story && "space-y-3 text-2xl")}>
          <LineRow
            label={t("receipt.date")}
            value={formatDate(data.startedAt, timeZone)}
            mono={false}
          />
          <LineRow
            label={t("receipt.start")}
            value={formatClock(data.startedAt, timeZone)}
          />
          <LineRow label={t("receipt.end")} value={formatClock(data.endedAt, timeZone)} />
        </div>

        <DashedRule className={story ? "my-8" : "my-3"} />

        {isRoom && participants.length > 0 ? (
          <div className={cn("space-y-3", story && "space-y-6")}>
            {participants.map((p, i) => (
              <div key={p.user_id ?? `${p.username}-${i}`}>
                {i > 0 ? (
                  <DashedRule className={story ? "mb-6" : "mb-3"} />
                ) : null}
                <ParticipantBlock p={p} compact={!story} t={t} />
              </div>
            ))}
            {participants.length >= 2 ? (
              <>
                <DashedRule className={story ? "my-6" : "my-3"} />
                <LockInLeaderboard
                  participants={participants}
                  compact={!story}
                  t={t}
                />
              </>
            ) : null}
          </div>
        ) : (
          <div className={cn("space-y-1.5", story && "space-y-3")}>
            <LineRow
              label={t("receipt.lockedInFor")}
              value={lockedInValue}
            />
            {soloBreakLines.length > 0 ? (
              soloBreakLines.map((line, i) => (
                <LineRow key={`${line.label}-${i}`} label={line.label} value={line.value} />
              ))
            ) : (
              <LineRow
                label={breakDurationLabel(data.breakTypesUsed, t)}
                value={formatMs(data.breakMs ?? 0, true)}
              />
            )}
          </div>
        )}
      </div>

      <div>
        <DashedRule className={story ? "my-8" : "my-3"} />
        <div
          className={cn(
            "flex items-end justify-between gap-3",
            story && "text-3xl",
          )}
        >
          <div>
            <p
              className={cn(
                "uppercase tracking-[0.14em] text-slate-600",
                story ? "text-xl" : "text-[10px]",
              )}
            >
              {t("receipt.totalLockIn")}
            </p>
            <p
              className={cn(
                "font-semibold text-slate-900",
                story ? "mt-2 text-5xl" : "mt-0.5 text-lg",
              )}
            >
              {totalLockInValue}
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 font-semibold uppercase tracking-wider text-slate-800",
              story ? "text-3xl" : "text-xs",
            )}
          >
            {footer === "Finish"
              ? t("outcome.finish")
              : footer === "NEW PR"
                ? t("outcome.newPr")
                : footer === "BREAK"
                  ? t("outcome.break")
                  : t("outcome.lockedIn")}
          </p>
        </div>
      </div>
    </div>
  );
});
