"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const urlError = params.get("error");
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const hasUrlAuth = Boolean(code) || Boolean(tokenHash);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? "Recovery link failed. Request a new one." : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Legacy emails that land on /auth/reset?code=… → exchange via callback.
  useEffect(() => {
    if (urlError) return;
    if (!code && !tokenHash) return;
    const qs = new URLSearchParams({ next: "/auth/reset" });
    if (code) qs.set("code", code);
    if (tokenHash) {
      qs.set("token_hash", tokenHash);
      if (type) qs.set("type", type);
      else qs.set("type", "recovery");
    }
    window.location.replace(`/auth/callback?${qs.toString()}`);
  }, [urlError, code, tokenHash, type]);

  useEffect(() => {
    if (urlError) {
      setReady(true);
      setSessionOk(false);
      return;
    }
    // Wait for redirect when legacy code/hash is present.
    if (hasUrlAuth) return;

    const supabase = createClient();
    let cancelled = false;

    const markReady = (ok: boolean) => {
      if (cancelled) return;
      if (ok) {
        setSessionOk(true);
        setReady(true);
        setError(null);
        return;
      }
      // Only lock failure after grace; success can still arrive later.
      setReady(true);
      setSessionOk((prev) => {
        if (prev) return prev;
        setError("Recovery link failed. Request a new one.");
        return false;
      });
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session?.user) markReady(true);
      })
      .catch(() => undefined);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session?.user &&
        (event === "PASSWORD_RECOVERY" ||
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED")
      ) {
        markReady(true);
      }
    });

    const timer = window.setTimeout(() => {
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          markReady(Boolean(data.session?.user));
        })
        .catch(() => {
          markReady(false);
        });
    }, 1500);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [urlError, hasUrlAuth]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!sessionOk) {
      setError("Recovery link failed. Request a new one.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(userFacingError(updateError, "Could not update password."));
        return;
      }
      setMessage("Password updated. Redirecting…");
      window.setTimeout(() => router.push("/lockin"), 1200);
    } catch (err) {
      setError(userFacingError(err, "Update failed."));
    } finally {
      setBusy(false);
    }
  }

  if (hasUrlAuth && !urlError) {
    return (
      <Card className="w-full max-w-md rounded-2xl border-border bg-card shadow-soft">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Completing recovery…
        </CardContent>
      </Card>
    );
  }

  if (!ready) {
    return (
      <Card className="w-full max-w-md rounded-2xl border-border bg-card shadow-soft">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Verifying recovery link…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border-border bg-card shadow-soft">
      <CardHeader className="text-center">
        <CardTitle className="font-display text-2xl">Set new password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!sessionOk || busy}
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm</Label>
            <Input
              id="confirm"
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!sessionOk || busy}
            />
          </div>
          {(error || message) && (
            <p
              className={
                error
                  ? "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                  : "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              }
            >
              {error ?? message}
            </p>
          )}
          <Button
            className="w-full rounded-xl"
            disabled={!sessionOk || busy}
          >
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AuthResetPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background px-4 py-10">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading recovery…</p>
        }
      >
        <ResetForm />
      </Suspense>
    </div>
  );
}
