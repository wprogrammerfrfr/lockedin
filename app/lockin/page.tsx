"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import { AppShell, type LayoutMode } from "@/components/layout/AppShell";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { FocusTimer } from "@/components/session/FocusTimer";
import { LockInHeader } from "@/components/session/LockInHeader";
import { PitStopDialog } from "@/components/session/PitStopDialog";
import { ShareCardDialog } from "@/components/session/ShareCardDialog";
import { ActiveSessionDialog } from "@/components/session/ActiveSessionDialog";
import { WeeklyLeaderboard } from "@/components/social/WeeklyLeaderboard";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import {
  mergeLocalSessionsIntoUser,
  saveLocalSessionDraft,
} from "@/lib/auth/merge";
import { cn } from "@/lib/utils";
import { initialState, reducer } from "@/features/session/reducer";
import { resolveOutcome } from "@/features/session/format";
import { useDocumentSessionChrome } from "@/features/session/useDocumentSessionChrome";
import { useSessionHotkeys } from "@/features/session/useSessionHotkeys";
import { useSessionClock } from "@/features/session/useSessionClock";
import {
  ActiveSessionExistsError,
  endSession,
  heartbeatSession,
  startSession,
  tapOutSession,
} from "@/features/session/sync";
import type { SessionRow } from "@/types/database";
import {
  replayOfflineQueue,
  type OfflineOp,
} from "@/features/session/offlineQueue";

