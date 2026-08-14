"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { FeedList } from "@/components/feed/FeedList";
import { ProfileSearch } from "@/components/social/ProfileSearch";

export default function ExplorePage() {
  const { status, isAuthenticated } = useAuth();
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
            Explore
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Find students, send follow requests, and browse shared sessions.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-700">
            Search
          </h2>
          <ProfileSearch />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-700">
            Following feed
          </h2>
          {status === "loading" ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : isAuthenticated ? (
            <FeedList />
          ) : (
            <p className="text-sm text-slate-400">
              Sign in to see explicitly shared sessions from people you follow.
            </p>
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
