import type {
  BreakSegment,
  BreakTypeId,
  BreakTypeStored,
} from "@/features/session/break-types";
import type {
  DessertMetadata,
  MeltConfig,
  MeltPostAction,
  MeltRecord,
} from "@/features/session/melt-catalog";

export type SessionState =
  | "IDLE"
  | "LOCKED_IN"
  | "CHOOSING_BREAK"
  | "ON_BREAK"
  | "BREAK_DONE"
  | "TAPPED_OUT"
  | "ENDED";

export type Verification = "github" | "self";

export type OutcomeKind = "pr" | "solid" | "break" | "tapout" | "idle";

export type BreakSource = "personal" | "shared" | null;

export type BreakMode = "count_up" | "count_down";

export type AppState = {
  session: SessionState;
  elapsedMs: number;
  todayTotalMs: number;
  personalRecordMs: number;
  streak: number;
  verification: Verification;
  didBreakPR: boolean;
  lastOutcome: OutcomeKind;
  lastSessionMs: number;
  shareOpen: boolean;
  breakRemainingMs: number;
  breakElapsedMs: number;
  breakOpenEnded: boolean;
  breakDurationMs: number;
  breakTypeId: BreakTypeId | null;
  breakSource: BreakSource;
  sessionName: string | null;
  breakTypesUsed: BreakTypeStored[];
  breakHistory: BreakSegment[];
  breakMs: number;
  remoteSessionId: string | null;
  clientId: string | null;
  /** ISO timestamp when the current lock-in started (for receipts). */
  sessionStartedAt: string | null;
  /** MELT IT mode — null means classic flip-clock timer. */
  meltConfig: MeltConfig | null;
  /** Offset so refreeze resets visual melt without resetting elapsed timer. */
  meltAnimOffsetMs: number;
  meltComplete: boolean;
  meltOutcomeAction: MeltPostAction | null;
  meltHistory: MeltRecord[];
  /** Dev QA: accelerates melt animation only, not timer ticks. */
  meltAnimSpeed: number;
  meltBuilderOpen: boolean;
};

export type Action =
  | {
      type: "LOCK_IN";
      sessionName?: string;
      remoteSessionId?: string | null;
      clientId?: string | null;
      meltConfig?: MeltConfig | null;
    }
  | { type: "OPEN_MELT_BUILDER" }
  | { type: "CLOSE_MELT_BUILDER" }
  | { type: "MELT_COMPLETE" }
  | { type: "MELT_POST_ACTION"; action: MeltPostAction }
  | { type: "SET_MELT_ANIM_SPEED"; speed: number }
  | { type: "OPEN_PIT_STOP" }
  | { type: "OPEN_SHARED_BREAK_PICKER" }
  | { type: "CLOSE_PIT_STOP" }
  | {
      type: "START_BREAK";
      mode: BreakMode;
      typeId: BreakTypeId;
      durationMs?: number;
    }
  | { type: "START_SHARED_BREAK"; durationMs?: number; typeId?: BreakTypeId }
  | { type: "BREAK_TICK"; delta: number }
  | { type: "LOCK_BACK_IN" }
  | { type: "END_SESSION" }
  | { type: "TICK"; delta: number }
  | { type: "TAP_OUT" }
  | { type: "TOGGLE_VERIFICATION" }
  | { type: "OPEN_SHARE" }
  | { type: "CLOSE_SHARE" }
  | { type: "CLEAR_PR_BURST" }
  | {
      type: "HYDRATE_REMOTE";
      remoteSessionId: string;
      clientId?: string | null;
      elapsedMs: number;
      sessionName?: string | null;
      breakTypesUsed?: BreakTypeStored[];
      breakHistory?: BreakSegment[];
      session?: SessionState;
      /** ISO start from DB when resuming a cloud session. */
      startedAt?: string | null;
      /** Restore MELT IT from dessert_metadata when resuming. */
      meltConfig?: MeltConfig | null;
      meltAnimOffsetMs?: number;
      meltComplete?: boolean;
      meltOutcomeAction?: MeltPostAction | null;
      meltHistory?: MeltRecord[];
      /** Cumulative break ms from server when resuming. */
      breakMs?: number;
      breakTypeId?: BreakTypeId | null;
      breakOpenEnded?: boolean;
      breakElapsedMs?: number;
      breakRemainingMs?: number;
      breakDurationMs?: number;
      breakSource?: BreakSource;
    }
  | {
      type: "HYDRATE_GUEST_DRAFT";
      sessionName?: string | null;
      elapsedMs: number;
      breakMs?: number;
      breakTypesUsed?: BreakTypeStored[];
      personalRecordMs?: number;
      didBreakPR?: boolean;
      session?: SessionState;
      startedAt?: string;
    }
  | {
      type: "HYDRATE_STATS";
      streak: number;
      todayTotalMs: number;
      personalRecordMs?: number;
    };

export type { BreakSegment, BreakTypeId, BreakTypeStored };
export type { DessertMetadata, MeltConfig, MeltPostAction, MeltRecord };
