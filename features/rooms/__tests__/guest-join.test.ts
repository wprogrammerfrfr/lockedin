import { describe, expect, it } from "vitest";
import { validateGuestNickname } from "@/features/rooms/guest-join";

describe("validateGuestNickname", () => {
  it("accepts valid handles", () => {
    expect(validateGuestNickname("focusfox")).toBe("focusfox");
    expect(validateGuestNickname(" Focus_1 ")).toBe("focus_1");
  });

  it("rejects invalid handles", () => {
    expect(validateGuestNickname("ab")).toBeNull();
    expect(validateGuestNickname("has space")).toBeNull();
    expect(validateGuestNickname("admin")).toBeNull();
  });
});
