/** Handwritten row types matching Supabase migrations (Phases 2–7). */

export type ProfileRow = {
  id: string;
  username: string;
  avatar_path: string | null;
  bio: string | null;
  timezone: string;
  username_changed_at: string | null;
  created_at?: string | null;
};

export type SessionStatus = "active" | "on_break" | "ended" | "tapped_out";

export type SessionRow = {
  id: string;
  user_id: string;
  session_name: string | null;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus | string;
  active_ms: number;
  break_ms: number;
  break_types_used: string[] | unknown;
  is_shared: boolean;
  outcome: string | null;
  pr_broken: boolean;
  client_id: string | null;
  room_session_id?: string | null;
};

export type RoomStatus = "waiting" | "live" | "closing" | "closed";
export type RoomKind = "vote" | "pomodoro";
export type RoomPhase = "work" | "break";

export type RoomRow = {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus | string;
  closes_at: string | null;
  created_at: string;
  kind: RoomKind | string;
  work_ms: number | null;
  break_ms: number | null;
  phase: RoomPhase | string | null;
  phase_started_at: string | null;
  name?: string | null;
  room_session_id?: string | null;
  active_break_round_id?: string | null;
  break_vote_ends_at?: string | null;
  break_vote_requested_by?: string | null;
  last_vote_round_id?: string | null;
  last_vote_result?: "break" | "stay" | "cancelled" | string | null;
};

export type RoomMemberRow = {
  room_id: string;
  user_id: string;
  seat: number | null;
  last_seen_at: string | null;
  focus_status?: string | null;
  elapsed_ms?: number | null;
};

export type FollowStatus = "pending" | "accepted" | "rejected";

export type FollowRow = {
  id?: string;
  follower_id: string;
  following_id: string;
  status: FollowStatus | string;
  created_at?: string;
};

export type PostRow = {
  id: string;
  author_id: string;
  session_id: string | null;
  caption: string | null;
  show_project_names: boolean;
  created_at: string;
};

export type LikeRow = {
  post_id: string;
  user_id: string;
  created_at?: string;
};

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  display_name: string;
  github_repo: string | null;
  hourly_rate_usd: number | null;
  project_value_usd: number | null;
  created_at: string;
};

export type NotificationType =
  | "follow_request"
  | "follow_accept"
  | "like"
  | "comment"
  | "streak_7"
  | "session_4h"
  | "lines_1000";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType | string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type HeatmapDay = {
  day: string;
  active_ms: number;
};
