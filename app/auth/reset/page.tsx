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
  const hasUrlAuth =
    Boolean(params.get("code")) || Boolean(params.get("token_hash"));

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? "Recovery link failed. Request a new one." : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (urlError) {
      setReady(true);
      setSessionOk(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;
    let settled = false;

    const markReady = (ok: boolean) => {
      if (cancelled || settled) return;
      settled = true;
      setSessionOk(ok);
      setReady(true);
      if (!ok) {
        setError("Recovery link failed. Request a new one.");
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        markReady(true);
      }
    }).catch(() => undefined);

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

    // In-flight emails that still hit /auth/reset?code= rely on detectSessionInUrl.
    const graceMs = hasUrlAuth ? 4000 : 1500;
    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        markReady(Boolean(data.session?.user));
      }).catch(() => {
        markReady(false);
      });
    }, graceMs);

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
      window.setTimeout(() => router.push("/"), 1200);
    } catch (err) {
      setError(userFacingError(err, "Update failed."));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <Card className="w-full max-w-md rounded-2xl border-slate-200 bg-white shadow-soft">
        <CardContent className="py-10 text-center text-sm text-slate-500">
          Verifying recovery link…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border-slate-200 bg-white shadow-soft">
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
                error ? "text-sm text-red-600" : "text-sm text-emerald-600"
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
    <div className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-4 py-10">
      <Suspense
        fallback={
          <p className="text-sm text-slate-500">Loading recovery…</p>
        }
      >
        <ResetForm />
      </Suspense>
    </div>
  );
}
