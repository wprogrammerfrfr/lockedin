"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { LockedInLogo } from "@/components/brand/LockedInLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

function friendlyAuthError(message: string, fallback: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (
    m.includes("already registered") ||
    m.includes("user already exists") ||
    m.includes("already been registered")
  ) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email before signing in. Check your inbox.";
  }
  if (m.includes("password") && m.includes("at least")) {
    return "Password must be at least 6 characters.";
  }
  return fallback;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.1-1.5H12z"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
      fill="currentColor"
    >
      <path d="M12 2C6.477 2 2 6.586 2 12.253c0 4.537 2.865 8.379 6.839 9.738.5.094.683-.223.683-.496 0-.245-.009-.895-.014-1.757-2.782.62-3.369-1.38-3.369-1.38-.455-1.188-1.11-1.504-1.11-1.504-.908-.638.069-.625.069-.625 1.004.072 1.532 1.06 1.532 1.06.892 1.57 2.341 1.116 2.91.854.091-.666.35-1.116.636-1.372-2.22-.26-4.555-1.143-4.555-5.087 0-1.123.39-2.043 1.029-2.763-.103-.26-.446-1.302.098-2.714 0 0 .84-.277 2.75 1.055A9.3 9.3 0 0 1 12 6.912a9.3 9.3 0 0 1 2.504.347c1.909-1.332 2.747-1.055 2.747-1.055.546 1.412.203 2.454.1 2.714.64.72 1.028 1.64 1.028 2.763 0 3.954-2.339 4.824-4.566 5.079.359.318.679.945.679 1.904 0 1.373-.012 2.48-.012 2.817 0 .276.18.596.688.494C19.138 20.627 22 16.787 22 12.253 22 6.586 17.523 2 12 2z" />
    </svg>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const confirmed = searchParams.get("confirmed") === "1";

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(
    callbackError && !confirmed
      ? "Authentication failed. Please try again."
      : null,
  );
  const [message, setMessage] = useState<string | null>(
    confirmed
      ? "Email confirmed. Sign in with your password to continue."
      : null,
  );

  const busy = loading !== null;

  function clearFormNoise() {
    setError(null);
    setMessage(null);
  }

  function handleModeChange(value: string) {
    setMode(value as AuthMode);
    setEmail("");
    setPassword("");
    setSignupSent(false);
    setForgotMode(false);
    setAcceptedTerms(false);
    clearFormNoise();
  }

  function backToSignIn() {
    setMode("login");
    setPassword("");
    setSignupSent(false);
    setForgotMode(false);
    clearFormNoise();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    clearFormNoise();
    if (!email.trim()) {
      setError("Enter your email to reset your password.");
      return;
    }
    setLoading("forgot");
    try {
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
        },
      );
      if (resetError) {
        setError(friendlyAuthError(resetError.message, "Could not send reset email."));
        return;
      }
      setMessage("Check your email for a password reset link.");
    } catch (err) {
      setError(
        friendlyAuthError(
          err instanceof Error ? err.message : "",
          "Could not send reset email.",
        ),
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleResendConfirm() {
    clearFormNoise();
    if (!email.trim()) {
      setError("Enter your email to resend confirmation.");
      return;
    }
    setLoading("resend");
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login?confirmed=1")}`,
        },
      });
      if (resendError) {
        setError(
          friendlyAuthError(resendError.message, "Could not resend confirmation."),
        );
        return;
      }
      setMessage("Confirmation email resent. Check your inbox.");
    } catch (err) {
      setError(
        friendlyAuthError(
          err instanceof Error ? err.message : "",
          "Could not resend confirmation.",
        ),
      );
    } finally {
      setLoading(null);
    }
  }

  async function signInWithOAuth(provider: "google" | "github") {
    clearFormNoise();
    if (mode === "signup" && !acceptedTerms) {
      setError("Accept the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(provider);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setError(friendlyAuthError(oauthError.message, "OAuth sign-in failed."));
        setLoading(null);
      }
    } catch (err) {
      setError(
        friendlyAuthError(
          err instanceof Error ? err.message : "",
          "OAuth sign-in failed.",
        ),
      );
      setLoading(null);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearFormNoise();
    if (mode === "signup" && !acceptedTerms) {
      setError("Accept the Terms and Privacy Policy to create an account.");
      return;
    }
    setLoading("email");

    try {
      if (mode === "login") {
        const { error: signInError } = await createClient().auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(
            friendlyAuthError(signInError.message, "Email auth failed."),
          );
          return;
        }
        window.location.assign("/lockin");
        return;
      }

      const { data, error: signUpError } = await createClient().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login?confirmed=1")}`,
        },
      });
      if (signUpError) {
        setError(friendlyAuthError(signUpError.message, "Email auth failed."));
        return;
      }
      if ((data.user?.identities?.length ?? 0) === 0) {
        setError("An account with this email already exists. Sign in instead.");
        return;
      }
      setSignupSent(true);
    } catch (err) {
      setError(
        friendlyAuthError(
          err instanceof Error ? err.message : "",
          "Email auth failed.",
        ),
      );
    } finally {
      setLoading(null);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60";

  const oauthBlock = (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-12 w-full justify-center rounded-xl border-slate-200 text-base font-semibold text-slate-900"
        disabled={busy}
        onClick={() => signInWithOAuth("google")}
      >
        {loading === "google" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
        Continue with Google
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-12 w-full justify-center rounded-xl border-slate-200 text-base font-semibold text-slate-900"
        disabled={busy}
        onClick={() => signInWithOAuth("github")}
      >
        {loading === "github" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GitHubIcon className="h-5 w-5" />
        )}
        Continue with GitHub
      </Button>
    </div>
  );

  const emailForm = (
    <form className="space-y-3" onSubmit={handleEmailSubmit}>
      <label className="block">
        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-slate-400">
          Email
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@school.edu"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-slate-400">
          Password
        </span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="••••••••"
        />
      </label>
      <Button type="submit" className="w-full rounded-xl" disabled={busy}>
        {loading === "email" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {mode === "login" ? "Log In with Email" : "Create Account"}
      </Button>
      {mode === "signup" ? (
        <label className="flex items-start gap-2 text-left text-xs text-slate-500">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to the{" "}
            <a href="/terms" className="underline underline-offset-2">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </span>
        </label>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            className="text-slate-500 underline-offset-2 hover:underline"
            onClick={() => {
              setForgotMode(true);
              clearFormNoise();
            }}
          >
            Forgot password?
          </button>
          <button
            type="button"
            className="text-slate-500 underline-offset-2 hover:underline"
            onClick={() => void handleResendConfirm()}
            disabled={busy}
          >
            Resend confirmation
          </button>
        </div>
      )}
    </form>
  );

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl border-slate-200 bg-white shadow-soft">
        {signupSent ? (
          <>
            <CardHeader className="space-y-2 text-center">
              <LockedInLogo as="p" className="text-sm tracking-tight" />
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Mail className="h-5 w-5" aria-hidden />
              </div>
              <CardTitle className="font-display text-2xl font-bold text-slate-900">
                Check your email
              </CardTitle>
              <p className="text-sm text-slate-500">
                We sent a confirmation link to{" "}
                <strong className="font-semibold text-slate-800">{email}</strong>
                .
              </p>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl border-slate-200"
                onClick={backToSignIn}
              >
                Back to Sign In
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full rounded-xl text-xs"
                disabled={busy}
                onClick={() => void handleResendConfirm()}
              >
                {loading === "resend" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Resend confirmation email"
                )}
              </Button>
              <p className="mt-6 text-center text-xs text-slate-400">
                <a href="/lockin" className="underline-offset-2 hover:underline">
                  Back to Solo
                </a>
              </p>
            </CardContent>
          </>
        ) : forgotMode ? (
          <>
            <CardHeader className="space-y-2 text-center">
              <LockedInLogo as="p" className="text-sm tracking-tight" />
              <CardTitle className="font-display text-2xl font-bold text-slate-900">
                Reset password
              </CardTitle>
              <p className="text-sm text-slate-500">
                We&apos;ll email you a link to choose a new password.
              </p>
            </CardHeader>
            <CardContent>
              {(error || message) && (
                <div
                  className={cn(
                    "mb-4 rounded-xl border px-3 py-2 text-sm",
                    error
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  )}
                  role={error ? "alert" : "status"}
                >
                  {error ?? message}
                </div>
              )}
              <form className="space-y-3" onSubmit={handleForgotPassword}>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    Email
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    disabled={busy}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@school.edu"
                  />
                </label>
                <Button type="submit" className="w-full rounded-xl" disabled={busy}>
                  {loading === "forgot" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                className="mt-3 w-full rounded-xl"
                onClick={() => {
                  setForgotMode(false);
                  clearFormNoise();
                }}
              >
                Back to Sign In
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-2 text-center">
              <LockedInLogo as="p" className="text-sm tracking-tight" />
              <CardTitle className="font-display text-2xl font-bold text-slate-900">
                {mode === "login" ? "Log In" : "Sign Up"}
              </CardTitle>
              <p className="text-sm text-slate-500">
                Sync sessions, join Rooms, and keep your streak cloud-backed.
              </p>
            </CardHeader>
            <CardContent>
              {(error || message) && (
                <div
                  className={cn(
                    "mb-4 rounded-xl border px-3 py-2 text-sm",
                    error
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  )}
                  role={error ? "alert" : "status"}
                >
                  {error ?? message}
                </div>
              )}

              <Tabs value={mode} onValueChange={handleModeChange}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-slate-500">
                  <TabsTrigger
                    value="login"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-soft"
                  >
                    Log In
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-soft"
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-5 space-y-5">
                  {oauthBlock}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-[0.14em]">
                      <span className="bg-white px-3 text-slate-400">
                        or email
                      </span>
                    </div>
                  </div>
                  {emailForm}
                </TabsContent>

                <TabsContent value="signup" className="mt-5 space-y-5">
                  {oauthBlock}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-[0.14em]">
                      <span className="bg-white px-3 text-slate-400">
                        or email
                      </span>
                    </div>
                  </div>
                  {emailForm}
                </TabsContent>
              </Tabs>

              <p className="mt-6 text-center text-xs text-slate-400">
                <a href="/lockin" className="underline-offset-2 hover:underline">
                  Back to Solo
                </a>
                {" · "}
                <a href="/privacy" className="underline-offset-2 hover:underline">
                  Privacy
                </a>
                {" · "}
                <a href="/terms" className="underline-offset-2 hover:underline">
                  Terms
                </a>
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
