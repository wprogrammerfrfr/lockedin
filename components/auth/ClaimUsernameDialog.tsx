"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/features/profile/api";
import {
  isReservedUsername,
  isValidUsername,
  normalizeUsername,
} from "@/lib/profile/username";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

export function ClaimUsernameDialog() {
  const { needsUsernameClaim, user, refreshProfile, profile } = useAuth();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = Boolean(needsUsernameClaim && user && !user.is_anonymous);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const trimmed = normalizeUsername(username);
    if (!isValidUsername(trimmed)) {
      setError(
        isReservedUsername(trimmed)
          ? "That username is reserved."
          : "Username must be 3–20 characters: letters, numbers, and underscores only.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile(createClient(), user.id, { username: trimmed });
      await refreshProfile();
      toast.success(`You're @${trimmed}`);
    } catch (err) {
      setError(userFacingError(err, "Could not claim username."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-md rounded-2xl border-border bg-card p-6 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Choose your username
          </DialogTitle>
          <DialogDescription>
            Pick a public handle before exploring friends and rooms.
            {profile?.username ? (
              <>
                {" "}
                Your temporary handle is @{profile.username}.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <form className="mt-2 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <Label htmlFor="claim-username">Username</Label>
            <Input
              id="claim-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]{3,20}"
              placeholder="your_handle"
              autoFocus
              className="rounded-xl"
            />
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          <Button
            type="submit"
            disabled={busy || !username.trim()}
            className="w-full rounded-xl"
          >
            {busy ? "Saving…" : "Claim username"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
