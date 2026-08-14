"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { JoinCreateBar } from "@/components/rooms/JoinCreateBar";
import { RoomLobby } from "@/components/rooms/RoomLobby";
import { WeeklyLeaderboard } from "@/components/social/WeeklyLeaderboard";
import { createClient } from "@/lib/supabase/client";

export default function RoomsPage() {
  const { status, isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;
  const [gateOpen, setGateOpen] = useState(false);
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated || !userId) {
      setGateOpen(true);
      return;
    }

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
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Rooms
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Multiplayer 2–6 focus rooms. Join with a 6-digit code or create one.
          </p>
        </div>

        {status === "loading" ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : isAuthenticated ? (
          <>
            <JoinCreateBar
              authed={isAuthenticated}
              onNeedAuth={() => setGateOpen(true)}
            />
            <RoomLobby />
            <WeeklyLeaderboard timezone={tz} compact />
          </>
        ) : (
          <p className="text-sm text-slate-400">
            Please log in to use this feature
          </p>
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
