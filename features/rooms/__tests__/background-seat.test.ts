import { describe, expect, it } from "vitest";
import { backgroundKeepsRoomSeat } from "@/features/rooms/background-seat";

describe("backgroundKeepsRoomSeat", () => {
  it("keeps the seat on iPhone Safari", () => {
    expect(
      backgroundKeepsRoomSeat({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      }),
    ).toBe(true);
  });

  it("keeps the seat in a standalone display", () => {
    expect(
      backgroundKeepsRoomSeat({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        standalone: true,
      }),
    ).toBe(true);
  });

  it("still leaves on a desktop tab close", () => {
    expect(
      backgroundKeepsRoomSeat({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        platform: "Win32",
        standalone: false,
      }),
    ).toBe(false);
  });
});
