"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProfileForm } from "@/components/profile/ProfileForm";
import {
  ProfileHeroAvatar,
  ProfileSocialStats,
} from "@/components/profile/ProfileHero";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getProfile,
  publicAvatarUrl,
  updateProfile,
  uploadAvatar,
} from "@/features/profile/api";
import { profileSocialCounts } from "@/features/social/api";
import type { ProfileSocialCounts as Counts } from "@/features/social/types";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import type { Profile } from "@/features/profile/types";
import { normalizeLocale, useTranslation } from "@/lib/i18n/LocaleProvider";
import { toast } from "sonner";

export default function ProfilePage() {
  const { t, setLocale } = useTranslation();
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
  const [counts, setCounts] = useState<Counts>({
    friends: 0,
    followers: 0,
    following: 0,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        const supabase = createClient();
        const [row, social] = await Promise.all([
          getProfile(supabase, userId!),
          profileSocialCounts(supabase, userId!),
        ]);
        if (cancelled) return;
        setProfile(row ? { ...row, email: userEmail } : null);
        setCounts(social);
        if (row?.locale) setLocale(normalizeLocale(row.locale));
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
  }, [status, isAuthenticated, userId, user?.email, setLocale]);

  const name = profile?.username?.trim() || profileLabel;
  const profileAvatar = publicAvatarUrl(profile?.avatar_path) ?? avatarUrl;

  async function onAvatarFile(file: File) {
    if (!user) return;
    try {
      await uploadAvatar(createClient(), user.id, file);
      const updated = await getProfile(createClient(), user.id);
      if (updated) setProfile({ ...updated, email });
      await refreshProfile();
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(userFacingError(err, "Upload failed"));
    }
  }

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t("profile.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
          </div>
          {isAuthenticated && user ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 gap-2 rounded-xl px-4"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-5 w-5 text-foreground" />
              {t("profile.settings")}
            </Button>
          ) : null}
        </div>

        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>
        ) : isAuthenticated && user ? (
          <>
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
                <ProfileHeroAvatar
                  name={name}
                  avatarUrl={profileAvatar}
                  editable={profileReady}
                  onPickFile={(file) => void onAvatarFile(file)}
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="font-display text-xl font-bold text-foreground">
                      {name}
                    </p>
                    {profile?.username ? (
                      <p className="text-sm text-muted-foreground">
                        @{profile.username}
                      </p>
                    ) : null}
                    {profile?.bio ? (
                      <p className="mt-2 text-sm text-muted-foreground">{profile.bio}</p>
                    ) : null}
                    {connectedVia ? (
                      <Badge
                        variant="outline"
                        className="mt-2 border-border text-[10px] font-medium text-muted-foreground"
                      >
                        Connected via {connectedVia}
                      </Badge>
                    ) : null}
                  </div>
                  <ProfileSocialStats counts={counts} userId={user.id} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">{t("profile.editProfile")}</CardTitle>
              </CardHeader>
              <CardContent>
                {!profileReady ? (
                  <p className="text-sm text-muted-foreground">{t("profile.loadingProfile")}</p>
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
                      try {
                        setCounts(
                          await profileSocialCounts(createClient(), user.id),
                        );
                      } catch {
                        /* keep counts */
                      }
                    }}
                  />
                )}
              </CardContent>
            </Card>

            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogContent className="max-h-[min(90vh,40rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border-border bg-card p-6">
                <DialogHeader>
                  <DialogTitle>{t("profile.settings")}</DialogTitle>
                  <DialogDescription>{t("profile.settingsDesc")}</DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  <ProfileSettings
                    email={email}
                    userId={user.id}
                    initialLocale={profile?.locale}
                    initialBreakTimerMinutes={profile?.break_timer_minutes}
                    initialTheme={profile?.theme}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t("profile.guestSession")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("profile.guestDesc")}</p>
              <Button asChild className="rounded-xl">
                <Link href="/login">{t("auth.logIn")}</Link>
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
