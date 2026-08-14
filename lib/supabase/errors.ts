const SCHEMA_RE =
  /schema cache|could not find the (table|function)|does not exist|PGRST202|PGRST205|42P01|42883/i;

const ALLOWED_KEYS: Record<string, string> = {
  invalid_username:
    "Username must be 3–20 characters: letters, numbers, and underscores only.",
  username_taken: "That username is already taken.",
  username_cooldown: "You can change your username again after the cooldown.",
  not_authenticated: "You must be signed in to continue.",
  rate_limited: "Slow down — try again in a moment.",
  room_full: "Room is full (max 6).",
  active_session_exists: "You already have an active session.",
  already_in_other_room: "You're already in a room — leave it first.",
  profile_not_found: "Your profile isn't ready yet. Refresh and try again.",
  room_code_generation_failed: "Could not generate a room code. Try again.",
  room_not_found: "That room code doesn't exist.",
  room_closed: "That room has closed.",
  not_in_room: "You're not in that room.",
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "";
}

export function isSchemaUnavailable(err: unknown): boolean {
  return SCHEMA_RE.test(errorMessage(err));
}

/**
 * Fail-closed: only allowlisted keys become user-facing copy.
 * Never returns raw PostgREST / Auth / RPC messages.
 */
export function userFacingError(err: unknown, fallback: string): string {
  const msg = errorMessage(err);
  if (!msg) return fallback;

  for (const [key, copy] of Object.entries(ALLOWED_KEYS)) {
    if (msg.includes(key)) return copy;
  }

  return fallback;
}
