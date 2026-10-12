import { describe, expect, it } from "vitest";
import {
  memberDisplayClock,
  pickNewerClockFields,
  type SelfLiveClock,
} from "@/features/rooms/live-member-clock";
import { mergeMembers } from "@/features/rooms/useRoomChannel";
import { mergePresenceOnSync } from "@/features/rooms/presence-merge";
import type { RoomPresenceMember } from "@/features/rooms/types";

function baseMember(
  overrides: Partial<RoomPresenceMember> & { userId: string },
): RoomPresenceMember {
  return {
    username: "user",
    displayName: "user",
    avatarPath: null,
    status: "LOCKED_IN",
    elapsedMs: 0,
    ...overrides,
  };
}

describe("memberDisplayClock", () => {
  it("overlays self live clock and ignores stale presence elapsedMs", () => {
    const member = baseMember({
      userId: "me",
      elapsedMs: 1000,
      clockSyncedAt: 1_000_000,
      status: "LOCKED_IN",
    });
    const selfLive: SelfLiveClock = {
      userId: "me",
      elapsedMs: 45_000,
      status: "LOCKED_IN",
    };
    const clock = memberDisplayClock(member, 1_010_000, selfLive);
    expect(clock.elapsedMs).toBe(45_000);
    expect(clock.displayMs).toBe(45_000);
  });

  it("extrapolates remote LOCKED_IN from clockSyncedAt", () => {
    const member = baseMember({
      userId: "them",
      elapsedMs: 5_000,
      clockSyncedAt: 1_000_000,
      status: "LOCKED_IN",
    });
    const clock = memberDisplayClock(member, 1_003_500);
    expect(clock.elapsedMs).toBe(8_500);
    expect(clock.displayMs).toBe(8_500);
  });

  it("keeps a remote LOCKED_IN clock increasing from the last stamp", () => {
    const member = baseMember({
      userId: "them",
      elapsedMs: 10_000,
      clockSyncedAt: 1_000_000,
      status: "LOCKED_IN",
    });
    const first = memberDisplayClock(member, 1_002_000);
    const later = memberDisplayClock(member, 1_005_000);
    expect(later.displayMs - first.displayMs).toBe(3_000);
  });

  it("treats a future clockSyncedAt as now", () => {
    const now = 1_000_000;
    const member = baseMember({
      userId: "them",
      elapsedMs: 4_000,
      clockSyncedAt: now + 30_000,
      status: "LOCKED_IN",
    });
    expect(memberDisplayClock(member, now).displayMs).toBe(4_000);
  });

  it("freezes focus elapsed on BREAK and ticks open-ended break", () => {
    const member = baseMember({
      userId: "them",
      status: "BREAK",
      elapsedMs: 12_000,
      clockSyncedAt: 1_000_000,
      breakOpenEnded: true,
      breakElapsedMs: 2_000,
      breakRemainingMs: 0,
    });
    const clock = memberDisplayClock(member, 1_004_000);
    expect(clock.elapsedMs).toBe(12_000);
    expect(clock.breakElapsedMs).toBe(6_000);
    expect(clock.displayMs).toBe(6_000);
  });

  it("counts down countdown break from stamp", () => {
    const member = baseMember({
      userId: "them",
      status: "BREAK",
      elapsedMs: 12_000,
      clockSyncedAt: 1_000_000,
      breakOpenEnded: false,
      breakElapsedMs: 0,
      breakRemainingMs: 10_000,
    });
    const clock = memberDisplayClock(member, 1_003_000);
    expect(clock.elapsedMs).toBe(12_000);
    expect(clock.breakRemainingMs).toBe(7_000);
    expect(clock.displayMs).toBe(7_000);
  });

  it("keeps WAITING / IDLE snapshots frozen", () => {
    const member = baseMember({
      userId: "them",
      status: "WAITING",
      elapsedMs: 0,
      clockSyncedAt: 1_000_000,
    });
    const clock = memberDisplayClock(member, 1_060_000);
    expect(clock.elapsedMs).toBe(0);
    expect(clock.displayMs).toBe(0);
  });
});

describe("mergePresenceOnSync", () => {
  it("keeps ghost LOCKED_IN stamp when Realtime drops a sleeping peer", () => {
    const table = [
      baseMember({
        userId: "u1",
        seat: 1,
        status: "LOCKED_IN",
        elapsedMs: 10_000,
      }),
    ];
    const prev = new Map<string, RoomPresenceMember>([
      [
        "u1",
        baseMember({
          userId: "u1",
          elapsedMs: 10_000,
          clockSyncedAt: 1_000_000,
          status: "LOCKED_IN",
        }),
      ],
    ]);
    const merged = mergePresenceOnSync(new Map(), prev, table);
    expect(merged.get("u1")?.clockSyncedAt).toBe(1_000_000);
    const clock = memberDisplayClock(merged.get("u1")!, 1_005_000);
    expect(clock.displayMs).toBe(15_000);
  });

  it("does not ghost WAITING members", () => {
    const table = [
      baseMember({
        userId: "u1",
        seat: 1,
        status: "WAITING",
        elapsedMs: 0,
      }),
    ];
    const prev = new Map<string, RoomPresenceMember>([
      [
        "u1",
        baseMember({
          userId: "u1",
          elapsedMs: 0,
          clockSyncedAt: 1_000_000,
          status: "WAITING",
        }),
      ],
    ]);
    const merged = mergePresenceOnSync(new Map(), prev, table);
    expect(merged.has("u1")).toBe(false);
  });
});

