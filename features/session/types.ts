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

export type BreakChoiceId =
  | "hydration"
  | "doomscroll"
  | "touch_grass"
  | "smart_alignment";

export type BreakTypeUsed = "hydration" | "dynamic" | "smart_alignment";

export type BreakChoice = {
  id: BreakChoiceId;
  title: string;
  subtitle: string;
  emoji: string;
  group: "hydration" | "dynamic" | "smart";
  durationMs: number;
};

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
  breakLabel: string;
  breakEmoji: string;
  sessionName: string | null;
  breakTypesUsed: BreakTypeUsed[];
  remoteSessionId: string | null;
  clientId: string | null;
};

export type Action =
  | { type: "LOCK_IN"; sessionName?: string; remoteSessionId?: string | null; clientId?: string | null }
  | { type: "OPEN_PIT_STOP" }
  | { type: "CLOSE_PIT_STOP" }
  | { type: "START_BREAK"; choice: BreakChoice }
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
      breakTypesUsed?: BreakTypeUsed[];
      session?: SessionState;
    }
  | {
      type: "HYDRATE_STATS";
      streak: number;
      todayTotalMs: number;
      personalRecordMs?: number;
    };
