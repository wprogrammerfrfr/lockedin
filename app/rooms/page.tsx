"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { JoinCreateBar } from "@/components/rooms/JoinCreateBar";
import { WeeklyLeaderboard } from "@/components/social/WeeklyLeaderboard";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

export default function RoomsPage() {
  const { t } = useTranslation();
  const { status, isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;
  const [gateOpen, setGateOpen] = useState(false);
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    if (status === "loading" || !isAuthenticated || !userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data: profile } = await createClient()
          .from("profiles")
          .select("timezone")
          .eq("id", userId)
          .maybeSingle();
        if (!cancelled && profile?.timezone) setTz(profile.timezone);
      } catch {
        /* profiles may be unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, isAuthenticated, userId]);

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t("nav.rooms")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("rooms.subtitle")}</p>
        </div>

        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <>
            <JoinCreateBar
              authed={isAuthenticated}
              onNeedAuth={() => setGateOpen(true)}
            />
            {isAuthenticated ? (
              <WeeklyLeaderboard timezone={tz} compact />
            ) : null}
          </>
        )}
      </div>

      <AuthGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        reason="create_room"
        onContinueAsGuest={() => setGateOpen(false)}
      />
    </ChromePage>
  );
}
