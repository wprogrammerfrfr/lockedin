const SCHEMA_RE =
  /schema cache|could not find the (table|function)|does not exist|PGRST202|PGRST205|42P01|42883/i;

const ALLOWED_KEYS: Record<string, string> = {
  invalid_username:
    "Username must be 3–20 characters: letters, numbers, and underscores only.",
  username_taken: "That username is already taken.",
  username_reserved: "That username is reserved.",
  username_cooldown:
    "You can only change your username once every 30 days.",
  not_authenticated: "You must be signed in to continue.",
  rate_limited: "Slow down — try again in a moment.",
  blocked: "You can't interact with this user.",
  already_blocked: "You've already blocked this user.",
  not_authorized: "You're not allowed to do that.",
  room_full: "Room is full (max 6).",
  active_session_exists: "You already have an active session.",
  already_in_other_room: "You're already in a room — leave it first.",
  profile_not_found: "Your profile isn't ready yet. Refresh and try again.",
  room_code_generation_failed: "Could not generate a room code. Try again.",
  room_not_found: "That room code doesn't exist.",
  room_closed: "That room has closed.",
  not_in_room: "You're not in that room.",
  anonymous_not_allowed: "Guests can't do that — sign in with a real account.",
  room_not_live: "Need at least two people in the room to vote on a break.",
  vote_in_progress: "A break vote is already running.",
  not_vote_room: "Pomodoro rooms use an automatic break cadence.",
  empty_room_name: "Give this session a name first.",
  no_active_vote: "That break vote already ended.",
  vote_expired: "That break vote already ended.",
  not_vote_requester: "Only the person who started this vote can cancel it.",
  report_saved: "Thanks — we received your report.",
  not_following_you: "They need to follow you first.",
  follow_not_found: "Follow relationship not found.",
  invalid_target: "Invalid target.",
  forbidden: "You're not allowed to do that.",
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
