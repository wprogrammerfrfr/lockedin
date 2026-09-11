import type { ThemePreference } from "./theme";
import { THEME_COOKIE_KEY, normalizeTheme } from "./theme";

/** Client-only: persist theme for the next SSR / FOUC script pass. */
export function writeThemeCookie(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE_KEY}=${theme};path=/;max-age=${maxAge};samesite=lax`;
}

export function readThemeCookie(): ThemePreference | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE_KEY}=([^;]*)`),
  );
  if (!match) return null;
  return normalizeTheme(decodeURIComponent(match[1]));
}
