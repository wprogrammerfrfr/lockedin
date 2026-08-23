"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import en from "./locales/en.json";
import ko from "./locales/ko.json";
import tr from "./locales/tr.json";
import { readLocaleCookie, writeLocaleCookie } from "./locale-cookie";
import { normalizeLocale, type Locale } from "./locale";

export type { Locale };
export { normalizeLocale };

const LOCALE_STORAGE_KEY = "lockedin.locale";

const MESSAGES: Record<Locale, Record<string, string>> = { en, tr, ko };

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale | null;
}) {
  // Server and client must agree on the first paint — use cookie-backed
  // initialLocale from the root layout, never localStorage here.
  const [locale, setLocaleState] = useState<Locale>(() =>
    normalizeLocale(initialLocale),
  );

  useEffect(() => {
    if (initialLocale) setLocaleState(normalizeLocale(initialLocale));
  }, [initialLocale]);

  // Migrate users who only have localStorage (no cookie yet).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (!stored) return;
      if (readLocaleCookie()) return;
      const next = normalizeLocale(stored);
      setLocaleState(next);
      writeLocaleCookie(next);
    } catch {
      /* private mode / blocked storage */
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      writeLocaleCookie(next);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const bucket = MESSAGES[locale] ?? MESSAGES.en;
      const fallback = MESSAGES.en[key];
      const raw = bucket[key] ?? fallback ?? key;
      return interpolate(raw, params);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within LocaleProvider");
  }
  return ctx;
}

export function useOptionalTranslation() {
  return useContext(LocaleContext);
}

export { LOCALE_STORAGE_KEY };
