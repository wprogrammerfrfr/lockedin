import type {
  Action,
  AppState,
  BreakChoiceId,
  BreakTypeStored,
  BreakTypeUsed,
} from "./types";

/** Short PR so the sandbox particle burst is easy to demo (~15s). */
export const DEFAULT_PR_MS = 0;
export const DEFAULT_TODAY_MS = 0;
export const DEFAULT_STREAK = 0;

function breakTypeFromChoiceGroup(
  group: "hydration" | "dynamic" | "smart",
): BreakTypeUsed {
  if (group === "smart") return "smart_alignment";
  return group;
}

function appendBreakTypesUsed(
  existing: BreakTypeStored[],
  group: BreakTypeUsed,
  choiceId: BreakChoiceId,
): BreakTypeStored[] {
  const next = [...existing];
  if (!next.includes(group)) next.push(group);
  // Persist choice id alongside group so history can show Doomscroll vs Touch Grass.
  if (choiceId !== group && !next.includes(choiceId)) {
    next.push(choiceId);
  }
  return next;
}

function clearBreakFields(): Partial<AppState> {
  return {
    breakRemainingMs: 0,
    breakElapsedMs: 0,
    breakOpenEnded: false,
    breakLabel: "",
    breakEmoji: "",
    breakChoiceId: null,
    breakSource: null,
  };
}

