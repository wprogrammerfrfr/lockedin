"use client";

import { useEffect, useRef } from "react";
import {
  replayOfflineQueue,
  type OfflineOp,
} from "@/features/session/offlineQueue";
import {
  endSession,
  heartbeatSession,
  tapOutSession,
} from "@/features/session/sync";
import { createClient } from "@/lib/supabase/client";

let replayInFlight: Promise<{ replayed: number; remaining?: number }> | null =
  null;

async function runOfflineOp(op: OfflineOp) {
  const supabase = createClient();
  if (op.kind === "heartbeat") {
    await heartbeatSession(supabase, {
      id: op.sessionId,
      activeMs: op.activeMs,
      breakMs: op.breakMs,
      breakTypes: op.breakTypes,
      status: op.status,
    });
    return;
  }

  const payload = {
    id: op.sessionId,
    activeMs: op.activeMs,
    breakMs: op.breakMs,
    breakTypes: op.breakTypes,
    breakHistory: op.breakHistory,
    outcome: op.outcome,
    prBroken: op.prBroken,
    dessertMetadata: op.dessertMetadata,
  };
  if (op.kind === "end") await endSession(supabase, payload);
  else await tapOutSession(supabase, payload);
}

function replayOnce() {
  if (!replayInFlight) {
    replayInFlight = replayOfflineQueue(runOfflineOp).finally(() => {
      replayInFlight = null;
    });
  }
  return replayInFlight;
}

export function useOfflineQueueReplay(
  enabled: boolean,
  onReplayed?: (count: number) => void,
) {
  const onReplayedRef = useRef(onReplayed);
  useEffect(() => {
    onReplayedRef.current = onReplayed;
  }, [onReplayed]);

  useEffect(() => {
    if (!enabled) return;

    const replay = () => {
      if (navigator.onLine === false) return;
      void replayOnce()
        .then(({ replayed }) => {
          if (replayed > 0) onReplayedRef.current?.(replayed);
        })
        .catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") replay();
    };

    replay();
    window.addEventListener("online", replay);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", replay);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
