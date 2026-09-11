export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "lockedin.theme";
export const THEME_COOKIE_KEY = "lockedin.theme";
export const DEFAULT_THEME: ThemePreference = "light";

export function normalizeTheme(value: unknown): ThemePreference {
  if (value === "dark" || value === "system" || value === "light") return value;
  return DEFAULT_THEME;
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark?: boolean,
): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if (typeof systemDark === "boolean") return systemDark ? "dark" : "light";
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  // SSR fallback when preference is "system" and no media query is available.
  return "light";
}

export function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/** Welcome + login stay light regardless of stored preference. */
export function isForceLightPath(pathname: string | null | undefined): boolean {
  return pathname === "/" || pathname === "/login";
}

/** Parse a stored preference only when explicitly light/dark/system. */
export function parseStoredTheme(value: unknown): ThemePreference | null {
  if (value === "dark" || value === "system" || value === "light") return value;
  return null;
}
