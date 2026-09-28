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
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { shouldPromptUsernameClaim } from "@/lib/profile/username";
import { mergeLocalSessionsIntoUser } from "@/lib/auth/merge";
import { toast } from "sonner";
import { userFacingError } from "@/lib/supabase/errors";

export type AuthStatus = "loading" | "guest" | "authenticated";
export type ConnectedVia = "GitHub" | "Google" | "Email" | null;

export type AuthProfile = {
  username: string | null;
  avatar_path: string | null;
  timezone: string | null;
  username_claimed_at: string | null;
};

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  /** True when the session is a Supabase anonymous guest (can join rooms, not create). */
  isAnonymous: boolean;
  profile: AuthProfile | null;
  /** Indicator label: username → email local-part → "User". */
  profileLabel: string;
  email: string | null;
  avatarUrl: string | null;
  connectedVia: ConnectedVia;
  /** True once the profile fetch for the current user has settled (success or failure). */
  profileReady: boolean;
  needsUsernameClaim: boolean;
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
  const fromPath = publicAvatarUrl(profile?.avatar_path);
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
  const [profileReady, setProfileReady] = useState(false);
  const profileUserIdRef = useRef<string | null>(null);

  const applyUser = useCallback(
    (next: User | null, nextSession: Session | null) => {
      if (next?.is_anonymous) {
        setUser(next);
        setSession(nextSession);
        setStatus("guest");
        setProfile(null);
        setProfileReady(true);
        profileUserIdRef.current = null;
        return;
      }
      const real = isRealUser(next) ? next : null;
      setUser(real);
      setSession(real ? nextSession : null);
      setStatus(real ? "authenticated" : "guest");
      if (!real) {
        setProfile(null);
        setProfileReady(true);
        profileUserIdRef.current = null;
        return;
      }
      // Only mark profile unready when the authenticated user changes.
      // Focus/visibility re-applies the same user and must not flash the claim dialog.
      if (profileUserIdRef.current !== real.id) {
        setProfileReady(false);
      }
    },
    [],
  );

  const loadProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) {
      setProfileReady(true);
      return;
    }
    profileUserIdRef.current = userId;
    setProfileReady(false);
    try {
      const supabase = createClient();
      let data: {
        username: string | null;
        avatar_path: string | null;
        timezone: string | null;
        username_claimed_at?: string | null;
      } | null = null;

      const first = await supabase
        .from("profiles")
        .select("username, avatar_path, timezone, username_claimed_at")
        .eq("id", userId)
        .maybeSingle();

      if (first.error && /username_claimed_at/i.test(first.error.message)) {
        const second = await supabase
          .from("profiles")
          .select("username, avatar_path, timezone")
          .eq("id", userId)
          .maybeSingle();
        if (profileUserIdRef.current !== userId) return;
        if (second.error || !second.data) {
          setProfile(null);
          setProfileReady(true);
          return;
        }
        data = second.data;
      } else {
        if (profileUserIdRef.current !== userId) return;
        if (first.error || !first.data) {
          setProfile(null);
          setProfileReady(true);
          return;
        }
        data = first.data;
      }

      if (!data.avatar_path) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        const metadataAvatar =
          authUser?.id === userId ? avatarUrlFromUser(authUser) : null;
        if (metadataAvatar) {
          const { error: avatarError } = await supabase
            .from("profiles")
            .update({ avatar_path: metadataAvatar })
            .eq("id", userId);
          if (!avatarError) data = { ...data, avatar_path: metadataAvatar };
        }
      }

      const claimed =
        data.username_claimed_at ??
        // Pre-migration fallback: treat non-provisional usernames as claimed
        (data.username && !/^u_[a-f0-9]{8,}$/i.test(data.username)
          ? "legacy"
          : null);

      if (profileUserIdRef.current !== userId) return;
      setProfile({
        username: data.username ?? null,
        avatar_path: data.avatar_path ?? null,
        timezone: data.timezone ?? null,
        username_claimed_at: claimed,
      });
      setProfileReady(true);
    } catch {
      if (profileUserIdRef.current !== userId) return;
      setProfile(null);
      setProfileReady(true);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus("guest");
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      applyUser(nextSession?.user ?? null, nextSession);
      if (event === "SIGNED_OUT") {
        void fetch("/api/github/token", { method: "DELETE" }).catch(() => {});
      }
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
    if (!user?.id) {
      setProfile(null);
      setProfileReady(true);
      profileUserIdRef.current = null;
      return;
    }
    if (user.is_anonymous) {
      setProfile(null);
      setProfileReady(true);
      profileUserIdRef.current = null;
      return;
    }
    void loadProfile(user.id);
  }, [status, user?.id, user?.is_anonymous, loadProfile]);

  // Merge guest localStorage drafts once on real sign-in (any route).
  useEffect(() => {
    if (status !== "authenticated" || !user?.id || user.is_anonymous) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await mergeLocalSessionsIntoUser(createClient());
        if (cancelled) return;
        if (!result.ok && result.error) {
          toast.error(
            userFacingError(result.error, "Could not sync guest sessions"),
          );
        } else if (result.merged > 0) {
          toast.success(
            result.merged === 1
              ? "Synced 1 guest session"
              : `Synced ${result.merged} guest sessions`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(userFacingError(err, "Could not sync guest sessions"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      session,
      isAuthenticated: status === "authenticated",
      isAnonymous: Boolean(user?.is_anonymous),
      profile,
      profileReady,
      profileLabel: buildProfileLabel(profile, user),
      email: user?.email ?? null,
      avatarUrl: resolveAvatarUrl(profile, user),
      connectedVia: connectedViaFromUser(user),
      needsUsernameClaim: shouldPromptUsernameClaim({
        profileReady,
        isAuthenticated: status === "authenticated",
        isAnonymous: Boolean(user?.is_anonymous),
        username: profile?.username,
        claimedAt: profile?.username_claimed_at,
      }),
      refreshProfile,
    }),
    [session, status, user, profile, profileReady, refreshProfile],
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
