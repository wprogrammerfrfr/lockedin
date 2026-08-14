"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { publicAvatarUrl } from "@/features/profile/api";
import { createClient } from "@/lib/supabase/client";

export type AuthStatus = "loading" | "guest" | "authenticated";
export type ConnectedVia = "GitHub" | "Google" | "Email" | null;

export type AuthProfile = {
  username: string | null;
  avatar_path: string | null;
  timezone: string | null;
};

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  profile: AuthProfile | null;
  /** Indicator label: username → email local-part → "User". */
  profileLabel: string;
  email: string | null;
  avatarUrl: string | null;
  connectedVia: ConnectedVia;
  refreshProfile: () => Promise<void>;
};

function isRealUser(user: User | null | undefined): user is User {
  return Boolean(user && !user.is_anonymous);
}

export function connectedViaFromUser(user: User | null): ConnectedVia {
  if (!user) return null;
  const identities = user.identities ?? [];
  const providers = new Set(
    [
      typeof user.app_metadata?.provider === "string"
        ? user.app_metadata.provider
        : null,
      ...identities.map((i) => i.provider),
    ].filter((p): p is string => Boolean(p)),
  );
  if (providers.has("github")) return "GitHub";
  if (providers.has("google")) return "Google";
  if (providers.has("email") || user.email) return "Email";
  return null;
}

export function avatarUrlFromUser(user: User | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  if (typeof meta.avatar_url === "string" && meta.avatar_url) {
    return meta.avatar_url;
  }
  if (typeof meta.picture === "string" && meta.picture) {
    return meta.picture;
  }
  return null;
}

function emailLocalPart(user: User | null): string | null {
  const email = user?.email;
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  return local || null;
}

function buildProfileLabel(
  profile: AuthProfile | null,
  user: User | null,
): string {
  const username = profile?.username?.trim();
  if (username) return username;
  return emailLocalPart(user) || "User";
}

function resolveAvatarUrl(
  profile: AuthProfile | null,
  user: User | null,
): string | null {
  const fromPath = publicAvatarUrl(createClient(), profile?.avatar_path);
  if (fromPath) return fromPath;
  return avatarUrlFromUser(user);
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_EVENTS = new Set<AuthChangeEvent>([
  "SIGNED_IN",
  "USER_UPDATED",
  "PASSWORD_RECOVERY",
  "SIGNED_OUT",
]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const profileUserIdRef = useRef<string | null>(null);

  const applyUser = useCallback(
    (next: User | null, nextSession: Session | null) => {
      const real = isRealUser(next) ? next : null;
      setUser(real);
      setSession(real ? nextSession : null);
      setStatus(real ? "authenticated" : "guest");
      if (!real) {
        setProfile(null);
        profileUserIdRef.current = null;
      }
    },
    [],
  );

  const loadProfile = useCallback(async (userId: string) => {
    profileUserIdRef.current = userId;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_path, timezone")
        .eq("id", userId)
        .maybeSingle();
      if (profileUserIdRef.current !== userId) return;
      if (error || !data) {
        setProfile(null);
        return;
      }
      setProfile({
        username: data.username ?? null,
        avatar_path: data.avatar_path ?? null,
        timezone: data.timezone ?? null,
      });
    } catch {
      if (profileUserIdRef.current !== userId) return;
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      applyUser(nextSession?.user ?? null, nextSession);
      if (REFRESH_EVENTS.has(event)) {
        router.refresh();
      }
    });

    const onFocus = () => {
      void supabase.auth
        .getUser()
        .then(({ data }) => {
          if (cancelled) return;
          return supabase.auth.getSession().then(({ data: sess }) => {
            if (cancelled) return;
            applyUser(data.user ?? null, sess.session ?? null);
          });
        })
        .catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [applyUser, router]);

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) {
      setProfile(null);
      profileUserIdRef.current = null;
      return;
    }
    void loadProfile(user.id);
  }, [status, user?.id, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      session,
      isAuthenticated: status === "authenticated",
      profile,
      profileLabel: buildProfileLabel(profile, user),
      email: user?.email ?? null,
      avatarUrl: resolveAvatarUrl(profile, user),
      connectedVia: connectedViaFromUser(user),
      refreshProfile,
    }),
    [session, status, user, profile, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