function isFocusSession(
  session: (typeof initialState)["session"],
): boolean {
  return (
    session === "LOCKED_IN" ||
    session === "ON_BREAK" ||
    session === "CHOOSING_BREAK" ||
    session === "BREAK_DONE"
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newClientId() {
  return crypto.randomUUID();
}

function sessionClientId(existing: string | null): string {
  if (existing && UUID_RE.test(existing)) return existing;
  return newClientId();
}

export default function LockInPage() {
  const { status, isAuthenticated, user } = useAuth();
  const authReady = status !== "loading";
  const userId = user?.id ?? null;
  const [state, dispatch] = useReducer(reducer, initialState);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [sessionNameDraft, setSessionNameDraft] = useState("");
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictSession, setConflictSession] = useState<SessionRow | null>(
    null,
  );
  const [timezone, setTimezone] = useState("UTC");
  const [lastRemoteId, setLastRemoteId] = useState<string | null>(null);

  const layoutMode: LayoutMode = isFocusSession(state.session)
    ? "solo-focus"
    : "chrome";

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("timezone")
          .eq("id", userId)
          .maybeSingle();
        if (!cancelled && profile?.timezone) setTimezone(profile.timezone);
      } catch {
        /* profiles may be unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await mergeLocalSessionsIntoUser(createClient());
        if (cancelled) return;
        if (!result.ok && result.error) {
          toast.error(userFacingError(result.error, "Could not sync guest sessions"));
        } else if (result.merged > 0) {
          toast.success(
            result.merged === 1
              ? "Synced 1 guest session"
              : `Synced ${result.merged} guest sessions`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(userFacingError(err, "Could not sync guest sessions"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;
    void replayOfflineQueue(async (op: OfflineOp) => {
      const sb = createClient();
      if (op.kind === "heartbeat") {
        await heartbeatSession(sb, {
          id: op.sessionId,
          activeMs: op.activeMs,
          breakMs: op.breakMs,
          breakTypes: op.breakTypes,
          status: op.status,
        });
      } else if (op.kind === "end") {
        await endSession(sb, {
          id: op.sessionId,
          activeMs: op.activeMs,
          breakMs: op.breakMs,
          breakTypes: op.breakTypes,
          outcome: op.outcome,
          prBroken: op.prBroken,
        });
      } else {
        await tapOutSession(sb, {
          id: op.sessionId,
          activeMs: op.activeMs,
          breakMs: op.breakMs,
          breakTypes: op.breakTypes,
          outcome: op.outcome,
          prBroken: op.prBroken,
        });
      }
    }).catch(() => undefined);
  }, [authReady]);

  useSessionClock(state, dispatch);

  useEffect(() => {
    if (state.session === "ENDED" || state.session === "TAPPED_OUT") {
      setSessionNameDraft("");
    }
  }, [state.session]);

  const onLockIn = useCallback(async () => {
    if (!authReady) return;

    if (!isAuthenticated) {
      dispatch({ type: "LOCK_IN", sessionName: sessionNameDraft });
      return;
    }

    const supabase = createClient();
    const clientId = sessionClientId(state.clientId);

    try {
      const row = await startSession(supabase, {
        sessionName: sessionNameDraft,
        clientId,
      });
      setLastRemoteId(row.id);
      dispatch({
        type: "LOCK_IN",
        sessionName: sessionNameDraft,
        remoteSessionId: row.id,
        clientId,
      });
    } catch (err) {
      if (err instanceof ActiveSessionExistsError) {
        setConflictSession(err.existing);
        setConflictOpen(true);
        return;
      }
      console.error("start_session failed", err);
      toast.error(userFacingError(err, "Could not start session"));
    }
  }, [authReady, isAuthenticated, sessionNameDraft, state.clientId]);

  const onBreak = useCallback(() => {
    dispatch({ type: "OPEN_PIT_STOP" });
  }, []);

  const persistGuestDraft = useCallback(
    (outcome: string) => {
      if (isAuthenticated) return;
      saveLocalSessionDraft({
        sessionName: state.sessionName,
        elapsedMs: state.elapsedMs,
        outcome,
        breakTypesUsed: state.breakTypesUsed,
      });
    },
    [
      isAuthenticated,
      state.breakTypesUsed,
      state.elapsedMs,
      state.sessionName,
    ],
  );

  const onTapOut = useCallback(async () => {
    if (isAuthenticated && state.remoteSessionId) {
      try {
        await tapOutSession(createClient(), {
          id: state.remoteSessionId,
          activeMs: state.elapsedMs,
          breakMs: 0,
          breakTypes: state.breakTypesUsed,
          outcome: "tapout",
          prBroken: state.didBreakPR,
        });
        dispatch({ type: "TAP_OUT" });
      } catch (err) {
        toast.error(userFacingError(err, "Tap out sync failed"));
      }
      return;
    }
    persistGuestDraft("tapout");
    dispatch({ type: "TAP_OUT" });
  }, [
    isAuthenticated,
    persistGuestDraft,
    state.breakTypesUsed,
    state.didBreakPR,
    state.elapsedMs,
    state.remoteSessionId,
  ]);

  const onEndSession = useCallback(async () => {
    if (isAuthenticated && state.remoteSessionId) {
      try {
        await endSession(createClient(), {
          id: state.remoteSessionId,
          activeMs: state.elapsedMs,
          breakMs: 0,
          breakTypes: state.breakTypesUsed,
          outcome: state.didBreakPR ? "pr" : "solid",
          prBroken: state.didBreakPR,
        });
        setLastRemoteId(state.remoteSessionId);
        dispatch({ type: "END_SESSION" });
      } catch (err) {
        toast.error(userFacingError(err, "End sync failed"));
      }
      return;
    }
    persistGuestDraft(state.didBreakPR ? "pr" : "solid");
    dispatch({ type: "END_SESSION" });
  }, [
    isAuthenticated,
    persistGuestDraft,
    state.breakTypesUsed,
    state.didBreakPR,
    state.elapsedMs,
    state.remoteSessionId,
  ]);

  const hotkeyHandlers = useMemo(
    () => ({
      onLockIn: () => {
        void onLockIn();
      },
      onBreak,
      onTapOut: () => {
        void onTapOut();
      },
    }),
    [onLockIn, onBreak, onTapOut],
  );

  useSessionHotkeys(state.session, hotkeyHandlers);
  useDocumentSessionChrome(
    state.session,
    state.elapsedMs,
    state.breakRemainingMs,
  );

  const shareDuration =
    state.lastSessionMs || state.elapsedMs || state.personalRecordMs;
  const shareOutcome = resolveOutcome(
    state.session,
    state.lastOutcome,
    state.didBreakPR,
  );

  const muted = state.session === "TAPPED_OUT";

  return (
    <AppShell
      layoutMode={layoutMode}
      idleLeft={
        layoutMode === "chrome" ? (
          <WeeklyLeaderboard timezone={timezone} />
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col",
          layoutMode === "solo-focus"
            ? "max-w-6xl gap-0"
            : "max-w-5xl gap-8",
        )}
      >
        {layoutMode !== "solo-focus" && (
          <LockInHeader streak={state.streak} muted={muted} />
        )}

        <FocusTimer
          state={state.session}
          elapsedMs={state.elapsedMs}
          todayTotalMs={state.todayTotalMs}
          personalRecordMs={state.personalRecordMs}
          didBreakPR={state.didBreakPR}
          breakRemainingMs={state.breakRemainingMs}
          breakLabel={state.breakLabel}
          breakEmoji={state.breakEmoji}
          sessionName={
            isFocusSession(state.session)
              ? sessionNameDraft.trim() || state.sessionName || ""
              : sessionNameDraft
          }
          onSessionNameChange={setSessionNameDraft}
          onLockIn={() => {
            void onLockIn();
          }}
          onPitStop={onBreak}
          onLockBackIn={() => dispatch({ type: "LOCK_BACK_IN" })}
          onEndSession={() => {
            void onEndSession();
          }}
          onTapOut={() => {
            void onTapOut();
          }}
          onShare={() => dispatch({ type: "OPEN_SHARE" })}
          onClearPrBurst={() => dispatch({ type: "CLEAR_PR_BURST" })}
          lockInDisabled={!authReady}
        />

        <PitStopDialog
          open={state.session === "CHOOSING_BREAK"}
          onClose={() => dispatch({ type: "CLOSE_PIT_STOP" })}
          onSelect={(choice) => dispatch({ type: "START_BREAK", choice })}
        />
      </div>

      <ShareCardDialog
        open={state.shareOpen}
        onOpenChange={(open) =>
          dispatch({ type: open ? "OPEN_SHARE" : "CLOSE_SHARE" })
        }
        durationMs={shareDuration}
        outcome={shareOutcome}
        sessionId={lastRemoteId}
        canPost={isAuthenticated && Boolean(lastRemoteId)}
        sessionName={state.sessionName}
      />

      <ActiveSessionDialog
        open={conflictOpen}
        existing={conflictSession}
        onCancel={() => setConflictOpen(false)}
        onResume={() => {
          if (!conflictSession) return;
          setConflictOpen(false);
          setLastRemoteId(conflictSession.id);
          dispatch({
            type: "HYDRATE_REMOTE",
            remoteSessionId: conflictSession.id,
            clientId: conflictSession.client_id,
            elapsedMs: Number(conflictSession.active_ms) || 0,
            sessionName: conflictSession.session_name,
            session:
              conflictSession.status === "on_break" ? "ON_BREAK" : "LOCKED_IN",
          });
        }}
        onTapOut={async () => {
          if (!conflictSession) return;
          try {
            await tapOutSession(createClient(), {
              id: conflictSession.id,
              activeMs: Number(conflictSession.active_ms) || 0,
              breakMs: Number(conflictSession.break_ms) || 0,
              breakTypes: conflictSession.break_types_used,
              outcome: "tapout",
            });
            setConflictOpen(false);
            setConflictSession(null);
            toast.success("Remote session tapped out — try LOCK IN again");
          } catch (err) {
            toast.error(userFacingError(err, "Could not tap out remote"));
          }
        }}
      />

      <AuthGateModal
        open={authGateOpen}
        onOpenChange={setAuthGateOpen}
        reason="join_room"
        onContinueAsGuest={() => {
          setAuthGateOpen(false);
        }}
      />
    </AppShell>
  );
}
