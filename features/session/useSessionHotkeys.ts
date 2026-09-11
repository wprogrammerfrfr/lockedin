"use client";

import { useEffect } from "react";
import type { SessionState } from "@/features/session/types";
import {
  isDialogOpen,
  isTypingTarget,
  matchBreak,
  matchLockIn,
  matchTapOut,
} from "@/features/session/hotkeys";

type Handlers = {
  onLockIn: () => void;
  onBreak: () => void;
  onTapOut: () => void;
  onLockBackIn: () => void;
};

function isOnBreak(session: SessionState) {
  return (
    session === "ON_BREAK" ||
    session === "CHOOSING_BREAK" ||
    session === "BREAK_DONE"
  );
}

export function useSessionHotkeys(session: SessionState, handlers: Handlers) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event)) return;
      if (isDialogOpen() && !matchTapOut(event) && !matchLockIn(event)) return;

      if (matchLockIn(event)) {
        if (
          session === "IDLE" ||
          session === "ENDED" ||
          session === "TAPPED_OUT"
        ) {
          event.preventDefault();
          handlers.onLockIn();
        } else if (isOnBreak(session)) {
          event.preventDefault();
          handlers.onLockBackIn();
        }
        return;
      }

      if (matchBreak(event)) {
        if (session === "LOCKED_IN") {
          event.preventDefault();
          handlers.onBreak();
        }
        return;
      }

      if (matchTapOut(event)) {
        if (isDialogOpen() && session === "LOCKED_IN") return;
        if (session === "LOCKED_IN") {
          event.preventDefault();
          handlers.onTapOut();
        }
        // Escape during break is intentionally a no-op (lock-back-in is Space / Ctrl+Enter).
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session, handlers]);
}
