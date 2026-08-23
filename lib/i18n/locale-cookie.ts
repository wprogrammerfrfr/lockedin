import type { Locale } from "./locale";

/** Same key as localStorage (`lockedin.locale`) so SSR and client stay in sync. */
export const LOCALE_COOKIE_KEY = "lockedin.locale";

/** Client-only: persist locale for the next SSR pass. */
export function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_KEY}=${locale};path=/;max-age=${maxAge};samesite=lax`;
}

export function readLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE_KEY}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
