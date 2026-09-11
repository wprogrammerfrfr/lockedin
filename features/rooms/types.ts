import type { RoomKind, RoomPhase, RoomStatus } from "@/types/database";
import type { MeltConfig } from "@/features/session/melt-catalog";

export type RoomPresenceStatus =
  | "LOCKED_IN"
  | "BREAK"
  | "LACKING"
  | "IDLE"
  | "WAITING"
  | "CUSTOMIZING";

export type RoomPresenceMember = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  status: RoomPresenceStatus;
  elapsedMs: number;
  /**
   * Client wall-clock when this snapshot was taken (presence track or DB fetch).
   * Used to extrapolate live timers between sync events.
   */
  clockSyncedAt?: number;
  seat?: number | null;
  /** Live break label, e.g. "15-minute Hydration Break" or "Quick Doomscroll". */
  breakLabel?: string | null;
  /** Choice id / coarse type for badges: hydration, doomscroll, pomodoro, etc. */
  breakType?: string | null;
  /** Time already spent in the current break. */
  breakElapsedMs?: number;
  /** Time left in a countdown break. */
  breakRemainingMs?: number;
  /** Whether the current break counts upward instead of down. */
  breakOpenEnded?: boolean;
  /** MELT IT live config for shared melt board */
  meltConfig?: MeltConfig | null;
  meltAnimOffsetMs?: number;
  meltAnimSpeed?: number;
  meltCustomizing?: boolean;
  meltStatusLabel?: string | null;
  /** Normalized table seat 0–1 left→right; null = auto-spread. */
  meltBoardX?: number | null;
  /** Normalized table depth 0–1 front→back; null = auto-spread. */
  meltBoardZ?: number | null;
};

export type RoomSummary = {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus | string;
  closesAt: string | null;
  kind: RoomKind | string;
  workMs: number | null;
  breakMs: number | null;
  phase: RoomPhase | string | null;
  phaseStartedAt: string | null;
  name?: string | null;
  roomSessionId?: string | null;
  activeBreakRoundId?: string | null;
  breakVoteEndsAt?: string | null;
  breakVoteRequestedBy?: string | null;
  lastVoteRoundId?: string | null;
  lastVoteResult?: "break" | "stay" | "cancelled" | string | null;
  memberCount?: number;
};

export type BreakVoteChoice = "break" | "stay";

export type BreakVoteRound = {
  roomId: string;
  roundId: string;
  endsAt: string;
  tallies: { break: number; stay: number };
  myVote: BreakVoteChoice | null;
};
