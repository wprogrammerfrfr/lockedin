import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/lockin";
}

function failureRedirect(origin: string, next: string, _type: string | null) {
  if (next === "/auth/reset") {
    return NextResponse.redirect(`${origin}/auth/reset?error=1`);
  }
  const params = new URLSearchParams({ error: "auth_callback_failed" });
  return NextResponse.redirect(`${origin}/login?${params.toString()}`);
}

function successRedirect(origin: string, next: string, typeParam: string | null) {
  // Email confirmation landing: send users to login with a friendly banner.
  if (
    typeParam === "signup" ||
    typeParam === "email" ||
    next.startsWith("/login")
  ) {
    const url = new URL(`${origin}${next.startsWith("/login") ? next : "/login"}`);
    if (!url.searchParams.has("confirmed")) {
      url.searchParams.set("confirmed", "1");
    }
    // Avoid forcing confirmed on intentional login-only next without email verify
    if (typeParam === "signup" || typeParam === "email" || next.includes("confirmed")) {
      return NextResponse.redirect(url.toString());
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return failureRedirect(origin, next, typeParam);
  }

  const redirectResponse = successRedirect(origin, next, typeParam);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          redirectResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectResponse;
    return failureRedirect(origin, next, typeParam);
  }

  if (tokenHash && typeParam && OTP_TYPES.has(typeParam as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: typeParam as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) return redirectResponse;
    return failureRedirect(origin, next, typeParam);
  }

  return failureRedirect(origin, next, typeParam);
}
