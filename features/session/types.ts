import type {
  BreakSegment,
  BreakTypeId,
  BreakTypeStored,
} from "@/features/session/break-types";

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
};

export type Action =
  | { type: "LOCK_IN"; sessionName?: string; remoteSessionId?: string | null; clientId?: string | null }
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
    }
  | {
      type: "HYDRATE_STATS";
      streak: number;
      todayTotalMs: number;
      personalRecordMs?: number;
    };

export type { BreakSegment, BreakTypeId, BreakTypeStored };
