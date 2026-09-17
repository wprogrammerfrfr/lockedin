import { describe, expect, it, vi } from "vitest";
import {
  ensureGuestSession,
  validateGuestNickname,
} from "@/features/rooms/guest-join";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function mockAuth(opts: {
  session: {
    user: { id: string; is_anonymous?: boolean };
  } | null;
  signIn?: () => Promise<{
    data: { session: { user: { id: string; is_anonymous?: boolean } } | null };
    error: { message: string } | null;
  }>;
}) {
  const signInAnonymously = vi.fn(
    opts.signIn ??
      (async () => ({
        data: {
          session: { user: { id: "anon-1", is_anonymous: true } },
        },
        error: null,
      })),
  );
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: opts.session },
      })),
      signInAnonymously,
    },
  } as unknown as SupabaseClient;
}

describe("ensureGuestSession", () => {
  it("reuses an existing authenticated session", async () => {
    const user = { id: "real-1", is_anonymous: false };
    const session = { user };
    const supabase = mockAuth({ session });
    const result = await ensureGuestSession(supabase);
    expect(result.mode).toBe("authenticated");
    expect(result.user).toBe(user);
    expect(result.session).toBe(session);
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("reuses an existing anonymous session", async () => {
    const user = { id: "anon-1", is_anonymous: true };
    const session = { user };
    const supabase = mockAuth({ session });
    const result = await ensureGuestSession(supabase);
    expect(result.mode).toBe("anonymous");
    expect(result.user).toBe(user);
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("calls signInAnonymously when no session exists", async () => {
    const supabase = mockAuth({ session: null });
    const result = await ensureGuestSession(supabase);
    expect(result.mode).toBe("anonymous");
    expect(result.user.id).toBe("anon-1");
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it("surfaces anonymous_sign_in_failed when sign-in errors", async () => {
    const supabase = mockAuth({
      session: null,
      signIn: async () => ({
        data: { session: null },
        error: { message: "Anonymous sign-ins are disabled" },
      }),
    });
    await expect(ensureGuestSession(supabase)).rejects.toThrow(
      /Anonymous sign-ins are disabled|anonymous_sign_in_failed/,
    );
  });

  it("surfaces anonymous_sign_in_failed when sign-in returns no user", async () => {
    const supabase = mockAuth({
      session: null,
      signIn: async () => ({
        data: { session: null },
        error: null,
      }),
    });
    await expect(ensureGuestSession(supabase)).rejects.toThrow(
      "anonymous_sign_in_failed",
    );
  });
});
