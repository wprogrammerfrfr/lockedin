import { describe, expect, it } from "vitest";
import { estimateCommitMs, SESSION_GAP_MS } from "@/features/dev-mode/commit-time";

const T0 = Date.UTC(2026, 2, 21, 14, 0, 0);

function at(offsetMs: number) {
  return { committed_at: new Date(T0 + offsetMs).toISOString() };
}

describe("estimateCommitMs", () => {
  it("returns 0 for no commits or a single commit", () => {
    expect(estimateCommitMs([])).toBe(0);
    expect(estimateCommitMs([at(0)])).toBe(0);
  });

  it("sums gaps at or under 2 hours", () => {
    expect(
      estimateCommitMs([at(0), at(40 * 60_000), at(SESSION_GAP_MS)]),
    ).toBe(SESSION_GAP_MS);
  });

  it("ignores gaps longer than 2 hours", () => {
    expect(
      estimateCommitMs([
        at(0),
        at(30 * 60_000),
        at(30 * 60_000 + SESSION_GAP_MS + 1),
        at(30 * 60_000 + SESSION_GAP_MS + 1 + 20 * 60_000),
      ]),
    ).toBe(50 * 60_000);
  });

  it("sorts unsorted commits and skips identical timestamps", () => {
    expect(estimateCommitMs([at(15 * 60_000), at(0), at(0)])).toBe(15 * 60_000);
  });

  it("ignores invalid timestamps", () => {
    expect(
      estimateCommitMs([
        { committed_at: "not-a-date" },
        at(0),
        at(10 * 60_000),
      ]),
    ).toBe(10 * 60_000);
  });
});
