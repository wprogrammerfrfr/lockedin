import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GH_COOKIE = "lockedin_gh";
const MAX_AGE_S = 60 * 60 * 24 * 30;

type Payload = { uid: string; token: string };

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  };
}

function parse(raw: string | undefined): Payload | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Payload>;
    return typeof v.uid === "string" && typeof v.token === "string"
      ? { uid: v.uid, token: v.token }
      : null;
  } catch {
    return null;
  }
}

export function setGithubCookie(res: NextResponse, uid: string, token: string) {
  res.cookies.set(GH_COOKIE, JSON.stringify({ uid, token }), cookieOptions());
}

export function clearGithubCookie(res: NextResponse) {
  res.cookies.set(GH_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

/**
 * Session `provider_token` is only present right after the GitHub OAuth
 * exchange; the cookie keeps it past Supabase session refreshes.
 * The cookie is only honored for the user it was issued to.
 */
export async function getGithubToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const fromSession =
    (session as { provider_token?: string | null } | null)?.provider_token ??
    null;
  if (fromSession) return fromSession;

  const store = await cookies();
  const payload = parse(store.get(GH_COOKIE)?.value);
  return payload && payload.uid === userId ? payload.token : null;
}
