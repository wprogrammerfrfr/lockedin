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
  const { status, isAuthenticated, profile } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) setGateOpen(true);
  }, [status, isAuthenticated]);

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {t("nav.explore")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("explore.subtitle")}</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-700">
            {t("explore.search")}
          </h2>
          <ProfileSearch />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-700">
            {t("explore.followingFeed")}
          </h2>
          {status === "loading" ? (
            <p className="text-sm text-slate-400">{t("common.loading")}</p>
          ) : isAuthenticated ? (
            <FeedList
              emptyExtra={
                <ExploreSuggestions profileUsername={profile?.username} />
              }
            />
          ) : (
            <p className="text-sm text-slate-400">{t("explore.signInFeed")}</p>
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
