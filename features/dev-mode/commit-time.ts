/** Gaps longer than this are a break, not time spent coding. */
export const SESSION_GAP_MS = 2 * 60 * 60 * 1000;

/** Work before the first commit of each local day, which never shows up as a gap. */
export const DAY_START_CREDIT_MS = 2 * 60 * 60 * 1000;

function localDayKey(time: number): string {
  const d = new Date(time);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Sum of time between neighboring commits when the gap is 2 hours or less,
 * plus 2 hours for the first commit of each local day.
 * Overnight and weekend gaps are ignored.
 */
export function estimateCommitMs(
  commits: { committed_at: string }[],
): number {
  const times = commits
    .map((c) => new Date(c.committed_at).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  let ms = 0;
  const days = new Set<string>();
  for (let i = 0; i < times.length; i++) {
    days.add(localDayKey(times[i]));
    if (i === 0) continue;
    const gap = times[i] - times[i - 1];
    if (gap > 0 && gap <= SESSION_GAP_MS) ms += gap;
  }
  return ms + days.size * DAY_START_CREDIT_MS;
}
