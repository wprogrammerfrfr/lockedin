import { describe, expect, it } from "vitest";
import {
  needsUsernameClaim,
  shouldPromptUsernameClaim,
} from "@/lib/profile/username";

describe("needsUsernameClaim", () => {
  it("returns false when claimedAt is set", () => {
    expect(needsUsernameClaim("maya", "2026-01-01")).toBe(false);
    expect(needsUsernameClaim("u_deadbeef", "2026-01-01")).toBe(false);
  });

  it("returns true for provisional usernames without claim", () => {
    expect(needsUsernameClaim("u_deadbeef", null)).toBe(true);
    expect(needsUsernameClaim("user_abcdef", undefined)).toBe(true);
  });

  it("returns true when username is missing", () => {
    expect(needsUsernameClaim(null, null)).toBe(true);
    expect(needsUsernameClaim(undefined, undefined)).toBe(true);
    expect(needsUsernameClaim("", null)).toBe(true);
  });

  it("returns false for a real username even without claimedAt", () => {
    // Claim is only forced for provisional/missing handles; AuthProvider
    // also backfills claimedAt as "legacy" for non-provisional names.
    expect(needsUsernameClaim("maya", null)).toBe(false);
  });
});

describe("shouldPromptUsernameClaim", () => {
  it("never opens while profile is not ready (prevents PWA flash)", () => {
    expect(
      shouldPromptUsernameClaim({
        profileReady: false,
        isAuthenticated: true,
        isAnonymous: false,
        username: undefined,
        claimedAt: undefined,
      }),
    ).toBe(false);
  });

  it("opens after profile load when claim is still needed", () => {
    expect(
      shouldPromptUsernameClaim({
        profileReady: true,
        isAuthenticated: true,
        isAnonymous: false,
        username: "u_deadbeef12",
        claimedAt: null,
      }),
    ).toBe(true);
  });

  it("stays closed when username is already claimed", () => {
    expect(
      shouldPromptUsernameClaim({
        profileReady: true,
        isAuthenticated: true,
        isAnonymous: false,
        username: "maya",
        claimedAt: "2026-01-01",
      }),
    ).toBe(false);
  });

  it("stays closed for guests and anonymous users", () => {
    expect(
      shouldPromptUsernameClaim({
        profileReady: true,
        isAuthenticated: false,
        isAnonymous: false,
        username: "u_deadbeef12",
        claimedAt: null,
      }),
    ).toBe(false);
    expect(
      shouldPromptUsernameClaim({
        profileReady: true,
        isAuthenticated: true,
        isAnonymous: true,
        username: "u_deadbeef12",
        claimedAt: null,
      }),
    ).toBe(false);
  });
});
