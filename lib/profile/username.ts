export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/** Handles that look like auto-generated provisional usernames. */
export const PROVISIONAL_USERNAME_RE = /^(u_[a-f0-9]{8,}|user_[a-f0-9]{6,})$/i;

const RESERVED = new Set([
  "admin",
  "administrator",
  "support",
  "help",
  "lockedin",
  "locked_in",
  "lockin",
  "explore",
  "login",
  "logout",
  "signup",
  "signin",
  "signout",
  "auth",
  "api",
  "about",
  "privacy",
  "terms",
  "settings",
  "profile",
  "profiles",
  "rooms",
  "room",
  "dashboard",
  "dev",
  "developer",
  "null",
  "undefined",
  "system",
  "mod",
  "moderator",
  "official",
]);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedUsername(value: string): boolean {
  return RESERVED.has(normalizeUsername(value));
}

export function isProvisionalUsername(value: string | null | undefined): boolean {
  if (!value) return true;
  return PROVISIONAL_USERNAME_RE.test(normalizeUsername(value));
}

export function isValidUsername(value: string): boolean {
  const n = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(n)) return false;
  if (isReservedUsername(n)) return false;
  if (isProvisionalUsername(n)) return false;
  return true;
}

export function needsUsernameClaim(
  username: string | null | undefined,
  claimedAt: string | null | undefined,
): boolean {
  if (claimedAt) return false;
  return isProvisionalUsername(username) || !username;
}

/**
 * Whether the claim dialog should open.
 * Never true until the profile fetch for this user has finished (avoids PWA flash).
 */
export function shouldPromptUsernameClaim(opts: {
  profileReady: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  username: string | null | undefined;
  claimedAt: string | null | undefined;
}): boolean {
  if (!opts.profileReady) return false;
  if (!opts.isAuthenticated || opts.isAnonymous) return false;
  return needsUsernameClaim(opts.username, opts.claimedAt);
}
