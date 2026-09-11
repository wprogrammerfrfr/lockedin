export type FollowRelationStatus =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "accepted"
  | "rejected"
  | "blocked"
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

export type ProfileSocialCounts = {
  friends: number;
  followers: number;
  following: number;
};

export type ProfileDaySessionParticipant = {
  user_id: string;
  username?: string | null;
  active_ms?: number;
  break_ms?: number;
  break_types_used?: unknown;
  break_history?: unknown;
  outcome?: string | null;
  status_at_end?: string | null;
};

export type ProfileDaySession = {
  id: string;
  session_name?: string | null;
  active_ms?: number;
  break_ms?: number;
  break_types_used?: unknown;
  break_history?: unknown;
  started_at?: string;
  ended_at?: string | null;
  outcome?: string | null;
  pr_broken?: boolean;
  status?: string;
  room_session_id?: string | null;
  room_name?: string | null;
  room_code?: string | null;
  kind?: "solo" | "room" | string;
  dessert_metadata?: unknown;
  participants?: ProfileDaySessionParticipant[];
};
