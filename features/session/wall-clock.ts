/** Max gap since last recorded progress before treating a session as abandoned. */
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000;

export function sessionProgressAtMs(
  startedAt: string,
  activeMs: number,
  breakMs: number,
): number {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return Date.now();
  return started + Math.max(0, activeMs) + Math.max(0, breakMs);
}

export function wallClockGapMs(
  startedAt: string,
  activeMs: number,
  breakMs: number,
  now = Date.now(),
): number {
  return Math.max(0, now - sessionProgressAtMs(startedAt, activeMs, breakMs));
}

export type WallClockBreakState = {
  onBreak: boolean;
  breakOpenEnded?: boolean;
  breakElapsedMs?: number;
  breakRemainingMs?: number;
};

export function applyWallClockCatchUp(
  activeMs: number,
  breakMs: number,
  startedAt: string,
  breakState: WallClockBreakState,
  now = Date.now(),
): {
  activeMs: number;
  breakMs: number;
  breakElapsedMs?: number;
  breakRemainingMs?: number;
} {
  const gap = wallClockGapMs(startedAt, activeMs, breakMs, now);
  if (gap <= 0) {
    return {
      activeMs,
      breakMs,
      breakElapsedMs: breakState.breakElapsedMs,
      breakRemainingMs: breakState.breakRemainingMs,
    };
  }

  if (breakState.onBreak) {
    const openEnded = breakState.breakOpenEnded ?? true;
    if (openEnded) {
      const breakElapsedMs =
        Math.max(0, breakState.breakElapsedMs ?? breakMs) + gap;
      return {
        activeMs,
        breakMs: breakMs + gap,
        breakElapsedMs,
        breakRemainingMs: breakState.breakRemainingMs ?? 0,
      };
    }
    const remaining = Math.max(0, (breakState.breakRemainingMs ?? 0) - gap);
    const elapsed =
      Math.max(0, breakState.breakElapsedMs ?? 0) +
      Math.max(0, (breakState.breakRemainingMs ?? 0) - remaining);
    return {
      activeMs,
      breakMs: breakMs + gap,
      breakElapsedMs: elapsed,
      breakRemainingMs: remaining,
    };
  }

  return {
    activeMs: activeMs + gap,
    breakMs,
    breakElapsedMs: breakState.breakElapsedMs,
    breakRemainingMs: breakState.breakRemainingMs,
  };
}
