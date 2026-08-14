import { isRedirectError } from "next/dist/client/components/redirect-error";
import { notFound } from "next/navigation";
import { ChromePage } from "@/components/layout/ChromePage";
import { ContributionHeatmap } from "@/components/profile/ContributionHeatmap";
import { FollowButton } from "@/components/social/FollowButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicAvatarUrl } from "@/features/profile/api";
import { resolveUsername } from "@/lib/profile/resolveUsername";
import { createClient } from "@/lib/supabase/server";
import type { HeatmapDay } from "@/types/database";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  let profile;
  try {
    profile = await resolveUsername(supabase, username);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof Error && err.message === "PROFILE_NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: heatmap, error: heatmapError } = await supabase.rpc(
    "profile_activity_heatmap",
    {
      p_username: profile.username,
      p_tz: profile.timezone || "UTC",
    },
  );

  const days = (heatmapError ? [] : (heatmap ?? [])) as HeatmapDay[];
  const avatarUrl = publicAvatarUrl(supabase, profile.avatar_path);

  const isSelf = user?.id === profile.id;
  const badgeLabel = "Self-Reported ✍️";

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card className="border-slate-200 bg-white">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <Avatar className="h-16 w-16 rounded-2xl">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="rounded-2xl bg-slate-100 text-lg font-semibold">
                {profile.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {profile.username}
              </h1>
              <p className="text-sm text-slate-500">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-2 text-sm text-slate-600">{profile.bio}</p>
              )}
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className="rounded-lg border-slate-200 text-xs"
                >
                  {badgeLabel}
                </Badge>
              </div>
            </div>
            {!isSelf && (
              <FollowButton
                targetUserId={profile.id}
                initialStatus="none"
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Contribution heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <ContributionHeatmap days={days} />
          </CardContent>
        </Card>
      </div>
    </ChromePage>
  );
}
