export type FollowRelationStatus =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "accepted"
  | "rejected"
  | "self";

export type ProfileSearchHit = {
  id: string;
  username: string;
  avatar_path: string | null;
  bio: string | null;
};

export type FollowRequest = {
  follower_id: string;
  following_id: string;
  status: string;
  created_at?: string;
  profile?: ProfileSearchHit;
};

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_path: string | null;
  active_ms: number;
  rank: number;
};
