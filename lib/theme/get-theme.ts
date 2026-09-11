import { cookies } from "next/headers";

import { THEME_COOKIE_KEY, normalizeTheme, type ThemePreference } from "./theme";

export { THEME_COOKIE_KEY, THEME_STORAGE_KEY, normalizeTheme } from "./theme";
export type { ThemePreference, ResolvedTheme } from "./theme";
export { writeThemeCookie, readThemeCookie } from "./theme-cookie";

export async function getServerTheme(): Promise<ThemePreference> {
  const jar = await cookies();
  return normalizeTheme(jar.get(THEME_COOKIE_KEY)?.value);
}
