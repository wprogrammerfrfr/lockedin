import { describe, expect, it } from "vitest";
import {
  STALE_SESSION_MS,
  applyWallClockCatchUp,
  wallClockGapMs,
} from "@/features/session/wall-clock";
import { isSessionStale } from "@/features/session/sync";

describe("wallClockGapMs", () => {
  const started = "2026-01-01T12:00:00.000Z";

  it("adds focus gap while LOCKED IN", () => {
    const now = Date.parse("2026-01-01T12:05:00.000Z");
    expect(wallClockGapMs(started, 60_000, 0, now)).toBe(4 * 60_000);
    const caught = applyWallClockCatchUp(60_000, 0, started, {
      onBreak: false,
    }, now);
    expect(caught.activeMs).toBe(5 * 60_000);
  });

  it("adds break gap while on break (open-ended)", () => {
    const now = Date.parse("2026-01-01T12:03:00.000Z");
    const caught = applyWallClockCatchUp(120_000, 30_000, started, {
      onBreak: true,
      breakOpenEnded: true,
      breakElapsedMs: 30_000,
    }, now);
    expect(caught.activeMs).toBe(120_000);
    expect(caught.breakMs).toBe(30_000 + 30_000);
  });
});

describe("isSessionStale with 12h cap", () => {
  const started = "2026-01-01T12:00:00.000Z";

  it("is fresh after a short nap", () => {
    const now = Date.parse("2026-01-01T12:10:00.000Z");
    expect(
      isSessionStale(
        { started_at: started, active_ms: 60_000, break_ms: 0 },
        now,
        STALE_SESSION_MS,
      ),
    ).toBe(false);
  });

  it("is stale after 12 hours without progress", () => {
    const now = Date.parse("2026-01-02T01:00:00.000Z");
    expect(
      isSessionStale(
        { started_at: started, active_ms: 60_000, break_ms: 0 },
        now,
        STALE_SESSION_MS,
      ),
    ).toBe(true);
  });
});
