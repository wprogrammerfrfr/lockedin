import type { Metadata } from "next";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { notFound } from "next/navigation";
import { ChromePage } from "@/components/layout/ChromePage";
import { PublicProfileView } from "@/components/profile/PublicProfileView";
import { resolveUsername } from "@/lib/profile/resolveUsername";
import { createClient } from "@/lib/supabase/server";
import type { HeatmapDay } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  try {
    const supabase = await createClient();
    const profile = await resolveUsername(supabase, username);
    const title = `@${profile.username} · LockedIn`;
    const description =
      profile.bio?.trim() ||
      `Focus calendar and sessions for @${profile.username} on LockedIn.`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "profile",
        url: `/u/${profile.username}`,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return { title: "Profile · LockedIn" };
  }
}

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

  const [{ data: heatmap, error: heatmapError }, { data: verified }] =
    await Promise.all([
      supabase.rpc("profile_activity_heatmap", {
        p_username: profile.username,
        p_tz: profile.timezone || "UTC",
      }),
      supabase.rpc("profile_is_github_verified", {
        p_user_id: profile.id,
      }),
    ]);

  const days = (heatmapError ? [] : (heatmap ?? [])) as HeatmapDay[];
  const isSelf = user?.id === profile.id;
  const githubVerified = verified === true;

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PublicProfileView
          profileId={profile.id}
          username={profile.username}
          bio={profile.bio}
          timezone={profile.timezone || "UTC"}
          avatarPath={profile.avatar_path}
          days={days}
          isSelf={isSelf}
          viewerId={user?.id ?? null}
          githubVerified={githubVerified}
        />
      </div>
    </ChromePage>
  );
}
