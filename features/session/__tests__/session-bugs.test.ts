import { describe, expect, it } from "vitest";
import { initialState, reducer } from "@/features/session/reducer";
import { isSessionStale } from "@/features/session/sync";
import { isActiveSessionDraftStale } from "@/lib/auth/merge";
import { hydrateRemoteFromSessionRow } from "@/features/session/hydrate-remote";
import type { SessionRow } from "@/types/database";

describe("TICK first PR", () => {
  it("sets didBreakPR when crossing personalRecordMs of 0", () => {
    const base = {
      ...initialState,
      session: "LOCKED_IN" as const,
      personalRecordMs: 0,
      elapsedMs: 0,
      didBreakPR: false,
    };
    const next = reducer(base, { type: "TICK", delta: 50 });
    expect(next.elapsedMs).toBe(50);
    expect(next.didBreakPR).toBe(true);
    expect(next.personalRecordMs).toBe(50);
    expect(next.lastOutcome).toBe("pr");
  });

  it("fires once when crossing an existing PR", () => {
    const base = {
      ...initialState,
      session: "LOCKED_IN" as const,
      personalRecordMs: 1000,
      elapsedMs: 980,
      didBreakPR: false,
      lastOutcome: "solid" as const,
    };
    const crossed = reducer(base, { type: "TICK", delta: 50 });
    expect(crossed.didBreakPR).toBe(true);
    expect(crossed.personalRecordMs).toBe(1030);
    expect(crossed.lastOutcome).toBe("pr");

    const afterClear = reducer(crossed, { type: "CLEAR_PR_BURST" });
    expect(afterClear.didBreakPR).toBe(false);

    const after = reducer(afterClear, { type: "TICK", delta: 50 });
    // Confetti stays off; lastOutcome remains pr for the session
    expect(after.didBreakPR).toBe(false);
    expect(after.personalRecordMs).toBe(1080);
    expect(after.lastOutcome).toBe("pr");
  });

  it("does not inflate todayTotalMs on TICK", () => {
    const base = {
      ...initialState,
      session: "LOCKED_IN" as const,
      todayTotalMs: 5_000,
      elapsedMs: 0,
    };
    const next = reducer(base, { type: "TICK", delta: 100 });
    expect(next.todayTotalMs).toBe(5_000);
    expect(next.elapsedMs).toBe(100);
  });
});

describe("HYDRATE_REMOTE break restore", () => {
  it("keeps break fields when resuming ON_BREAK", () => {
    const next = reducer(initialState, {
      type: "HYDRATE_REMOTE",
      remoteSessionId: "sess-1",
      clientId: "client-1",
      elapsedMs: 12_000,
      session: "ON_BREAK",
      breakMs: 90_000,
      breakTypeId: "hydration",
      breakOpenEnded: true,
      breakElapsedMs: 90_000,
      breakTypesUsed: ["hydration"],
    });
    expect(next.session).toBe("ON_BREAK");
    expect(next.breakMs).toBe(90_000);
    expect(next.breakElapsedMs).toBe(90_000);
    expect(next.breakOpenEnded).toBe(true);
    expect(next.breakTypeId).toBe("hydration");
    expect(next.remoteSessionId).toBe("sess-1");
  });

  it("clears break fields when resuming LOCKED_IN", () => {
    const next = reducer(
      {
        ...initialState,
        breakMs: 10,
        breakTypeId: "hydration",
        breakElapsedMs: 10,
      },
      {
        type: "HYDRATE_REMOTE",
        remoteSessionId: "sess-2",
        elapsedMs: 5_000,
        session: "LOCKED_IN",
      },
    );
    expect(next.session).toBe("LOCKED_IN");
    expect(next.breakTypeId).toBeNull();
    expect(next.breakElapsedMs).toBe(0);
  });
});

describe("HYDRATE_GUEST_DRAFT", () => {
  it("restores elapsed and break time", () => {
    const next = reducer(initialState, {
      type: "HYDRATE_GUEST_DRAFT",
      sessionName: "Guest grind",
      elapsedMs: 45_000,
      breakMs: 3_000,
      didBreakPR: true,
      personalRecordMs: 45_000,
      session: "ON_BREAK",
    });
    expect(next.session).toBe("ON_BREAK");
    expect(next.elapsedMs).toBe(45_000);
    expect(next.breakMs).toBe(3_000);
    expect(next.sessionName).toBe("Guest grind");
    expect(next.didBreakPR).toBe(true);
  });
});

describe("HYDRATE_STATS", () => {
  it("applies server personalRecordMs of 0", () => {
    const next = reducer(
      { ...initialState, personalRecordMs: 9_999 },
      {
        type: "HYDRATE_STATS",
        streak: 2,
        todayTotalMs: 100,
        personalRecordMs: 0,
      },
    );
    expect(next.personalRecordMs).toBe(0);
    expect(next.streak).toBe(2);
  });
});

describe("isSessionStale", () => {
  it("is fresh when progress is recent", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const started = new Date(now - 60_000).toISOString();
    expect(
      isSessionStale(
        { started_at: started, active_ms: 50_000, break_ms: 0 },
        now,
        180_000,
      ),
    ).toBe(false);
  });

  it("is stale when heartbeats stopped beyond window", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const started = new Date(now - 10 * 60_000).toISOString();
    expect(
      isSessionStale(
        { started_at: started, active_ms: 60_000, break_ms: 0 },
        now,
        180_000,
      ),
    ).toBe(true);
  });
});

describe("isActiveSessionDraftStale", () => {
  it("matches the same stale window as cloud sessions", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    expect(
      isActiveSessionDraftStale(
        {
          sessionName: null,
          elapsedMs: 1000,
          breakMs: 0,
          breakTypesUsed: [],
          personalRecordMs: 0,
          didBreakPR: false,
          updatedAt: new Date(now - 60_000).toISOString(),
        },
        now,
        180_000,
      ),
    ).toBe(false);
    expect(
      isActiveSessionDraftStale(
        {
          sessionName: null,
          elapsedMs: 1000,
          breakMs: 0,
          breakTypesUsed: [],
          personalRecordMs: 0,
          didBreakPR: false,
          updatedAt: new Date(now - 200_000).toISOString(),
        },
        now,
        180_000,
      ),
    ).toBe(true);
  });
});

describe("hydrateRemoteFromSessionRow", () => {
  it("maps on_break rows with breakMs", () => {
    const row: SessionRow = {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      user_id: "u1",
      session_name: "Deep work",
      started_at: "2026-01-01T11:00:00.000Z",
      ended_at: null,
      status: "on_break",
      active_ms: 20_000,
      break_ms: 5_000,
      break_types_used: ["hydration"],
      is_shared: false,
      outcome: null,
      pr_broken: false,
      client_id: "cccccccc-dddd-4eee-8fff-000000000000",
    };
    const action = hydrateRemoteFromSessionRow(row);
    expect(action.type).toBe("HYDRATE_REMOTE");
    expect(action.session).toBe("ON_BREAK");
    expect(action.breakMs).toBe(5_000);
    expect(action.breakTypeId).toBe("hydration");
    expect(action.elapsedMs).toBe(20_000);
  });
});
