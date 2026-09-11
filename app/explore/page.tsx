"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { FeedList } from "@/components/feed/FeedList";
import { ExploreSuggestions } from "@/components/social/ExploreSuggestions";
import { ProfileSearch } from "@/components/social/ProfileSearch";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export default function ExplorePage() {
  const { t } = useTranslation();
  const { status, isAuthenticated, profile, needsUsernameClaim } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) setGateOpen(true);
  }, [status, isAuthenticated]);

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t("nav.explore")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("explore.subtitle")}</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-foreground">
            {t("explore.search")}
          </h2>
          <ProfileSearch />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-foreground">
            {t("explore.followingFeed")}
          </h2>
          {status === "loading" ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : isAuthenticated ? (
            <FeedList
              emptyExtra={
                <ExploreSuggestions
                  profileUsername={profile?.username}
                  usernameClaimed={!needsUsernameClaim}
                />
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("explore.signInFeed")}</p>
          )}
        </section>
      </div>

      <AuthGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        reason="follow"
        onContinueAsGuest={() => setGateOpen(false)}
      />
    </ChromePage>
  );
}
