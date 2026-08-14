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
};

export function useSessionHotkeys(session: SessionState, handlers: Handlers) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event)) return;
      if (isDialogOpen() && !matchTapOut(event)) return;

      if (matchLockIn(event)) {
        if (
          session === "IDLE" ||
          session === "ENDED" ||
          session === "TAPPED_OUT"
        ) {
          event.preventDefault();
          handlers.onLockIn();
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
        if (isDialogOpen()) return;
        if (
          session === "LOCKED_IN" ||
          session === "ON_BREAK" ||
          session === "CHOOSING_BREAK" ||
          session === "BREAK_DONE"
        ) {
          event.preventDefault();
          handlers.onTapOut();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session, handlers]);
}
