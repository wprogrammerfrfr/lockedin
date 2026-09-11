import { describe, expect, it } from "vitest";
import {
  memberDisplayClock,
  pickNewerClockFields,
  type SelfLiveClock,
} from "@/features/rooms/live-member-clock";
import { mergeMembers } from "@/features/rooms/useRoomChannel";
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

describe("pickNewerClockFields", () => {
  it("keeps elapsedMs of 0 (does not treat as missing)", () => {
    const picked = pickNewerClockFields(
      { elapsedMs: 0, clockSyncedAt: 200 },
      { elapsedMs: 5_000, clockSyncedAt: 100 },
    );
    expect(picked.elapsedMs).toBe(0);
    expect(picked.clockSyncedAt).toBe(200);
  });

  it("prefers newer clockSyncedAt", () => {
    const picked = pickNewerClockFields(
      { elapsedMs: 1_000, clockSyncedAt: 100 },
      { elapsedMs: 9_000, clockSyncedAt: 500 },
    );
    expect(picked.elapsedMs).toBe(9_000);
    expect(picked.clockSyncedAt).toBe(500);
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

  it("does not drop elapsedMs of 0 from presence", () => {
    const table = [
      baseMember({
        userId: "u1",
        seat: 1,
        elapsedMs: 9_000,
        clockSyncedAt: 100,
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
          clockSyncedAt: 500,
          status: "LOCKED_IN",
        }),
      ],
    ]);
    const merged = mergeMembers(table, presence);
    expect(merged[0]?.elapsedMs).toBe(0);
  });
});
