"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/features/profile/types";
import {
  isValidUsername,
  normalizeUsername,
} from "@/lib/profile/username";
import { userFacingError } from "@/lib/supabase/errors";

type ProfileFormProps = {
  profile: Profile | null;
  disabled?: boolean;
  onSave?: (values: {
    bio: string;
    timezone: string;
    username?: string;
  }) => Promise<void> | void;
};

export function ProfileForm({ profile, disabled, onSave }: ProfileFormProps) {
  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"];
    }
  }, []);

  const [bio, setBio] = useState(profile?.bio ?? "");
  const [timezone, setTimezone] = useState(
    profile?.timezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      "UTC",
  );
  const [username, setUsername] = useState(profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSave) {
      setMessage("Profile save unlocks with cloud sync.");
      return;
    }
    const trimmedUsername = normalizeUsername(username);
    if (trimmedUsername && !isValidUsername(trimmedUsername)) {
      setMessage(
        "Username must be 3–20 characters: letters, numbers, and underscores only.",
      );
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await onSave({
        bio: bio.trim(),
        timezone,
        username: trimmedUsername || undefined,
      });
      setMessage("Saved.");
    } catch (err) {
      console.error("updateProfile failed", err);
      setMessage(userFacingError(err, "Save failed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={disabled}
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          placeholder="your_handle"
        />
      </div>
      <div>
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          disabled={disabled}
          maxLength={280}
          rows={3}
          className="w-full cursor-text rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        />
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          disabled={disabled}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Avatar</Label>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
          Upload unlocks with Phase 2 storage (jpeg/png/webp, 2MB).
        </div>
      </div>
      <Button type="submit" disabled={disabled || saving} className="rounded-xl">
        {saving ? "Saving…" : "Save profile"}
      </Button>
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </form>
  );
}
