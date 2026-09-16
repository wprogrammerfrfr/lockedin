"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { Action, AppState, SessionState } from "@/features/session/types";
import {
  heartbeatSession,
  heartbeatSessionKeepalive,
} from "@/features/session/sync";
import { enqueueOfflineOp } from "@/features/session/offlineQueue";
import {
  clearActiveSessionDraft,
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
 * On pagehide/beforeunload: keepalive heartbeat (never end_session) and persist
 * guest mid-session drafts so the next visit can resume.
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

  useEffect(() => {
    if (!enabled || state.session !== "LOCKED_IN") {
      lastFocusTick.current = null;
      return;
    }

    lastFocusTick.current = Date.now();
    const tick = () => {
      const now = Date.now();
      if (lastFocusTick.current == null) {
        lastFocusTick.current = now;
        return;
      }
      const delta = now - lastFocusTick.current;
      lastFocusTick.current = now;
      if (delta > 0) dispatch({ type: "TICK", delta });
    };
    const id = window.setInterval(tick, 50);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    const onPageShow = () => tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [dispatch, enabled, state.session]);

  useEffect(() => {
    if (!enabled || state.session !== "ON_BREAK") {
      lastBreakTick.current = null;
      return;
    }

    lastBreakTick.current = Date.now();
    const tick = () => {
      const now = Date.now();
      if (lastBreakTick.current == null) {
        lastBreakTick.current = now;
        return;
      }
      const delta = now - lastBreakTick.current;
      lastBreakTick.current = now;
      if (delta > 0) dispatch({ type: "BREAK_TICK", delta });
    };
    const id = window.setInterval(tick, 50);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    const onPageShow = () => tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
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
      else flushHeartbeat();
    };
    const onPageShow = () => flushHeartbeat();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPageShow);
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
        startedAt: s.sessionStartedAt ?? undefined,
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

  // Unexpected close → persist progress only (heartbeat / guest draft). Never end.
  useEffect(() => {
    if (!enabled) return;

    const persistProgress = () => {
      const s = stateRef.current;
      if (!isFocusSession(s.session)) return;

      if (s.remoteSessionId) {
        const status =
          s.session === "ON_BREAK" ||
          s.session === "CHOOSING_BREAK" ||
          s.session === "BREAK_DONE"
            ? ("on_break" as const)
            : ("active" as const);
        void enqueueOfflineOp({
          kind: "heartbeat",
          sessionId: s.remoteSessionId,
          activeMs: s.elapsedMs,
          breakMs: s.breakMs,
          breakTypes: s.breakTypesUsed,
          status,
          at: Date.now(),
        });
        heartbeatSessionKeepalive(
          {
            id: s.remoteSessionId,
            activeMs: s.elapsedMs,
            breakMs: s.breakMs,
            breakTypes: s.breakTypesUsed,
            status,
          },
          accessTokenRef.current,
        );
        return;
      }

      if (!isAuthenticated) {
        saveActiveSessionDraft({
          sessionName: s.sessionName,
          elapsedMs: s.elapsedMs,
          breakMs: s.breakMs,
          breakTypesUsed: s.breakTypesUsed,
          personalRecordMs: s.personalRecordMs,
          didBreakPR: s.didBreakPR,
          startedAt: s.sessionStartedAt ?? undefined,
        });
      }
    };

    window.addEventListener("pagehide", persistProgress);
    window.addEventListener("beforeunload", persistProgress);

    return () => {
      window.removeEventListener("pagehide", persistProgress);
      window.removeEventListener("beforeunload", persistProgress);
    };
  }, [enabled, isAuthenticated]);
}
