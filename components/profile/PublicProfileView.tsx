"use client";

import { useEffect, useState } from "react";
import { Flag, Ban } from "lucide-react";
import { toast } from "sonner";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { ContributionHeatmap } from "@/components/profile/ContributionHeatmap";
import {
  ProfileHeroAvatar,
  ProfileSocialStats,
} from "@/components/profile/ProfileHero";
import { DaySessionsDialog } from "@/components/dashboard/DaySessionsDialog";
import {
  FollowBackButton,
  FollowButton,
} from "@/components/social/FollowButton";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { blockUser } from "@/features/moderation/api";
import { publicAvatarUrl } from "@/features/profile/api";
import {
  getFollowRelation,
  profileSocialCounts,
} from "@/features/social/api";
import type { FollowRelationStatus } from "@/features/social/types";
import type { ProfileSocialCounts as Counts } from "@/features/social/types";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import type { HeatmapDay } from "@/types/database";

export function PublicProfileView({
  profileId,
  username,
  bio,
  timezone,
  avatarPath,
  days,
  isSelf,
  viewerId,
  githubVerified = false,
}: {
  profileId: string;
  username: string;
  bio: string | null;
  timezone: string;
  avatarPath: string | null;
  days: HeatmapDay[];
  isSelf: boolean;
  viewerId: string | null;
  githubVerified?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const avatarUrl = publicAvatarUrl(avatarPath);
  const [counts, setCounts] = useState<Counts>({
    friends: 0,
    followers: 0,
    following: 0,
  });
  const [followStatus, setFollowStatus] =
    useState<FollowRelationStatus>(isSelf ? "self" : "none");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [theyFollowYou, setTheyFollowYou] = useState(false);

  const canSeeSessions =
    isSelf || followStatus === "accepted";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const social = await profileSocialCounts(supabase, profileId);
        if (!cancelled) setCounts(social);
      } catch {
        /* keep zeros */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    if (isSelf || !viewerId) {
      setFollowStatus(isSelf ? "self" : "none");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const status = await getFollowRelation(createClient(), profileId);
        if (!cancelled) {
          setFollowStatus(status);
          setTheyFollowYou(
            status === "pending_incoming" || status === "none",
          );
          // Check inbound accepted for follow-back when status is none
          if (status === "none" || status === "rejected") {
            const { data } = await createClient()
              .from("follows")
              .select("status")
              .eq("follower_id", profileId)
              .eq("following_id", viewerId)
              .eq("status", "accepted")
              .maybeSingle();
            if (!cancelled) setTheyFollowYou(Boolean(data));
          } else if (status === "accepted") {
            setTheyFollowYou(false);
          }
        }
      } catch {
        if (!cancelled) setFollowStatus("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSelf, viewerId, profileId]);

  async function handleBlock() {
    try {
      await blockUser(createClient(), profileId);
      setFollowStatus("blocked");
      toast.success(`Blocked @${username}`);
    } catch (err) {
      toast.error(userFacingError(err, "Could not block user"));
    }
  }

  return (
    <>
      <Card className="border-slate-200 bg-white">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <ProfileHeroAvatar
            name={username}
            avatarUrl={avatarUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  {username}
                </h1>
                <p className="text-sm text-slate-500">@{username}</p>
                {bio ? (
                  <p className="mt-2 text-sm text-slate-600">{bio}</p>
                ) : null}
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className="rounded-lg border-slate-200 text-xs"
                  >
                    {githubVerified
                      ? "GitHub Verified ✓"
                      : "Self-Reported ✍️"}
                  </Badge>
                </div>
              </div>
              {!isSelf ? (
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  {followStatus === "accepted" ? (
                    <FollowButton
                      targetUserId={profileId}
                      initialStatus={followStatus}
                      onNeedAuth={() => setGateOpen(true)}
                      onStatusChange={setFollowStatus}
                    />
                  ) : theyFollowYou &&
                    followStatus !== "pending_outgoing" &&
                    followStatus !== "blocked" &&
                    followStatus !== "pending_incoming" ? (
                    <FollowBackButton
                      targetUserId={profileId}
                      onDone={() => setFollowStatus("accepted")}
                    />
                  ) : (
                    <FollowButton
                      targetUserId={profileId}
                      initialStatus={followStatus}
                      onNeedAuth={() => setGateOpen(true)}
                      onStatusChange={setFollowStatus}
                    />
                  )}
                  {isAuthenticated && followStatus !== "blocked" ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs text-slate-500"
                        onClick={() => setReportOpen(true)}
                      >
                        <Flag className="mr-1 h-3.5 w-3.5" />
                        Report
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs text-rose-600"
                        onClick={() => void handleBlock()}
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" />
                        Block
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <ProfileSocialStats counts={counts} userId={profileId} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Focus calendar</CardTitle>
          <p className="text-xs text-slate-500">
            {canSeeSessions
              ? "Click a date to see sessions."
              : followStatus === "blocked"
                ? "You blocked this user."
                : "Follow to unlock session details for each date."}
          </p>
        </CardHeader>
        <CardContent>
          {canSeeSessions || days.length > 0 ? (
            <ContributionHeatmap
              days={days}
              emptyHint={isSelf}
              onDayClick={(date) => {
                if (!canSeeSessions) {
                  toast.message("Follow to see sessions", {
                    description: "Accepted follows unlock day details.",
                  });
                  return;
                }
                setSelectedDay(date);
                setDayOpen(true);
              }}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              Focus calendar unlocks after you follow @{username}.
            </p>
          )}
        </CardContent>
      </Card>

      <DaySessionsDialog
        open={dayOpen}
        onOpenChange={setDayOpen}
        username={username}
        day={selectedDay}
        timezone={timezone || "UTC"}
        canShare={isSelf}
        locked={!canSeeSessions}
      />

      <AuthGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        reason="follow"
        onContinueAsGuest={() => setGateOpen(false)}
      />

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="profile"
        targetId={profileId}
      />
    </>
  );
}
