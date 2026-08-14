import type { RoomKind, RoomPhase, RoomStatus } from "@/types/database";

export type RoomPresenceStatus =
  | "LOCKED_IN"
  | "BREAK"
  | "LACKING"
  | "IDLE"
  | "WAITING";

export type RoomPresenceMember = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  status: RoomPresenceStatus;
  elapsedMs: number;
  seat?: number | null;
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