describe("pickNewerClockFields", () => {
  it("keeps elapsedMs of 0 when the projections tie", () => {
    const picked = pickNewerClockFields(
      { elapsedMs: 0, clockSyncedAt: 1_000 },
      { elapsedMs: 0, clockSyncedAt: 1_000 },
      1_000,
    );
    expect(picked.elapsedMs).toBe(0);
    expect(picked.clockSyncedAt).toBe(1_000);
  });

  it("prefers a further-along elapsed over a future presence stamp", () => {
    const now = 1_000_000;
    const picked = pickNewerClockFields(
      { elapsedMs: 0, clockSyncedAt: now + 60_000 },
      { elapsedMs: 20_000, clockSyncedAt: now - 10_000 },
      now,
    );
    expect(picked.elapsedMs).toBe(20_000);
    expect(picked.clockSyncedAt).toBe(now - 10_000);
  });

  it("prefers newer clockSyncedAt", () => {
    const picked = pickNewerClockFields(
      { elapsedMs: 1_000, clockSyncedAt: 100 },
      { elapsedMs: 9_000, clockSyncedAt: 500 },
    );
    expect(picked.elapsedMs).toBe(9_000);
    expect(picked.clockSyncedAt).toBe(500);
  });

  it("prefers presence BREAK clocks over newer DB row without break fields", () => {
    const presence = {
      elapsedMs: 12_000,
      clockSyncedAt: 1_000,
      breakOpenEnded: false,
      breakElapsedMs: 0,
      breakRemainingMs: 30_000,
    };
    const dbPoll = {
      elapsedMs: 12_000,
      clockSyncedAt: 9_999,
      // no break fields — typical fetchRoomMembers snapshot
    };
    const picked = pickNewerClockFields(presence, dbPoll);
    expect(picked.breakRemainingMs).toBe(30_000);
    expect(picked.clockSyncedAt).toBe(1_000);
  });
});

describe("mergeMembers", () => {
  it("prefers newer clockSyncedAt over stale presence", () => {
    const table = [
      baseMember({
        userId: "u1",
        seat: 1,
        elapsedMs: 20_000,
        clockSyncedAt: 2_000,
        status: "LOCKED_IN",
      }),
    ];
    const presence = new Map<string, RoomPresenceMember>([
      [
        "u1",
        baseMember({
          userId: "u1",
          seat: 1,
          elapsedMs: 1_000,
          clockSyncedAt: 1_000,
          status: "LOCKED_IN",
        }),
      ],
    ]);
    const merged = mergeMembers(table, presence);
    expect(merged[0]?.elapsedMs).toBe(20_000);
    expect(merged[0]?.clockSyncedAt).toBe(2_000);
  });

  it("lets a higher database elapsed replace a future presence stamp", () => {
    const now = Date.now();
    const table = [
      baseMember({
        userId: "u1",
        seat: 1,
        elapsedMs: 20_000,
        clockSyncedAt: now - 10_000,
        status: "LOCKED_IN",
      }),
    ];
    const presence = new Map<string, RoomPresenceMember>([
      [
        "u1",
        baseMember({
          userId: "u1",
          seat: 1,
          elapsedMs: 0,
          clockSyncedAt: now + 60_000,
          status: "LOCKED_IN",
        }),
      ],
    ]);
    const merged = mergeMembers(table, presence);
    expect(merged[0]?.elapsedMs).toBe(20_000);
    expect(merged[0]?.clockSyncedAt).toBe(now - 10_000);
  });

  it("keeps live BREAK countdown when DB poll has no break ms and no stamp", () => {
    const table = [
      baseMember({
        userId: "u1",
        seat: 1,
        elapsedMs: 12_000,
        status: "BREAK",
        breakLabel: "coffee",
        breakType: "coffee",
        // no clockSyncedAt — matches fetchRoomMembers after fix
      }),
    ];
    const presence = new Map<string, RoomPresenceMember>([
      [
        "u1",
        baseMember({
          userId: "u1",
          seat: 1,
          elapsedMs: 12_000,
          clockSyncedAt: 1_000_000,
          status: "BREAK",
          breakOpenEnded: false,
          breakElapsedMs: 0,
          breakRemainingMs: 25_000,
          breakLabel: "coffee",
          breakType: "coffee",
        }),
      ],
    ]);
    const merged = mergeMembers(table, presence);
    expect(merged[0]?.status).toBe("BREAK");
    expect(merged[0]?.breakRemainingMs).toBe(25_000);
    expect(merged[0]?.clockSyncedAt).toBe(1_000_000);
    const clock = memberDisplayClock(merged[0]!, 1_005_000);
    expect(clock.displayMs).toBe(20_000);
  });

  it("hides idle table members missing from presence after sync", () => {
    const table = [
      baseMember({
        userId: "u1",
        seat: 1,
        status: "WAITING",
      }),
      baseMember({
        userId: "u2",
        seat: 2,
        status: "LOCKED_IN",
        elapsedMs: 5_000,
      }),
    ];
    const presence = new Map<string, RoomPresenceMember>();
    const beforeSync = mergeMembers(table, presence, { presenceSynced: false });
    expect(beforeSync).toHaveLength(2);

    const afterSync = mergeMembers(table, presence, { presenceSynced: true });
    expect(afterSync).toHaveLength(1);
    expect(afterSync[0]?.userId).toBe("u2");
    expect(afterSync[0]?.status).toBe("LOCKED_IN");
  });
});
