import {
  getBreakType,
  pickRandomBreakType,
  type BreakSegment,
  type BreakTypeId,
  type BreakTypeStored,
} from "@/features/session/break-types";
import type { Action, AppState } from "./types";
import type { MeltRecord } from "@/features/session/melt-catalog";

/** Short PR so the sandbox particle burst is easy to demo (~15s). */
export const DEFAULT_PR_MS = 0;
export const DEFAULT_TODAY_MS = 0;
export const DEFAULT_STREAK = 0;

function appendBreakTypeUsed(
  existing: BreakTypeStored[],
  typeId: BreakTypeId,
): BreakTypeStored[] {
  if (existing.includes(typeId)) return existing;
  return [...existing, typeId];
}

function segmentDuration(state: AppState): number {
  if (state.breakOpenEnded) return state.breakElapsedMs;
  return Math.max(0, state.breakDurationMs - state.breakRemainingMs);
}

function appendBreakSegment(state: AppState): BreakSegment[] {
  if (!state.breakTypeId) return state.breakHistory;
  const durationMs = segmentDuration(state);
  if (durationMs <= 0 && state.session !== "BREAK_DONE") return state.breakHistory;
  return [
    ...state.breakHistory,
    {
      typeId: state.breakTypeId,
      durationMs,
      openEnded: state.breakOpenEnded,
    },
  ];
}

/** Break history including an in-progress break segment (for sync before dispatch). */
export function projectBreakHistory(state: AppState): BreakSegment[] {
  if (state.session === "ON_BREAK" || state.session === "BREAK_DONE") {
    return appendBreakSegment(state);
  }
  return state.breakHistory;
}

function clearMeltFields(): Partial<AppState> {
  return {
    meltConfig: null,
    meltAnimOffsetMs: 0,
    meltComplete: false,
    meltOutcomeAction: null,
    meltAnimSpeed: 1,
    meltBuilderOpen: false,
    meltHistory: [],
  };
}

