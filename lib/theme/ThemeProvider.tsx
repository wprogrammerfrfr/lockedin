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
import { usePathname } from "next/navigation";

import { readThemeCookie, writeThemeCookie } from "./theme-cookie";
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  isForceLightPath,
  normalizeTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: ThemePreference | null;
}) {
  const pathname = usePathname();
  const forceLight = isForceLightPath(pathname);

  const [theme, setThemeState] = useState<ThemePreference>(() =>
    normalizeTheme(initialTheme),
  );
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (initialTheme) setThemeState(normalizeTheme(initialTheme));
  }, [initialTheme]);

  // Migrate users who only have localStorage (no cookie yet).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) return;
      if (readThemeCookie()) return;
      const next = normalizeTheme(stored);
      setThemeState(next);
      writeThemeCookie(next);
    } catch {
      /* private mode / blocked storage */
    }
  }, []);

  useEffect(() => {
    setSystemDark(readSystemDark());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = forceLight
    ? "light"
    : resolveTheme(theme, systemDark);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      const normalized = normalizeTheme(next);
      setThemeState(normalized);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, normalized);
        } catch {
          /* ignore */
        }
        writeThemeCookie(normalized);
        // Welcome `/` and `/login` stay light; don't apply preference to <html> there.
        if (!isForceLightPath(window.location.pathname)) {
          applyResolvedTheme(resolveTheme(normalized, readSystemDark()));
        }
      }
    },
    [],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
