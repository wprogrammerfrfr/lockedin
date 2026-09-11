import type { SessionRow } from "@/types/database";

/** Local calendar day key (YYYY-MM-DD) in an IANA timezone. */
export function localDayKey(iso: string | Date, timeZone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isTerminal(status: string) {
  return status === "ended" || status === "tapped_out";
}

/** Sum active_ms for sessions that started on the local "today" in `timeZone`. */
export function computeTodayMs(
  sessions: Pick<SessionRow, "started_at" | "active_ms" | "status">[],
  timeZone: string,
  now = new Date(),
): number {
  const today = localDayKey(now, timeZone);
  return sessions.reduce((sum, s) => {
    if (localDayKey(s.started_at, timeZone) !== today) return sum;
    return sum + (Number(s.active_ms) || 0);
  }, 0);
}

/**
 * Consecutive local days (ending today or yesterday) with ≥1 terminal session
 * that has active_ms > 0.
 */
export function computeStreak(
  sessions: Pick<SessionRow, "started_at" | "active_ms" | "status">[],
  timeZone: string,
  now = new Date(),
): number {
  const daysWithFocus = new Set<string>();
  for (const s of sessions) {
    if (!isTerminal(s.status) && s.status !== "active" && s.status !== "on_break") {
      continue;
    }
    if ((Number(s.active_ms) || 0) <= 0) continue;
    daysWithFocus.add(localDayKey(s.started_at, timeZone));
  }

  if (daysWithFocus.size === 0) return 0;

  let streak = 0;
  const cursor = new Date(now);

  // If today has no activity yet, allow streak to continue from yesterday.
  const todayKey = localDayKey(cursor, timeZone);
  if (!daysWithFocus.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  for (;;) {
    const key = localDayKey(cursor, timeZone);
    if (!daysWithFocus.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 400) break;
  }

  return streak;
}

export function computePersonalRecordMs(
  sessions: Pick<SessionRow, "active_ms" | "status">[],
): number {
  let max = 0;
  for (const s of sessions) {
    if (!isTerminal(s.status)) continue;
    max = Math.max(max, Number(s.active_ms) || 0);
  }
  return max;
}