function snapshotMeltRecord(state: AppState): MeltRecord | null {
  if (!state.meltConfig) return null;
  const progress = state.meltComplete
    ? 1
    : Math.min(
        1,
        Math.max(
          0,
          (state.elapsedMs - state.meltAnimOffsetMs) / state.meltConfig.meltDurationMs,
        ),
      );
  return {
    config: state.meltConfig,
    meltProgress: progress,
    meltComplete: state.meltComplete || progress >= 1,
    outcomeAction: state.meltOutcomeAction,
    completedAt: new Date().toISOString(),
  };
}
function clearBreakFields(): Partial<AppState> {
  return {
    breakRemainingMs: 0,
    breakElapsedMs: 0,
    breakOpenEnded: false,
    breakDurationMs: 0,
    breakTypeId: null,
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
  breakDurationMs: 0,
  breakTypeId: null,
  breakSource: null,
  sessionName: null,
  breakTypesUsed: [],
  breakHistory: [],
  breakMs: 0,
  remoteSessionId: null,
  clientId: null,
  sessionStartedAt: null,
  meltConfig: null,
  meltAnimOffsetMs: 0,
  meltComplete: false,
  meltOutcomeAction: null,
  meltHistory: [],
  meltAnimSpeed: 1,
  meltBuilderOpen: false,
};

function applyBreakStart(
  state: AppState,
  typeId: BreakTypeId,
  mode: "count_up" | "count_down",
  durationMs: number,
): AppState {
  const def = getBreakType(typeId)!;
  const openEnded = mode === "count_up";
  return {
    ...state,
    session: "ON_BREAK",
    breakRemainingMs: openEnded ? 0 : durationMs,
    breakElapsedMs: 0,
    breakOpenEnded: openEnded,
    breakDurationMs: openEnded ? 0 : durationMs,
    breakTypeId: typeId,
    breakSource: state.breakSource ?? "personal",
    lastOutcome: "break",
    breakTypesUsed: appendBreakTypeUsed(state.breakTypesUsed, typeId),
  };
}

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
        ...(action.meltConfig !== undefined
          ? {
              meltConfig: action.meltConfig,
              meltAnimOffsetMs: 0,
              meltComplete: false,
              meltOutcomeAction: null,
              meltBuilderOpen: false,
              meltHistory: [],
            }
          : clearMeltFields()),
        sessionName: action.sessionName?.trim() || null,
        breakTypesUsed: [],
        breakHistory: [],
        breakMs: 0,
        sessionStartedAt: new Date().toISOString(),
        remoteSessionId:
          action.remoteSessionId !== undefined
            ? action.remoteSessionId
            : state.remoteSessionId,
        clientId:
          action.clientId !== undefined ? action.clientId : state.clientId,
      };
    case "HYDRATE_REMOTE": {
      const session = action.session ?? "LOCKED_IN";
      const onBreak = session === "ON_BREAK";
      return {
        ...state,
        session,
        elapsedMs: action.elapsedMs,
        lastSessionMs: action.elapsedMs,
        lastOutcome: onBreak ? "break" : "solid",
        sessionName:
          action.sessionName !== undefined
            ? action.sessionName
            : state.sessionName,
        breakTypesUsed: action.breakTypesUsed ?? state.breakTypesUsed,
        breakHistory: action.breakHistory ?? state.breakHistory,
        breakMs:
          action.breakMs !== undefined ? action.breakMs : state.breakMs,
        remoteSessionId: action.remoteSessionId,
        clientId:
          action.clientId !== undefined ? action.clientId : state.clientId,
        didBreakPR: false,
        sessionStartedAt:
          action.startedAt?.trim() ||
          state.sessionStartedAt ||
          new Date().toISOString(),
        ...(onBreak
          ? {
              breakRemainingMs: action.breakRemainingMs ?? 0,
              breakElapsedMs:
                action.breakElapsedMs ?? action.breakMs ?? state.breakMs ?? 0,
              breakOpenEnded: action.breakOpenEnded ?? true,
              breakDurationMs: action.breakDurationMs ?? 0,
              breakTypeId:
                action.breakTypeId !== undefined
                  ? action.breakTypeId
                  : state.breakTypeId,
              breakSource: action.breakSource ?? "personal",
            }
          : clearBreakFields()),
        ...(action.meltConfig !== undefined
          ? {
              meltConfig: action.meltConfig,
              meltAnimOffsetMs: action.meltAnimOffsetMs ?? 0,
              meltComplete: action.meltComplete ?? false,
              meltOutcomeAction: action.meltOutcomeAction ?? null,
              meltHistory: action.meltHistory ?? [],
              meltBuilderOpen: false,
              meltAnimSpeed: 1,
            }
          : {}),
      };
    }
    case "HYDRATE_GUEST_DRAFT": {
      const session = action.session ?? "LOCKED_IN";
      const onBreak = session === "ON_BREAK";
      const breakMs = action.breakMs ?? 0;
      return {
        ...state,
        session,
        elapsedMs: action.elapsedMs,
        lastSessionMs: action.elapsedMs,
        lastOutcome: onBreak
          ? "break"
          : action.didBreakPR
            ? "pr"
            : "solid",
        sessionName: action.sessionName?.trim() || null,
        breakTypesUsed: action.breakTypesUsed ?? [],
        breakMs,
        didBreakPR: Boolean(action.didBreakPR),
        personalRecordMs:
          action.personalRecordMs !== undefined
            ? action.personalRecordMs
            : state.personalRecordMs,
        sessionStartedAt: new Date(
          Date.now() - Math.max(0, action.elapsedMs),
        ).toISOString(),
        remoteSessionId: null,
        ...(onBreak
          ? {
              breakRemainingMs: 0,
              breakElapsedMs: breakMs,
              breakOpenEnded: true,
              breakDurationMs: 0,
              breakTypeId: null,
              breakSource: "personal" as const,
            }
          : clearBreakFields()),
      };
    }
    case "HYDRATE_STATS":
      return {
        ...state,
        streak: action.streak,
        todayTotalMs: action.todayTotalMs,
        personalRecordMs:
          action.personalRecordMs !== undefined
            ? action.personalRecordMs
            : state.personalRecordMs,
      };
    case "OPEN_MELT_BUILDER":
      if (
        state.session !== "IDLE" &&
        state.session !== "TAPPED_OUT" &&
        state.session !== "ENDED"
      ) {
        return state;
      }
      return { ...state, meltBuilderOpen: true };
    case "CLOSE_MELT_BUILDER":
      return { ...state, meltBuilderOpen: false };
    case "MELT_COMPLETE":
      if (
        (state.session !== "LOCKED_IN" &&
          state.session !== "ON_BREAK" &&
          state.session !== "CHOOSING_BREAK") ||
        !state.meltConfig
      ) {
        return state;
      }
      return { ...state, meltComplete: true };
    case "MELT_POST_ACTION": {
      if (!state.meltConfig) return state;
      const record = snapshotMeltRecord({
        ...state,
        meltComplete: true,
        meltOutcomeAction: action.action,
      });
      const history = record
        ? [...state.meltHistory, { ...record, outcomeAction: action.action }]
        : state.meltHistory;

      if (action.action === "trash") {
        return {
          ...state,
          meltHistory: history,
          ...clearMeltFields(),
        };
      }
      if (action.action === "refreeze") {
        return {
          ...state,
          meltHistory: history,
          meltAnimOffsetMs: state.elapsedMs,
          meltComplete: false,
          meltOutcomeAction: null,
        };
      }
      // refreeze_restart
      return {
        ...state,
        meltHistory: history,
        elapsedMs: 0,
        meltAnimOffsetMs: 0,
        meltComplete: false,
        meltOutcomeAction: null,
        didBreakPR: false,
        sessionStartedAt: new Date().toISOString(),
      };
    }
    case "SET_MELT_ANIM_SPEED":
      return {
        ...state,
        meltAnimSpeed: Math.max(1, Math.min(600, action.speed)),
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
      if (state.breakSource === "shared") return state;
      return {
        ...state,
        session: "LOCKED_IN",
        breakSource: null,
        lastOutcome: state.didBreakPR ? "pr" : "solid",
      };
    case "START_BREAK": {
      if (state.session !== "CHOOSING_BREAK") return state;
      const durationMs =
        action.mode === "count_down"
          ? Math.max(60_000, action.durationMs ?? 15 * 60_000)
          : 0;
      return applyBreakStart(state, action.typeId, action.mode, durationMs);
    }
    case "START_SHARED_BREAK": {
      if (state.session !== "LOCKED_IN" && state.session !== "CHOOSING_BREAK") {
        return state;
      }
      const typeId = action.typeId ?? pickRandomBreakType().id;
      const durationMs = action.durationMs ?? 5 * 60 * 1000;
      return applyBreakStart(
        { ...state, breakSource: "shared" },
        typeId,
        "count_down",
        durationMs,
      );
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
    case "LOCK_BACK_IN": {
      if (
        state.session !== "BREAK_DONE" &&
        state.session !== "ON_BREAK" &&
        state.session !== "CHOOSING_BREAK"
      ) {
        return state;
      }
      if (
        state.session === "CHOOSING_BREAK" &&
        state.breakSource === "shared"
      ) {
        return state;
      }
      const breakHistory =
        state.session === "ON_BREAK" || state.session === "BREAK_DONE"
          ? appendBreakSegment(state)
          : state.breakHistory;
      return {
        ...state,
        session: "LOCKED_IN",
        breakHistory,
        ...clearBreakFields(),
        lastOutcome: state.didBreakPR ? "pr" : "solid",
      };
    }
    case "END_SESSION": {
      if (
        state.session !== "BREAK_DONE" &&
        state.session !== "LOCKED_IN" &&
        state.session !== "ON_BREAK" &&
        state.session !== "CHOOSING_BREAK"
      ) {
        return state;
      }
      const breakHistory =
        state.session === "ON_BREAK" || state.session === "BREAK_DONE"
          ? appendBreakSegment(state)
          : state.breakHistory;
      return {
        ...state,
        session: "ENDED",
        lastSessionMs: state.elapsedMs,
        lastOutcome: state.didBreakPR ? "pr" : "solid",
        breakHistory,
        ...clearBreakFields(),
        remoteSessionId: null,
      };
    }
    case "TICK": {
      if (state.session !== "LOCKED_IN") return state;
      const elapsedMs = state.elapsedMs + action.delta;
      // First PR (personalRecordMs === 0) and subsequent PRs fire once per session.
      // lastOutcome === "pr" stays sticky so CLEAR_PR_BURST does not re-trigger confetti.
      const justBroke =
        elapsedMs > 0 &&
        state.lastOutcome !== "pr" &&
        state.elapsedMs <= state.personalRecordMs &&
        elapsedMs > state.personalRecordMs;
      return {
        ...state,
        elapsedMs,
        // todayTotalMs stays as hydrated base; UI adds in-session elapsed.
        personalRecordMs:
          elapsedMs > state.personalRecordMs
            ? elapsedMs
            : state.personalRecordMs,
        didBreakPR: justBroke ? true : state.didBreakPR,
        lastOutcome:
          justBroke || elapsedMs > state.personalRecordMs ? "pr" : "solid",
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
