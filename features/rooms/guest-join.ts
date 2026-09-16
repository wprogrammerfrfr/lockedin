import type { SupabaseClient } from "@supabase/supabase-js";
import { joinRoom } from "@/features/rooms/api";
import type { RoomSummary } from "@/features/rooms/types";
import {
  isValidUsername,
  normalizeUsername,
} from "@/lib/profile/username";

export const GUEST_NICKNAME_KEY = "lockedin.guestNickname";

export function loadGuestNickname(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(GUEST_NICKNAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveGuestNickname(nickname: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_NICKNAME_KEY, normalizeUsername(nickname));
  } catch {
    /* ignore */
  }
}

export function validateGuestNickname(raw: string): string | null {
  const n = normalizeUsername(raw);
  if (!isValidUsername(n)) return null;
  return n;
}

/** Ensure an anonymous Supabase session exists (real users are left alone). */
export async function ensureGuestSession(supabase: SupabaseClient) {
  const { data: existing } = await supabase.auth.getSession();
  const user = existing.session?.user;
  if (user && !user.is_anonymous) {
    return { session: existing.session, user, mode: "authenticated" as const };
  }
  if (user?.is_anonymous && existing.session) {
    return { session: existing.session, user, mode: "anonymous" as const };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message || "anonymous_sign_in_failed");
  if (!data.session?.user) throw new Error("anonymous_sign_in_failed");
  return {
    session: data.session,
    user: data.session.user,
    mode: "anonymous" as const,
  };
}

async function claimGuestNickname(
  supabase: SupabaseClient,
  nick: string,
): Promise<void> {
  const { error } = await supabase.rpc("change_username", { p_new: nick });
  if (!error) {
    saveGuestNickname(nick);
    return;
  }
  const msg = error.message ?? "";
  if (/username_taken/i.test(msg)) {
    const suffix = Math.floor(100 + Math.random() * 900);
    const fallback = `${nick.slice(0, 16)}_${suffix}`.slice(0, 20);
    const { error: retryError } = await supabase.rpc("change_username", {
      p_new: fallback,
    });
    if (retryError) throw new Error(retryError.message);
    saveGuestNickname(fallback);
    return;
  }
  if (/invalid_username|username_reserved/i.test(msg)) {
    throw new Error(msg);
  }
  // Profile may not exist yet — caller should join first then retry.
  throw new Error(msg);
}

/**
 * Sign in anonymously if needed, join the room, then set the guest nickname.
 * Real authenticated users only join (nickname ignored).
 */
export async function joinRoomAsGuest(
  supabase: SupabaseClient,
  code: string,
  nickname: string,
): Promise<RoomSummary> {
  const nick = validateGuestNickname(nickname);
  if (!nick) throw new Error("invalid_nickname");

  const { mode } = await ensureGuestSession(supabase);
  const room = await joinRoom(supabase, code);

  if (mode === "anonymous") {
    try {
      await claimGuestNickname(supabase, nick);
    } catch {
      // Seat is already taken; nickname can be set on next visit.
      saveGuestNickname(nick);
    }
  }

  return room;
}
