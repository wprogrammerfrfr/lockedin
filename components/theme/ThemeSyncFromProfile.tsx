"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { readThemeCookie } from "@/lib/theme/theme-cookie";
import {
  THEME_STORAGE_KEY,
  normalizeTheme,
  parseStoredTheme,
} from "@/lib/theme/theme";

function readLocalThemePreference() {
  const fromCookie = readThemeCookie();
  if (fromCookie) return fromCookie;
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * After login, hydrate appearance from profiles.theme only when the device
 * has no cookie/local preference yet (e.g. new browser). Never clobber an
 * existing local choice with a stale DB value.
 */
export function ThemeSyncFromProfile() {
  const { status, user } = useAuth();
  const { setTheme } = useTheme();
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) return;
    if (syncedFor.current === user.id) return;
    if (!isSupabaseConfigured()) return;

    // Local preference wins — profile is only a fallback for empty devices.
    if (readLocalThemePreference()) {
      syncedFor.current = user.id;
      return;
    }

    let cancelled = false;
    syncedFor.current = user.id;

    void (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("profiles")
          .select("theme")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || error || !data?.theme) return;
        // Re-check in case the user set a preference while the fetch ran.
        if (readLocalThemePreference()) return;
        setTheme(normalizeTheme(data.theme));
      } catch {
        /* column may not exist yet — keep cookie/local preference */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, user?.id, setTheme]);

  return null;
}
