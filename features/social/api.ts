import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FollowRequest,
  LeaderboardEntry,
  ProfileSearchHit,
} from "@/features/social/types";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

export async function searchProfiles(
  supabase: SupabaseClient,
  q: string,
): Promise<ProfileSearchHit[]> {
  const { data, error } = await supabase.rpc("search_profiles", {
    q: q.trim(),
  });
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ProfileSearchHit[];
}

export async function requestFollow(
  supabase: SupabaseClient,
  followingId: string,
) {
  const { error } = await supabase.rpc("request_follow", {
    p_following_id: followingId,
  });
  if (error) throw new Error(error.message);
}

export async function acceptFollow(
  supabase: SupabaseClient,
  followerId: string,
) {
  const { error } = await supabase.rpc("accept_follow", {
    p_follower_id: followerId,
  });
  if (error) throw new Error(error.message);
}

export async function rejectFollow(
  supabase: SupabaseClient,
  followerId: string,
) {
  const { error } = await supabase.rpc("reject_follow", {
    p_follower_id: followerId,
  });
  if (error) throw new Error(error.message);
}

export async function unfollow(supabase: SupabaseClient, followingId: string) {
  const { error } = await supabase.rpc("unfollow", {
    p_following_id: followingId,
  });
  if (error) throw new Error(error.message);
}

export async function listIncomingFollowRequests(
  supabase: SupabaseClient,
): Promise<FollowRequest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("follows")
    .select(
      "follower_id, following_id, status, created_at, profile:profiles!follows_follower_id_fkey(id, username, avatar_path, bio)",
    )
    .eq("following_id", user.id)
    .eq("status", "pending");

  if (error) {
    if (isSchemaUnavailable(error)) return [];
    // Fallback without join alias if FK name differs
    const { data: plain, error: e2 } = await supabase
      .from("follows")
      .select("follower_id, following_id, status, created_at")
      .eq("following_id", user.id)
      .eq("status", "pending");
    if (e2) {
      if (isSchemaUnavailable(e2)) return [];
      throw new Error(e2.message);
    }
    return (plain ?? []) as FollowRequest[];
  }

  return (data ?? []).map((row) => {
    const r = row as FollowRequest & { profile?: ProfileSearchHit | ProfileSearchHit[] };
    const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
    return { ...r, profile };
  });
}

export async function weeklyLeaderboard(
  supabase: SupabaseClient,
  viewerTz: string,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("weekly_leaderboard", {
    viewer_tz: viewerTz,
  });
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  const payload = data as
    | { entries?: LeaderboardEntry[] }
    | LeaderboardEntry[]
    | null;
  if (Array.isArray(payload)) return payload;
  return payload?.entries ?? [];
}
