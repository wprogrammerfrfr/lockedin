"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { FollowRequests } from "@/components/social/FollowRequests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile, publicAvatarUrl, updateProfile, uploadAvatar } from "@/features/profile/api";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import type { Profile } from "@/features/profile/types";
import { toast } from "sonner";

export default function ProfilePage() {
  const {
    status,
    isAuthenticated,
    user,
    profileLabel,
    email,
    avatarUrl,
    connectedVia,
    refreshProfile,
  } = useAuth();
  const userId = user?.id ?? null;
  const [gateOpen, setGateOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated || !userId) {
      setGateOpen(true);
      setProfile(null);
      setProfileReady(false);
      return;
    }

    const userEmail = user?.email ?? null;
    let cancelled = false;
    setProfileReady(false);
    async function load() {
      try {
        const row = await getProfile(createClient(), userId!);
        if (cancelled) return;
        setProfile(row ? { ...row, email: userEmail } : null);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setProfileReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [status, isAuthenticated, userId, user?.email]);

  const name = profile?.username?.trim() || profileLabel;
  const profileAvatar =
    publicAvatarUrl(createClient(), profile?.avatar_path) ?? avatarUrl;

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Edit your profile, settings, password reset, and log out.
          </p>
        </div>

        {status === "loading" ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : isAuthenticated && user ? (
          <>
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar className="h-14 w-14 rounded-2xl">
                  {profileAvatar ? (
                    <AvatarImage src={profileAvatar} alt="" />
                  ) : null}
                  <AvatarFallback className="rounded-2xl bg-slate-100 text-sm">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold text-slate-900">
                    {name}
                  </p>
                  {connectedVia && (
                    <Badge
                      variant="outline"
                      className="mt-1.5 border-slate-200 text-[10px] font-medium text-slate-500"
                    >
                      Connected via {connectedVia}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="text-base">Your profile</CardTitle>
              </CardHeader>
              <CardContent>
                {!profileReady ? (
                  <p className="text-sm text-slate-400">Loading profile…</p>
                ) : (
                  <ProfileForm
                    key={
                      profile
                        ? `ready-${profile.id}-${profile.username ?? ""}`
                        : `empty-${user.id}`
                    }
                    profile={profile}
                    disabled={false}
                    onSave={async (values) => {
                      const updated = await updateProfile(
                        createClient(),
                        user.id,
                        values,
                      );
                      setProfile({ ...updated, email });
                      await refreshProfile();
                    }}
                  />
                )}
                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-700">
                    Avatar upload
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="mt-2 block w-full text-sm text-slate-500"
                    disabled={!profileReady}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await uploadAvatar(createClient(), user.id, file);
                        const updated = await getProfile(
                          createClient(),
                          user.id,
                        );
                        if (updated) setProfile({ ...updated, email });
                        await refreshProfile();
                        toast.success("Avatar updated");
                      } catch (err) {
                        toast.error(userFacingError(err, "Upload failed"));
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="text-base">Follow requests</CardTitle>
              </CardHeader>
              <CardContent>
                <FollowRequests />
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfileSettings email={email} />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">Guest Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500">
                Solo focus still works. Sign in to edit your profile, sync
                stats, and manage follow requests.
              </p>
              <Button asChild className="rounded-xl">
                <Link href="/login">Log In</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AuthGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        reason="save_sync"
        onContinueAsGuest={() => setGateOpen(false)}
      />
    </ChromePage>
  );
}
