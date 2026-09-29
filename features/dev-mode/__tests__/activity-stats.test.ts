import { describe, expect, it } from "vitest";
import { DAY_START_CREDIT_MS } from "@/features/dev-mode/commit-time";
import {
  buildActivityStats,
  formatCodingDuration,
  formatCodingDurationTick,
} from "@/features/dev-mode/activity-stats";

function at(y: number, m: number, d: number, h: number, min = 0, message = "") {
  return {
    committed_at: new Date(y, m, d, h, min, 0, 0).toISOString(),
    message,
  };
}

function dayKey(y: number, m: number, d: number): string {
  const month = String(m + 1).padStart(2, "0");
  const day = String(d).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

describe("buildActivityStats", () => {
  const now = new Date(2026, 2, 21, 18, 0, 0, 0);

  it("returns zeros for no commits", () => {
    const stats = buildActivityStats([], { now });
    expect(stats.commitCount).toBe(0);
    expect(stats.codingMs).toBe(0);
    expect(stats.avgHoursPerMonth).toBe(0);
    expect(stats.avgHoursPerDay).toBe(0);
    expect(stats.avgCommitsPerMonth).toBe(0);
    expect(stats.bestCommitDay).toBeNull();
    expect(stats.bestTimeDay).toBeNull();
    expect(stats.chronotype).toBeNull();
    expect(stats.fixCommits).toBe(0);
    expect(stats.lateNightCommits).toBe(0);
    expect(stats.lateNightSessions).toEqual([]);
    expect(stats.lateNightDayKeys).toEqual([]);
    expect(stats.fixDayKeys).toEqual([]);
  });

  it("averages coding hours and commits over the build span", () => {
    const stats = buildActivityStats(
      [at(2026, 2, 21, 10, 0), at(2026, 2, 21, 10, 30)],
      { startIso: new Date(2026, 2, 21, 10, 0).toISOString(), now },
    );
    expect(stats.months).toBe(1);
    expect(stats.days).toBe(1);
    expect(stats.codingMs).toBe(30 * 60_000 + DAY_START_CREDIT_MS);
    expect(stats.avgHoursPerMonth).toBeCloseTo(2.5);
    expect(stats.avgHoursPerDay).toBeCloseTo(2.5);
    expect(stats.avgCommitsPerMonth).toBe(2);
  });

  it("picks the busiest commit day and the longest coding day separately", () => {
    const stats = buildActivityStats(
      [
        at(2026, 2, 10, 9, 0),
        at(2026, 2, 10, 9, 10),
        at(2026, 2, 10, 9, 20),
        at(2026, 2, 11, 14, 0),
        at(2026, 2, 11, 15, 30),
      ],
      { now },
    );
    expect(stats.bestCommitDay?.key).toBe(dayKey(2026, 2, 10));
    expect(stats.bestCommitDay?.commits).toBe(3);
    expect(stats.bestTimeDay?.key).toBe(dayKey(2026, 2, 11));
    expect(stats.bestTimeDay?.codingMs).toBe(90 * 60_000 + DAY_START_CREDIT_MS);
  });

  it("assigns a gap that crosses midnight to the later commit's day", () => {
    const stats = buildActivityStats(
      [at(2026, 2, 10, 23, 30), at(2026, 2, 11, 0, 20)],
      { now },
    );
    expect(stats.bestTimeDay?.key).toBe(dayKey(2026, 2, 11));
    expect(stats.bestTimeDay?.codingMs).toBe(50 * 60_000 + DAY_START_CREDIT_MS);
    expect(stats.codingMs).toBe(50 * 60_000 + 2 * DAY_START_CREDIT_MS);
  });

  it("credits the first commit of a day once and averages that total", () => {
    const stats = buildActivityStats(
      [at(2026, 2, 21, 10, 0), at(2026, 2, 21, 11, 0)],
      { startIso: new Date(2026, 2, 21, 10, 0).toISOString(), now },
    );
    expect(stats.codingMs).toBe(60 * 60_000 + DAY_START_CREDIT_MS);
    expect(stats.bestTimeDay?.codingMs).toBe(stats.codingMs);
    expect(stats.avgHoursPerDay).toBeCloseTo(3);
    expect(stats.avgHoursPerMonth).toBeCloseTo(3);
  });

  it("counts a 2am commit as night and late night", () => {
    const stats = buildActivityStats([at(2026, 2, 11, 2, 0, "ship it")], { now });
    expect(stats.nightCommits).toBe(1);
    expect(stats.morningCommits).toBe(0);
    expect(stats.lateNightCommits).toBe(1);
    expect(stats.chronotype).toBe("night");
  });

  it("treats 05:00 as morning and leaves the afternoon out of the vote", () => {
    const morning = buildActivityStats(
      [at(2026, 2, 11, 5, 0), at(2026, 2, 11, 14, 0)],
      { now },
    );
    expect(morning.morningCommits).toBe(1);
    expect(morning.nightCommits).toBe(0);
    expect(morning.lateNightCommits).toBe(0);
    expect(morning.chronotype).toBe("morning");

    const split = buildActivityStats([at(2026, 2, 11, 14, 0)], { now });
    expect(split.chronotype).toBe("split");
  });

  it("counts commit messages that contain fix", () => {
    const stats = buildActivityStats(
      [
        at(2026, 2, 11, 9, 0, "Fix the timer"),
        at(2026, 2, 11, 9, 20, "fixed layout"),
        at(2026, 2, 11, 9, 40, "hotfix deploy"),
        at(2026, 2, 11, 10, 0, "bugfix"),
        at(2026, 2, 11, 10, 20, "Add the calendar"),
      ],
      { now },
    );
    expect(stats.fixCommits).toBe(4);
    expect(stats.commitCount).toBe(5);
  });

  it("counts late night only from midnight up to 05:00", () => {
    const stats = buildActivityStats(
      [
        at(2026, 2, 11, 0, 0, "midnight"),
        at(2026, 2, 11, 4, 59, "still late"),
        at(2026, 2, 12, 5, 0, "morning"),
        at(2026, 2, 12, 23, 30, "evening"),
      ],
      { now },
    );
    expect(stats.lateNightCommits).toBe(2);
    expect(stats.nightCommits).toBe(3);
    expect(stats.morningCommits).toBe(1);
    expect(stats.chronotype).toBe("night");
    expect(stats.lateNightDayKeys).toEqual([dayKey(2026, 2, 11)]);
  });

  it("keeps a pre-midnight commit in the late night session that follows", () => {
    const start = new Date(2026, 2, 11, 23, 40).getTime();
    const end = new Date(2026, 2, 12, 0, 10).getTime();
    const stats = buildActivityStats(
      [at(2026, 2, 11, 23, 40), at(2026, 2, 12, 0, 10)],
      { now },
    );
    expect(stats.lateNightSessions).toEqual([{ start, end, commits: 2 }]);
    expect(stats.lateNightDayKeys).toEqual([dayKey(2026, 2, 12)]);
  });

  it("splits late night sessions when the gap is over 2 hours", () => {
    const early = new Date(2026, 2, 12, 1, 0).getTime();
    const later = new Date(2026, 2, 12, 4, 30).getTime();
    const stats = buildActivityStats(
      [at(2026, 2, 12, 1, 0), at(2026, 2, 12, 4, 30)],
      { now },
    );
    expect(stats.lateNightSessions).toEqual([
      { start: later, end: later, commits: 1 },
      { start: early, end: early, commits: 1 },
    ]);
  });

  it("returns no late night sessions for morning commits", () => {
    const stats = buildActivityStats(
      [at(2026, 2, 11, 9, 0), at(2026, 2, 11, 9, 30)],
      { now },
    );
    expect(stats.lateNightSessions).toEqual([]);
  });
});

describe("formatCodingDuration", () => {
  it("uses minutes under an hour and hours from one hour up", () => {
    expect(formatCodingDuration(0)).toBe("0m");
    expect(formatCodingDuration(-1)).toBe("0m");
    expect(formatCodingDuration(0.3)).toBe("18m");
    expect(formatCodingDuration(0.001)).toBe("1m");
    expect(formatCodingDuration(1)).toBe("1.0h");
    expect(formatCodingDuration(1.5)).toBe("1.5h");
  });

  it("keeps the final unit while a larger total is counting up", () => {
    expect(formatCodingDurationTick(2.5, 0.3)).toBe("0.3h");
    expect(formatCodingDurationTick(0.3, 0.1)).toBe("6m");
  });
});
