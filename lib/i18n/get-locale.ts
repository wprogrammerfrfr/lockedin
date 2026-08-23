import { cookies } from "next/headers";

import { LOCALE_COOKIE_KEY } from "./locale-cookie";
import { normalizeLocale, type Locale } from "./locale";

export { LOCALE_COOKIE_KEY, writeLocaleCookie, readLocaleCookie } from "./locale-cookie";
export type { Locale } from "./locale";

export async function getServerLocale(): Promise<Locale> {
  const jar = await cookies();
  return normalizeLocale(jar.get(LOCALE_COOKIE_KEY)?.value);
}
