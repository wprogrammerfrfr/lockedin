"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import { AppShell, type LayoutMode } from "@/components/layout/AppShell";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { FocusTimer } from "@/components/session/FocusTimer";
import { LockInHeader } from "@/components/session/LockInHeader";
import { BreakStartDialog } from "@/components/session/BreakStartDialog";
import { MeltBuilderDialog } from "@/components/session/MeltBuilderDialog";
import { MeltPostActionDialog } from "@/components/session/MeltPostActionDialog";
import { ShareCardDialog } from "@/components/session/ShareCardDialog";
import { ActiveSessionDialog } from "@/components/session/ActiveSessionDialog";
import { WeeklyLeaderboard } from "@/components/social/WeeklyLeaderboard";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import {
  saveLocalSessionDraft,
  loadLocalSessionDrafts,
  finalizeActiveSessionDraft,
  clearActiveSessionDraft,
  loadActiveSessionDraft,
  isActiveSessionDraftStale,
} from "@/lib/auth/merge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { initialState, projectBreakHistory, reducer } from "@/features/session/reducer";
import {
  computePersonalRecordMs,
  computeStreak,
  computeTodayMs,
} from "@/features/session/aggregates";
import { resolveOutcome } from "@/features/session/format";
import { pickRandomBreakType } from "@/features/session/break-types";
import {
  breakTimerMs,
  loadBreakTimerMinutes,
} from "@/lib/preferences/break-timer";
import { useDocumentSessionChrome } from "@/features/session/useDocumentSessionChrome";
import { useSessionHotkeys } from "@/features/session/useSessionHotkeys";
import { useSessionClock } from "@/features/session/useSessionClock";
import { useOfflineQueueReplay } from "@/features/session/useOfflineQueueReplay";
import { hydrateRemoteFromSessionRow } from "@/features/session/hydrate-remote";
import {
  ActiveSessionExistsError,
  endSession,
  isSessionStale,
  resumeActiveSession,
  startSession,
  tapOutSession,
} from "@/features/session/sync";
import type { SessionRow } from "@/types/database";
import {
  dessertMetadataFromState,
  createMeltConfig,
  type MeltConfig,
} from "@/features/session/melt-catalog";
import {
  computeMeltProgress,
  isMeltComplete,
} from "@/features/session/melt-utils";

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
  const { t } = useTranslation();
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
  const [statsNonce, setStatsNonce] = useState(0);
  const [meltDialogDismissed, setMeltDialogDismissed] = useState(false);
  const [breakTimerMinutes, setBreakTimerMinutes] = useState(
    loadBreakTimerMinutes,
  );

  const layoutMode: LayoutMode = isFocusSession(state.session)
    ? "solo-focus"
    : "chrome";

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("timezone, break_timer_minutes")
          .eq("id", userId)
          .maybeSingle();
        if (!cancelled && profile?.timezone) setTimezone(profile.timezone);
        if (
          !cancelled &&
          profile?.break_timer_minutes &&
          profile.break_timer_minutes >= 1
        ) {
          setBreakTimerMinutes(profile.break_timer_minutes);
        }
      } catch {
        /* profiles may be unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!authReady) return;
    if (isFocusSession(state.session)) return;

    let cancelled = false;
    const tz =
      timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";

    void (async () => {
      if (!isAuthenticated || !userId) {
        const sessions = loadLocalSessionDrafts().map((d) => {
          const endedAt = d.endedAt;
          const activeMs = d.elapsedMs;
          const startedAt =
            d.startedAt ||
            new Date(
              new Date(endedAt).getTime() - Math.max(0, activeMs),
            ).toISOString();
          return {
            started_at: startedAt,
            active_ms: activeMs,
            status: d.outcome === "tapout" ? "tapped_out" : "ended",
          };
        });
        if (cancelled) return;
        dispatch({
          type: "HYDRATE_STATS",
          streak: computeStreak(sessions, tz),
          todayTotalMs: computeTodayMs(sessions, tz),
          personalRecordMs: computePersonalRecordMs(sessions),
        });
        return;
      }

      try {
        const { data, error } = await createClient().rpc("dashboard_stats", {
          p_tz: tz,
        });
        if (cancelled || error) return;
        const stats = (data ?? {}) as {
          streak_days?: number;
          today_ms?: number;
          pr_ms?: number;
        };
        dispatch({
          type: "HYDRATE_STATS",
          streak: Number(stats.streak_days) || 0,
          todayTotalMs: Number(stats.today_ms) || 0,
          personalRecordMs: Number(stats.pr_ms) || 0,
        });
      } catch {
        /* keep current stats */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, userId, timezone, state.session, statsNonce]);

  useOfflineQueueReplay(authReady, () => setStatsNonce((n) => n + 1));

  // Resume non-stale cloud sessions; only auto-end true orphans (stale)
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (isFocusSession(state.session)) return;

    let cancelled = false;
    void (async () => {
      try {
        const sb = createClient();
        const existing = await resumeActiveSession(sb);
        if (cancelled || !existing) return;

        if (!isSessionStale(existing)) {
          setLastRemoteId(existing.id);
          dispatch(hydrateRemoteFromSessionRow(existing));
          toast.message("Resumed your session");
          return;
        }

        const activeMs = Number(existing.active_ms) || 0;
        const breakMs = Number(existing.break_ms) || 0;
        let prMs = 0;
        try {
          const tz =
            timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "UTC";
          const { data } = await sb.rpc("dashboard_stats", { p_tz: tz });
          prMs = Number((data as { pr_ms?: number } | null)?.pr_ms) || 0;
        } catch {
          prMs = 0;
        }
        const prBroken = activeMs > prMs && activeMs > 0;

        await endSession(sb, {
          id: existing.id,
          activeMs,
          breakMs,
          breakTypes: existing.break_types_used,
          outcome: prBroken ? "pr" : "solid",
          prBroken,
        });
        if (cancelled) return;
        setLastRemoteId(existing.id);
        setStatsNonce((n) => n + 1);
        toast.success(
          prBroken
            ? "Saved your last session — new PR"
            : "Saved your last session",
        );
      } catch {
        /* leave conflict dialog to handle on next LOCK IN */
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only on auth / idle entry — not every session tick
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount/auth gate
  }, [authReady, isAuthenticated, timezone]);

  // Guest: restore fresh mid-session draft; finalize only when stale
  useEffect(() => {
    if (!authReady || isAuthenticated) return;
    if (isFocusSession(state.session)) return;

    const draft = loadActiveSessionDraft();
    if (!draft) return;

    if (!isActiveSessionDraftStale(draft) && (draft.elapsedMs || 0) > 0) {
      dispatch({
        type: "HYDRATE_GUEST_DRAFT",
        sessionName: draft.sessionName,
        elapsedMs: draft.elapsedMs,
        breakMs: draft.breakMs,
        breakTypesUsed: draft.breakTypesUsed,
        personalRecordMs: draft.personalRecordMs,
        didBreakPR: draft.didBreakPR,
        session: (draft.breakMs || 0) > 0 ? "ON_BREAK" : "LOCKED_IN",
      });
      toast.message("Resumed your session");
      return;
    }

    const finished = finalizeActiveSessionDraft();
    if (finished) {
      setStatsNonce((n) => n + 1);
      toast.success(
        finished.outcome === "pr"
          ? "Saved your last session — new PR"
          : "Saved your last session",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once when idle after auth ready
  }, [authReady, isAuthenticated]);

  useSessionClock(state, dispatch, { isAuthenticated });

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
        const existing = err.existing;
        if (existing && isSessionStale(existing)) {
          try {
            const activeMs = Number(existing.active_ms) || 0;
            const breakMs = Number(existing.break_ms) || 0;
            const prBroken = activeMs > state.personalRecordMs && activeMs > 0;
            await endSession(createClient(), {
              id: existing.id,
              activeMs,
              breakMs,
              breakTypes: existing.break_types_used,
              outcome: prBroken ? "pr" : "solid",
              prBroken,
            });
            setStatsNonce((n) => n + 1);
            const row = await startSession(createClient(), {
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
            return;
          } catch (retryErr) {
            console.error("stale session auto-end failed", retryErr);
          }
        }
        setConflictSession(existing);
        setConflictOpen(true);
        return;
      }
      console.error("start_session failed", err);
      toast.error(userFacingError(err, "Could not start session"));
    }
  }, [
    authReady,
    isAuthenticated,
    sessionNameDraft,
    state.clientId,
    state.personalRecordMs,
  ]);

  const onBreak = useCallback(() => {
    dispatch({ type: "OPEN_PIT_STOP" });
  }, []);

  const persistGuestDraft = useCallback(
    (outcome: string) => {
      if (isAuthenticated) return;
      clearActiveSessionDraft();
      saveLocalSessionDraft({
        sessionName: state.sessionName,
        elapsedMs: state.elapsedMs,
        breakMs: state.breakMs,
        outcome,
        breakTypesUsed: state.breakTypesUsed,
        startedAt: state.sessionStartedAt ?? undefined,
      });
    },
    [
      isAuthenticated,
      state.breakTypesUsed,
      state.breakMs,
      state.elapsedMs,
      state.sessionName,
      state.sessionStartedAt,
    ],
  );

  const onTapOut = useCallback(async () => {
    const meta = dessertMetadataFromState(
      state.meltConfig,
      state.meltAnimOffsetMs,
      state.elapsedMs,
      state.meltComplete,
      state.meltOutcomeAction,
      state.meltHistory,
    );
    if (isAuthenticated && state.remoteSessionId) {
      try {
        await tapOutSession(createClient(), {
          id: state.remoteSessionId,
          activeMs: state.elapsedMs,
          breakMs: state.breakMs,
          breakTypes: state.breakTypesUsed,
          breakHistory: projectBreakHistory(state),
          outcome: "tapout",
          prBroken: state.didBreakPR,
          dessertMetadata: meta,
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
    state.breakMs,
    state.didBreakPR,
    state.elapsedMs,
    state.remoteSessionId,
    state.meltConfig,
    state.meltAnimOffsetMs,
    state.meltComplete,
    state.meltOutcomeAction,
    state.meltHistory,
  ]);

  const onEndSession = useCallback(async () => {
    const meta = dessertMetadataFromState(
      state.meltConfig,
      state.meltAnimOffsetMs,
      state.elapsedMs,
      state.meltComplete,
      state.meltOutcomeAction,
      state.meltHistory,
    );
    if (isAuthenticated && state.remoteSessionId) {
      try {
        await endSession(createClient(), {
          id: state.remoteSessionId,
          activeMs: state.elapsedMs,
          breakMs: state.breakMs,
          breakTypes: state.breakTypesUsed,
          breakHistory: projectBreakHistory(state),
          outcome: state.didBreakPR ? "pr" : "solid",
          prBroken: state.didBreakPR,
          dessertMetadata: meta,
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
    state.breakMs,
    state.didBreakPR,
    state.elapsedMs,
    state.remoteSessionId,
    state.meltConfig,
    state.meltAnimOffsetMs,
    state.meltComplete,
    state.meltOutcomeAction,
    state.meltHistory,
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
      onLockBackIn: () => dispatch({ type: "LOCK_BACK_IN" }),
    }),
    [onLockIn, onBreak, onTapOut],
  );

  useSessionHotkeys(state.session, hotkeyHandlers);
  useDocumentSessionChrome(
    state.session,
    state.elapsedMs,
    state.breakOpenEnded ? state.breakElapsedMs : state.breakRemainingMs,
  );

  const meltProgress = state.meltConfig
    ? computeMeltProgress(
        state.elapsedMs,
        state.meltAnimOffsetMs,
        state.meltConfig.meltDurationMs,
        state.meltAnimSpeed,
      )
    : 0;

  useEffect(() => {
    if (!state.meltComplete) {
      setMeltDialogDismissed(false);
    }
  }, [state.meltComplete]);

  useEffect(() => {
    const inMeltSession =
      state.session === "LOCKED_IN" ||
      state.session === "ON_BREAK" ||
      state.session === "CHOOSING_BREAK";
    if (
      inMeltSession &&
      state.meltConfig &&
      !state.meltComplete &&
      isMeltComplete(meltProgress)
    ) {
      dispatch({ type: "MELT_COMPLETE" });
      toast.success(t("melt.complete.title"), {
        description: t("melt.complete.desc"),
      });
    }
  }, [
    state.session,
    state.meltConfig,
    state.meltComplete,
    meltProgress,
    t,
  ]);

  const dessertMetadata = dessertMetadataFromState(
    state.meltConfig,
    state.meltAnimOffsetMs,
    state.elapsedMs,
    state.meltComplete,
    state.meltOutcomeAction,
    state.meltHistory,
  );

  const onMeltLockIn = useCallback(
    async (config: MeltConfig) => {
      if (!authReady) return;

      if (!isAuthenticated) {
        dispatch({ type: "LOCK_IN", sessionName: sessionNameDraft, meltConfig: config });
        return;
      }

      const supabase = createClient();
      const clientId = sessionClientId(state.clientId);

      try {
        const row = await startSession(supabase, {
          sessionName: sessionNameDraft,
          clientId,
          dessertMetadata: { active: { config, meltProgress: 0, meltComplete: false, outcomeAction: null }, history: [] },
        });
        setLastRemoteId(row.id);
        dispatch({
          type: "LOCK_IN",
          sessionName: sessionNameDraft,
          remoteSessionId: row.id,
          clientId,
          meltConfig: config,
        });
      } catch (err) {
        if (err instanceof ActiveSessionExistsError) {
          setConflictSession(err.existing);
          setConflictOpen(true);
          return;
        }
        toast.error(userFacingError(err, "Could not start melt session"));
      }
    },
    [authReady, isAuthenticated, sessionNameDraft, state.clientId],
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
            : "max-w-5xl gap-8 lg:min-h-[calc(100svh-6rem)] lg:justify-center",
        )}
      >
        {layoutMode !== "solo-focus" && (
          <LockInHeader streak={state.streak} muted={muted} />
        )}

        <FocusTimer
          state={state.session}
          elapsedMs={state.elapsedMs}
          todayTotalMs={
            state.todayTotalMs +
            (state.session === "LOCKED_IN" ? state.elapsedMs : 0)
          }
          personalRecordMs={state.personalRecordMs}
          didBreakPR={state.didBreakPR}
          breakRemainingMs={state.breakRemainingMs}
          breakElapsedMs={state.breakElapsedMs}
          breakOpenEnded={state.breakOpenEnded}
          breakTypeId={state.breakTypeId}
          breakDurationMs={state.breakDurationMs}
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
          meltConfig={state.meltConfig}
          meltProgress={meltProgress}
          meltAnimSpeed={state.meltAnimSpeed}
          meltComplete={state.meltComplete}
          onMeltIt={() => dispatch({ type: "OPEN_MELT_BUILDER" })}
          onSpeedUpMelt={() =>
            dispatch({
              type: "SET_MELT_ANIM_SPEED",
              speed: state.meltAnimSpeed >= 120 ? 1 : state.meltAnimSpeed * 4,
            })
          }
        />

        <MeltBuilderDialog
          open={state.meltBuilderOpen}
          onClose={() => dispatch({ type: "CLOSE_MELT_BUILDER" })}
          onMeltIt={(config) => {
            void onMeltLockIn(config);
          }}
          variant="solo"
        />

        <MeltPostActionDialog
          open={
            state.meltComplete &&
            Boolean(state.meltConfig) &&
            !meltDialogDismissed
          }
          config={state.meltConfig ?? createMeltConfig({ kind: "iceCream" })}
          onAction={(action) => {
            if (action === "refreeze_restart") {
              const prevElapsed = state.elapsedMs;
              const prevId = state.remoteSessionId;
              const prevBreak = state.breakMs;
              const prevTypes = state.breakTypesUsed;
              const prevHistory = projectBreakHistory(state);
              const prevMeta = dessertMetadataFromState(
                state.meltConfig,
                state.meltAnimOffsetMs,
                prevElapsed,
                true,
                "refreeze_restart",
                state.meltHistory,
              );
              const meltConfig = state.meltConfig;
              dispatch({ type: "MELT_POST_ACTION", action });
              if (isAuthenticated && prevId && meltConfig) {
                void (async () => {
                  try {
                    await endSession(createClient(), {
                      id: prevId,
                      activeMs: prevElapsed,
                      breakMs: prevBreak,
                      breakTypes: prevTypes,
                      breakHistory: prevHistory,
                      outcome: "solid",
                      prBroken: false,
                      dessertMetadata: prevMeta,
                    });
                    const clientId = sessionClientId(state.clientId);
                    const row = await startSession(createClient(), {
                      sessionName: state.sessionName,
                      clientId,
                      dessertMetadata: {
                        active: {
                          config: meltConfig,
                          meltProgress: 0,
                          meltComplete: false,
                          outcomeAction: null,
                        },
                        history: [],
                      },
                    });
                    setLastRemoteId(row.id);
                    dispatch({
                      type: "LOCK_IN",
                      sessionName: state.sessionName ?? undefined,
                      remoteSessionId: row.id,
                      clientId,
                      meltConfig,
                    });
                  } catch (err) {
                    toast.error(
                      userFacingError(err, "Could not restart melt session"),
                    );
                  }
                })();
              }
              return;
            }
            dispatch({ type: "MELT_POST_ACTION", action });
          }}
          onDismiss={() => setMeltDialogDismissed(true)}
        />

        <BreakStartDialog
          open={state.session === "CHOOSING_BREAK"}
          onClose={() => dispatch({ type: "CLOSE_PIT_STOP" })}
          breakTimerMinutes={breakTimerMinutes}
          onStart={(mode) => {
            const typeId = pickRandomBreakType().id;
            dispatch({
              type: "START_BREAK",
              mode,
              typeId,
              durationMs:
                mode === "count_down" ? breakTimerMs(breakTimerMinutes) : undefined,
            });
          }}
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
        timeZone={timezone}
        receipt={{
          sessionName: state.sessionName,
          kind: "solo",
          startedAt: state.sessionStartedAt,
          endedAt: new Date().toISOString(),
          activeMs: shareDuration,
          breakMs: state.breakMs,
          breakTypesUsed: state.breakTypesUsed,
          breakHistory: state.breakHistory,
          outcome: shareOutcome,
          prBroken: state.didBreakPR,
          dessertMetadata,
        }}
      />

      <ActiveSessionDialog
        open={conflictOpen}
        existing={conflictSession}
        onCancel={() => setConflictOpen(false)}
        onResume={() => {
          if (!conflictSession) return;
          setConflictOpen(false);
          setLastRemoteId(conflictSession.id);
          dispatch(hydrateRemoteFromSessionRow(conflictSession));
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