export const initialState: AppState = {
  session: "IDLE",
  elapsedMs: 0,
  todayTotalMs: DEFAULT_TODAY_MS,
  personalRecordMs: DEFAULT_PR_MS,
  streak: DEFAULT_STREAK,
  verification: "github",
  didBreakPR: false,
  lastOutcome: "idle",
  lastSessionMs: 0,
  shareOpen: false,
  breakRemainingMs: 0,
  breakElapsedMs: 0,
  breakOpenEnded: false,
  breakLabel: "",
  breakEmoji: "",
  breakChoiceId: null,
  breakSource: null,
  sessionName: null,
  breakTypesUsed: [],
  breakMs: 0,
  remoteSessionId: null,
  clientId: null,
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOCK_IN":
      if (
        state.session !== "IDLE" &&
        state.session !== "TAPPED_OUT" &&
        state.session !== "ENDED"
      ) {
        return state;
      }
      return {
        ...state,
        session: "LOCKED_IN",
        elapsedMs: 0,
        didBreakPR: false,
        lastOutcome: "solid",
        lastSessionMs: 0,
        ...clearBreakFields(),
        sessionName: action.sessionName?.trim() || null,
        breakTypesUsed: [],
        breakMs: 0,
        remoteSessionId:
          action.remoteSessionId !== undefined
            ? action.remoteSessionId
            : state.remoteSessionId,
        clientId:
          action.clientId !== undefined ? action.clientId : state.clientId,
      };
    case "HYDRATE_REMOTE":
      return {
        ...state,
        session: action.session ?? "LOCKED_IN",
        elapsedMs: action.elapsedMs,
        lastSessionMs: action.elapsedMs,
        lastOutcome: "solid",
        sessionName:
          action.sessionName !== undefined
            ? action.sessionName
            : state.sessionName,
        breakTypesUsed: action.breakTypesUsed ?? state.breakTypesUsed,
        remoteSessionId: action.remoteSessionId,
        clientId:
          action.clientId !== undefined ? action.clientId : state.clientId,
        didBreakPR: false,
        ...clearBreakFields(),
      };
    case "HYDRATE_STATS":
      return {
        ...state,
        streak: action.streak,
        todayTotalMs: action.todayTotalMs,
        personalRecordMs:
          action.personalRecordMs !== undefined && action.personalRecordMs > 0
            ? action.personalRecordMs
            : state.personalRecordMs,
      };
    case "OPEN_PIT_STOP":
      if (state.session !== "LOCKED_IN") return state;
      return {
        ...state,
        session: "CHOOSING_BREAK",
        breakSource: "personal",
        lastOutcome: "break",
      };
    case "OPEN_SHARED_BREAK_PICKER":
      if (state.session !== "LOCKED_IN" && state.session !== "CHOOSING_BREAK") {
        return state;
      }
      return {
        ...state,
        session: "CHOOSING_BREAK",
        breakSource: "shared",
        lastOutcome: "break",
      };
    case "CLOSE_PIT_STOP":
      if (state.session !== "CHOOSING_BREAK") return state;
      // Shared vote result requires a type pick — cannot cancel back to locked in.
      if (state.breakSource === "shared") return state;
      return {
        ...state,
        session: "LOCKED_IN",
        breakSource: null,
        lastOutcome: state.didBreakPR ? "pr" : "solid",
      };
    case "START_BREAK": {
      if (state.session !== "CHOOSING_BREAK") return state;
      const used = breakTypeFromChoiceGroup(action.choice.group);
      const openEnded = Boolean(action.openEnded);
      return {
        ...state,
        session: "ON_BREAK",
        breakRemainingMs: openEnded ? 0 : action.choice.durationMs,
        breakElapsedMs: 0,
        breakOpenEnded: openEnded,
        breakLabel: action.choice.title,
        breakEmoji: action.choice.emoji,
        breakChoiceId: action.choice.id,
        breakSource: state.breakSource ?? "personal",
        lastOutcome: "break",
        breakTypesUsed: appendBreakTypesUsed(
          state.breakTypesUsed,
          used,
          action.choice.id,
        ),
      };
    }
    case "START_SHARED_BREAK": {
      // Pomodoro cadence path — timed shared break, no type picker.
      if (state.session !== "LOCKED_IN" && state.session !== "CHOOSING_BREAK") {
        return state;
      }
      const breakTypesUsed = state.breakTypesUsed.includes("dynamic")
        ? state.breakTypesUsed
        : [...state.breakTypesUsed, "dynamic" as const];
      return {
        ...state,
        session: "ON_BREAK",
        breakRemainingMs: action.durationMs ?? 5 * 60 * 1000,
        breakElapsedMs: 0,
        breakOpenEnded: false,
        breakLabel: "Pomodoro break",
        breakEmoji: "☕",
        breakChoiceId: null,
        breakSource: "shared",
        lastOutcome: "break",
        breakTypesUsed,
      };
    }
    case "BREAK_TICK": {
      if (state.session !== "ON_BREAK") return state;
      if (state.breakOpenEnded) {
        return {
          ...state,
          breakElapsedMs: state.breakElapsedMs + action.delta,
          breakMs: state.breakMs + action.delta,
        };
      }
      const spent = Math.min(action.delta, state.breakRemainingMs);
      const next = Math.max(0, state.breakRemainingMs - action.delta);
      if (next <= 0) {
        return {
          ...state,
          breakRemainingMs: 0,
          breakMs: state.breakMs + spent,
          session: "BREAK_DONE",
        };
      }
      return {
        ...state,
        breakRemainingMs: next,
        breakMs: state.breakMs + spent,
      };
    }
    case "LOCK_BACK_IN":
      if (
        state.session !== "BREAK_DONE" &&
        state.session !== "ON_BREAK" &&
        state.session !== "CHOOSING_BREAK"
      ) {
        return state;
      }
      // Shared picker cannot be skipped via LOCK BACK IN either.
      if (
        state.session === "CHOOSING_BREAK" &&
        state.breakSource === "shared"
      ) {
        return state;
      }
      return {
        ...state,
        session: "LOCKED_IN",
        ...clearBreakFields(),
        lastOutcome: state.didBreakPR ? "pr" : "solid",
      };
    case "END_SESSION":
      if (
        state.session !== "BREAK_DONE" &&
        state.session !== "LOCKED_IN" &&
        state.session !== "ON_BREAK" &&
        state.session !== "CHOOSING_BREAK"
      ) {
        return state;
      }
      return {
        ...state,
        session: "ENDED",
        lastSessionMs: state.elapsedMs,
        lastOutcome: state.didBreakPR ? "pr" : "solid",
        ...clearBreakFields(),
        remoteSessionId: null,
      };
    case "TICK": {
      if (state.session !== "LOCKED_IN") return state;
      const elapsedMs = state.elapsedMs + action.delta;
      const canBreakPr = state.personalRecordMs > 0;
      const justBroke =
        canBreakPr &&
        state.elapsedMs <= state.personalRecordMs &&
        elapsedMs > state.personalRecordMs;
      return {
        ...state,
        elapsedMs,
        todayTotalMs: state.todayTotalMs + action.delta,
        personalRecordMs: justBroke
          ? elapsedMs
          : elapsedMs > state.personalRecordMs
            ? elapsedMs
            : state.personalRecordMs,
        didBreakPR: justBroke ? true : state.didBreakPR,
        lastOutcome:
          justBroke || (canBreakPr && elapsedMs > state.personalRecordMs)
            ? "pr"
            : "solid",
        lastSessionMs: elapsedMs,
      };
    }
    case "TAP_OUT":
      if (state.session !== "LOCKED_IN") {
        return state;
      }
      return {
        ...state,
        session: "TAPPED_OUT",
        lastOutcome: "tapout",
        lastSessionMs: state.elapsedMs,
        ...clearBreakFields(),
        shareOpen: true,
        remoteSessionId: null,
      };
    case "TOGGLE_VERIFICATION":
      return {
        ...state,
        verification: state.verification === "github" ? "self" : "github",
      };
    case "OPEN_SHARE":
      return { ...state, shareOpen: true };
    case "CLOSE_SHARE":
      return { ...state, shareOpen: false };
    case "CLEAR_PR_BURST":
      return { ...state, didBreakPR: false };
    default:
      return state;
  }
}
