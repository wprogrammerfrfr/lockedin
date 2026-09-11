"use client";

import { useEffect, useState } from "react";
import type { RoomPresenceMember } from "@/features/rooms/types";

/** Local session clock fields used to bypass presence round-trips for self. */
export type SelfLiveClock = {
  userId: string;
  elapsedMs: number;
  status: RoomPresenceMember["status"];
  breakElapsedMs?: number;
  breakRemainingMs?: number;
  breakOpenEnded?: boolean;
};

export type MemberDisplayClock = {
  elapsedMs: number;
  breakElapsedMs: number;
  breakRemainingMs: number;
  breakOpenEnded: boolean;
  /** Value to show under the occupant card / dessert caption. */
  displayMs: number;
};

function clampNonNeg(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/**
 * Derive display clocks for a room member.
 * - Self: always prefer `selfLive` (local session clock).
 * - Remote LOCKED_IN: extrapolate elapsed from `clockSyncedAt`.
 * - Remote BREAK: freeze focus elapsed; tick break clocks from the stamp.
 * - Other statuses: frozen snapshot.
 */
export function memberDisplayClock(
  member: RoomPresenceMember,
  now: number,
  selfLive?: SelfLiveClock | null,
): MemberDisplayClock {
  if (selfLive && member.userId === selfLive.userId) {
    const breakOpenEnded = selfLive.breakOpenEnded ?? false;
    const breakElapsedMs = clampNonNeg(selfLive.breakElapsedMs ?? 0);
    const breakRemainingMs = clampNonNeg(selfLive.breakRemainingMs ?? 0);
    const elapsedMs = clampNonNeg(selfLive.elapsedMs);
    const displayMs =
      selfLive.status === "BREAK"
        ? breakOpenEnded
          ? breakElapsedMs
          : breakRemainingMs
        : elapsedMs;
    return {
      elapsedMs,
      breakElapsedMs,
      breakRemainingMs,
      breakOpenEnded,
      displayMs,
    };
  }

  const syncedAt =
    typeof member.clockSyncedAt === "number" &&
    Number.isFinite(member.clockSyncedAt)
      ? member.clockSyncedAt
      : null;
  const delta =
    syncedAt != null ? Math.max(0, now - syncedAt) : 0;

  const baseElapsed = clampNonNeg(member.elapsedMs);
  const breakOpenEnded = member.breakOpenEnded ?? false;
  const baseBreakElapsed = clampNonNeg(member.breakElapsedMs ?? 0);
  const baseBreakRemaining = clampNonNeg(member.breakRemainingMs ?? 0);

  if (member.status === "LOCKED_IN") {
    const elapsedMs = baseElapsed + delta;
    return {
      elapsedMs,
      breakElapsedMs: 0,
      breakRemainingMs: 0,
      breakOpenEnded: false,
      displayMs: elapsedMs,
    };
  }

  if (member.status === "BREAK") {
    const breakElapsedMs = breakOpenEnded
      ? baseBreakElapsed + delta
      : baseBreakElapsed;
    const breakRemainingMs = breakOpenEnded
      ? baseBreakRemaining
      : Math.max(0, baseBreakRemaining - delta);
    return {
      elapsedMs: baseElapsed,
      breakElapsedMs,
      breakRemainingMs,
      breakOpenEnded,
      displayMs: breakOpenEnded ? breakElapsedMs : breakRemainingMs,
    };
  }

  return {
    elapsedMs: baseElapsed,
    breakElapsedMs: baseBreakElapsed,
    breakRemainingMs: baseBreakRemaining,
    breakOpenEnded,
    displayMs: baseElapsed,
  };
}

/** Tick `Date.now()` on an interval so consumers recompute live clocks. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Pick the newer of two clocked snapshots. Prefer `a` when stamps are equal
 * or missing on `b`. Uses nullish coalescing so `elapsedMs: 0` is kept.
 */
export function pickNewerClockFields(
  a: Pick<
    RoomPresenceMember,
    | "elapsedMs"
    | "clockSyncedAt"
    | "breakElapsedMs"
    | "breakRemainingMs"
    | "breakOpenEnded"
  >,
  b: Pick<
    RoomPresenceMember,
    | "elapsedMs"
    | "clockSyncedAt"
    | "breakElapsedMs"
    | "breakRemainingMs"
    | "breakOpenEnded"
  >,
): Pick<
  RoomPresenceMember,
  | "elapsedMs"
  | "clockSyncedAt"
  | "breakElapsedMs"
  | "breakRemainingMs"
  | "breakOpenEnded"
> {
  const aAt = a.clockSyncedAt ?? 0;
  const bAt = b.clockSyncedAt ?? 0;
  const preferA = aAt >= bAt;
  const src = preferA ? a : b;
  const other = preferA ? b : a;
  return {
    elapsedMs: src.elapsedMs ?? other.elapsedMs ?? 0,
    clockSyncedAt: src.clockSyncedAt ?? other.clockSyncedAt,
    breakElapsedMs: src.breakElapsedMs ?? other.breakElapsedMs ?? 0,
    breakRemainingMs: src.breakRemainingMs ?? other.breakRemainingMs ?? 0,
    breakOpenEnded: src.breakOpenEnded ?? other.breakOpenEnded ?? false,
  };
}
