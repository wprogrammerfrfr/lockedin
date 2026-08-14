import type { Action, AppState, BreakTypeUsed } from "./types";

/** Short PR so the sandbox particle burst is easy to demo (~15s). */
export const DEFAULT_PR_MS = 15 * 1000;
export const DEFAULT_TODAY_MS = 0;
export const DEFAULT_STREAK = 0;

function breakTypeFromChoiceGroup(
  group: "hydration" | "dynamic" | "smart",
): BreakTypeUsed {
  if (group === "smart") return "smart_alignment";
  return group;
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
  breakLabel: "",
  breakEmoji: "",
  sessionName: null,
  breakTypesUsed: [],
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
        breakRemainingMs: 0,
        breakLabel: "",
        breakEmoji: "",
        sessionName: action.sessionName?.trim() || null,
        breakTypesUsed: [],
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
        breakRemainingMs: 0,
        breakLabel: "",
        breakEmoji: "",
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
      return { ...state, session: "CHOOSING_BREAK", lastOutcome: "break" };
    case "CLOSE_PIT_STOP":
      if (state.session !== "CHOOSING_BREAK") return state;
      return {
        ...state,
        session: "LOCKED_IN",
        lastOutcome: state.didBreakPR ? "pr" : "solid",
      };
    case "START_BREAK": {
      if (state.session !== "CHOOSING_BREAK") return state;
      const used = breakTypeFromChoiceGroup(action.choice.group);
      const breakTypesUsed = state.breakTypesUsed.includes(used)
        ? state.breakTypesUsed
        : [...state.breakTypesUsed, used];
      return {
        ...state,
        session: "ON_BREAK",
        breakRemainingMs: action.choice.durationMs,
        breakLabel: action.choice.title,
        breakEmoji: action.choice.emoji,
        lastOutcome: "break",
        breakTypesUsed,
      };
    }
    case "START_SHARED_BREAK": {
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
        breakLabel: "Shared break",
        breakEmoji: "☕",
        lastOutcome: "break",
        breakTypesUsed,
      };
    }
    case "BREAK_TICK": {
      if (state.session !== "ON_BREAK") return state;
      const next = Math.max(0, state.breakRemainingMs - action.delta);
      if (next <= 0) {
        return {
          ...state,
          breakRemainingMs: 0,
          session: "BREAK_DONE",
        };
      }
      return { ...state, breakRemainingMs: next };
    }
    case "LOCK_BACK_IN":
      if (
        state.session !== "BREAK_DONE" &&
        state.session !== "ON_BREAK" &&
        state.session !== "CHOOSING_BREAK"
      ) {
        return state;
      }
      return {
        ...state,
        session: "LOCKED_IN",
        breakRemainingMs: 0,
        breakLabel: "",
        breakEmoji: "",
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
        breakRemainingMs: 0,
        breakLabel: "",
        breakEmoji: "",
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
        breakRemainingMs: 0,
        breakLabel: "",
        breakEmoji: "",
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
