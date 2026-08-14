"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { Action, AppState } from "@/features/session/types";
import { heartbeatSession } from "@/features/session/sync";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_MS = 15_000;

/**
 * Focus + break tick intervals, plus a 15s heartbeat when `remoteSessionId` is set.
 */
export function useSessionClock(
  state: AppState,
  dispatch: Dispatch<Action>,
  opts?: { enabled?: boolean },
) {
  const enabled = opts?.enabled ?? true;
  const lastFocusTick = useRef<number | null>(null);
  const lastBreakTick = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

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

    const flush = () => {
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
      }).catch(() => {
        /* offline queue handles retry */
      });
    };

    const id = window.setInterval(flush, HEARTBEAT_MS);

    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onUnload = () => flush();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [enabled, state.remoteSessionId]);
}
