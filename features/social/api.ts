import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FollowRelationStatus,
  FollowRequest,
  LeaderboardEntry,
  ProfileSearchHit,
  ProfileSocialCounts,
  ProfileDaySession,
} from "@/features/social/types";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

export async function profileSocialCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileSocialCounts> {
  const { data, error } = await supabase.rpc("profile_social_counts", {
    p_user_id: userId,
  });
  if (error) {
    if (isSchemaUnavailable(error)) {
      return { friends: 0, followers: 0, following: 0 };
    }
    throw new Error(error.message);
  }
  const row = (data ?? {}) as Partial<ProfileSocialCounts>;
  return {
    friends: Number(row.friends) || 0,
    followers: Number(row.followers) || 0,
    following: Number(row.following) || 0,
  };
}

export async function profileSessionsForDay(
  supabase: SupabaseClient,
  username: string,
  day: string,
  tz: string,
): Promise<ProfileDaySession[]> {
  const { data, error } = await supabase.rpc("profile_sessions_for_day", {
    p_username: username,
    p_day: day,
    p_tz: tz,
  });
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (Array.isArray(data) ? data : []) as ProfileDaySession[];
}

export async function getFollowRelation(
  supabase: SupabaseClient,
  targetUserId: string,
): Promise<FollowRelationStatus> {
  const { data, error } = await supabase.rpc("get_follow_relation", {
    p_target_id: targetUserId,
  });
  if (error) {
    if (isSchemaUnavailable(error)) return "none";
    throw new Error(error.message);
  }
  const status = String(data ?? "none");
  if (
    status === "self" ||
    status === "accepted" ||
    status === "pending_outgoing" ||
    status === "pending_incoming" ||
    status === "rejected" ||
    status === "blocked" ||
    status === "none"
  ) {
    return status;
  }
  return "none";
}

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

export async function followBack(
  supabase: SupabaseClient,
  userId: string,
) {
  const { error } = await supabase.rpc("follow_back", {
    p_user_id: userId,
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

export async function listFollowers(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileSearchHit[]> {
  const { data, error } = await supabase.rpc("list_followers", {
    p_user_id: userId,
  });
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (Array.isArray(data) ? data : []) as ProfileSearchHit[];
}

export async function listFollowing(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileSearchHit[]> {
  const { data, error } = await supabase.rpc("list_following", {
    p_user_id: userId,
  });
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (Array.isArray(data) ? data : []) as ProfileSearchHit[];
}

export async function listFriends(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileSearchHit[]> {
  const { data, error } = await supabase.rpc("list_friends", {
    p_user_id: userId,
  });
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (Array.isArray(data) ? data : []) as ProfileSearchHit[];
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
