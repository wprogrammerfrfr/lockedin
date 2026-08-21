"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { Action, AppState, SessionState } from "@/features/session/types";
import {
  endSessionKeepalive,
  heartbeatSession,
} from "@/features/session/sync";
import { enqueueOfflineOp } from "@/features/session/offlineQueue";
import {
  clearActiveSessionDraft,
  finalizeActiveSessionDraft,
  saveActiveSessionDraft,
} from "@/lib/auth/merge";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_MS = 15_000;
const GUEST_DRAFT_MS = 10_000;

function isFocusSession(session: SessionState): boolean {
  return (
    session === "LOCKED_IN" ||
    session === "ON_BREAK" ||
    session === "CHOOSING_BREAK" ||
    session === "BREAK_DONE"
  );
}

/**
 * Focus + break tick intervals, plus a 15s heartbeat when `remoteSessionId` is set.
 * On pagehide/beforeunload: auto-end authenticated sessions (keepalive) and
 * finalize guest mid-session drafts.
 */
export function useSessionClock(
  state: AppState,
  dispatch: Dispatch<Action>,
  opts?: { enabled?: boolean; isAuthenticated?: boolean },
) {
  const enabled = opts?.enabled ?? true;
  const isAuthenticated = opts?.isAuthenticated ?? false;
  const lastFocusTick = useRef<number | null>(null);
  const lastBreakTick = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const accessTokenRef = useRef<string | null>(null);
  const endedRemoteIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || state.session !== "LOCKED_IN") {
      lastFocusTick.current = null;
      return;
    }

    const id = window.setInterval(() => {
      const now = performance.now();
      if (lastFocusTick.current == null) {
        lastFocusTick.current = now;
        return;
      }
      const delta = now - lastFocusTick.current;
      lastFocusTick.current = now;
      dispatch({ type: "TICK", delta });
    }, 50);

    return () => window.clearInterval(id);
  }, [dispatch, enabled, state.session]);

  useEffect(() => {
    if (!enabled || state.session !== "ON_BREAK") {
      lastBreakTick.current = null;
      return;
    }

    const id = window.setInterval(() => {
      const now = performance.now();
      if (lastBreakTick.current == null) {
        lastBreakTick.current = now;
        return;
      }
      const delta = now - lastBreakTick.current;
      lastBreakTick.current = now;
      dispatch({ type: "BREAK_TICK", delta });
    }, 50);

    return () => window.clearInterval(id);
  }, [dispatch, enabled, state.session]);

  useEffect(() => {
    if (!enabled || !state.remoteSessionId) return;

    const refreshToken = () => {
      void createClient()
        .auth.getSession()
        .then(({ data }) => {
          accessTokenRef.current = data.session?.access_token ?? null;
        })
        .catch(() => undefined);
    };
    refreshToken();

    const flushHeartbeat = () => {
      const s = stateRef.current;
      if (!s.remoteSessionId) return;
      const supabase = createClient();
      const status =
        s.session === "ON_BREAK" ||
        s.session === "CHOOSING_BREAK" ||
        s.session === "BREAK_DONE"
          ? "on_break"
          : "active";
      void heartbeatSession(supabase, {
        id: s.remoteSessionId,
        activeMs: s.elapsedMs,
        breakMs: s.breakMs,
        breakTypes: s.breakTypesUsed,
        status,
      })
        .then(() => refreshToken())
        .catch(() => {
          /* offline queue handles retry */
        });
    };

    const id = window.setInterval(flushHeartbeat, HEARTBEAT_MS);

    const onVis = () => {
      if (document.visibilityState === "hidden") flushHeartbeat();
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, state.remoteSessionId]);

  // Guest: persist mid-session draft periodically + on hide
  useEffect(() => {
    if (!enabled || isAuthenticated) return;

    const persist = () => {
      const s = stateRef.current;
      if (!isFocusSession(s.session)) {
        clearActiveSessionDraft();
        return;
      }
      saveActiveSessionDraft({
        sessionName: s.sessionName,
        elapsedMs: s.elapsedMs,
        breakMs: s.breakMs,
        breakTypesUsed: s.breakTypesUsed,
        personalRecordMs: s.personalRecordMs,
        didBreakPR: s.didBreakPR,
      });
    };

    if (isFocusSession(state.session)) persist();
    else clearActiveSessionDraft();

    const id = window.setInterval(persist, GUEST_DRAFT_MS);
    const onVis = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, isAuthenticated, state.session]);

  // Unexpected close → auto-end (authenticated keepalive + guest finalize)
  useEffect(() => {
    if (!enabled) return;

    const finalizeUnexpected = () => {
      const s = stateRef.current;
      if (!isFocusSession(s.session)) return;

      if (s.remoteSessionId) {
        if (endedRemoteIdsRef.current.has(s.remoteSessionId)) return;
        endedRemoteIdsRef.current.add(s.remoteSessionId);

        const payload = {
          id: s.remoteSessionId,
          activeMs: s.elapsedMs,
          breakMs: s.breakMs,
          breakTypes: s.breakTypesUsed,
          outcome: s.didBreakPR ? "pr" : "solid",
          prBroken: s.didBreakPR,
        };

        void enqueueOfflineOp({
          kind: "end",
          sessionId: payload.id,
          activeMs: payload.activeMs,
          breakMs: payload.breakMs,
          breakTypes: payload.breakTypes,
          outcome: payload.outcome,
          prBroken: payload.prBroken,
          at: Date.now(),
        });

        endSessionKeepalive(payload, accessTokenRef.current);
        return;
      }

      if (!isAuthenticated) {
        finalizeActiveSessionDraft(
          s.didBreakPR ? "pr" : "solid",
          s.didBreakPR,
        );
      }
    };

    const onPageHide = (event: PageTransitionEvent) => {
      // bfcache: page may come back — only persist progress, don't finalize
      if (event.persisted) {
        const s = stateRef.current;
        if (s.remoteSessionId && isFocusSession(s.session)) {
          void enqueueOfflineOp({
            kind: "heartbeat",
            sessionId: s.remoteSessionId,
            activeMs: s.elapsedMs,
            breakMs: s.breakMs,
            breakTypes: s.breakTypesUsed,
            status:
              s.session === "ON_BREAK" ||
              s.session === "CHOOSING_BREAK" ||
              s.session === "BREAK_DONE"
                ? "on_break"
                : "active",
            at: Date.now(),
          });
        } else if (!isAuthenticated && isFocusSession(s.session)) {
          saveActiveSessionDraft({
            sessionName: s.sessionName,
            elapsedMs: s.elapsedMs,
            breakMs: s.breakMs,
            breakTypesUsed: s.breakTypesUsed,
            personalRecordMs: s.personalRecordMs,
            didBreakPR: s.didBreakPR,
          });
        }
        return;
      }
      finalizeUnexpected();
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", finalizeUnexpected);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", finalizeUnexpected);
    };
  }, [enabled, isAuthenticated]);
}
