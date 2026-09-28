/** Gaps longer than this are a break, not time spent coding. */
export const SESSION_GAP_MS = 2 * 60 * 60 * 1000;

/**
 * Sum of time between neighboring commits when the gap is 2 hours or less.
 * Overnight and weekend gaps are ignored. A single commit estimates as 0.
 */
export function estimateCommitMs(
  commits: { committed_at: string }[],
): number {
  const times = commits
    .map((c) => new Date(c.committed_at).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  let ms = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > 0 && gap <= SESSION_GAP_MS) ms += gap;
  }
  return ms;
}
