"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LockedInLogo } from "@/components/brand/LockedInLogo";
import { FocusTimer } from "@/components/session/FocusTimer";
import { ClosingBanner } from "@/components/rooms/ClosingBanner";
import { RoomPresencePane } from "@/components/rooms/RoomPresencePane";
import { RoomPresenceStrip } from "@/components/rooms/RoomPresenceStrip";
import { BreakVoteDialog } from "@/components/rooms/BreakVoteDialog";
import { ActiveSessionDialog } from "@/components/session/ActiveSessionDialog";
import { PitStopDialog } from "@/components/session/PitStopDialog";
import { ShareCardDialog } from "@/components/session/ShareCardDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  cancelBreakVote,
  castBreakVote,
  fetchBreakVotes,
  fetchRoomByCode,
  joinRoom,
  leaveRoom,
  requestSharedBreak,
  resolveBreakVote,
} from "@/features/rooms/api";
import { useRoomCloseWatch } from "@/features/rooms/closeWatch";
import { usePomodoroCadence } from "@/features/rooms/usePomodoroCadence";
import { useRoomChannel } from "@/features/rooms/useRoomChannel";
import type { BreakVoteChoice, RoomSummary } from "@/features/rooms/types";
import { resolveOutcome } from "@/features/session/format";
import { initialState, reducer } from "@/features/session/reducer";
import { useSessionClock } from "@/features/session/useSessionClock";
import type { SessionReceiptData } from "@/components/session/SessionReceiptCard";
import {
  ActiveSessionExistsError,
  endSession,
  startSession,
  tapOutSession,
} from "@/features/session/sync";
import type { SessionRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionClientId(existing: string | null): string {
  if (existing && UUID_RE.test(existing)) return existing;
  return crypto.randomUUID();
}

function isFocusSession(session: (typeof initialState)["session"]) {
  return (
    session === "LOCKED_IN" ||
    session === "ON_BREAK" ||
    session === "CHOOSING_BREAK" ||
    session === "BREAK_DONE"
  );
}

export default function RoomFocusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const { status, user, profile, avatarUrl, isAuthenticated, profileLabel } =
    useAuth();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [missing, setMissing] = useState(false);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [sessionNameDraft, setSessionNameDraft] = useState("");
  const [tallies, setTallies] = useState({ break: 0, stay: 0 });
  const [myVote, setMyVote] = useState<BreakVoteChoice | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictSession, setConflictSession] = useState<SessionRow | null>(
    null,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const seenRoomRef = useRef(false);
  const joinedRef = useRef(false);
  const appliedVoteRoundRef = useRef<string | null>(null);
  const loadErrorToastRef = useRef(false);

  const userId = user?.id ?? null;
  const username = profile?.username?.trim() || "you";
  const avatarPath = avatarUrl;

  const loadRoom = useCallback(async () => {
    try {
      const supabase = createClient();
      const normalized = code.replace(/\D/g, "").slice(0, 6);

      // Auto-join when authenticated so shared invite URLs seat the viewer.
      if (isAuthenticated && normalized.length === 6 && !joinedRef.current) {
        try {
          const joined = await joinRoom(supabase, normalized);
          joinedRef.current = true;
          seenRoomRef.current = true;
          setMissing(false);
          setRoom(joined);
          if (joined.activeBreakRoundId) {
            const votes = await fetchBreakVotes(
              supabase,
              joined.id,
              joined.activeBreakRoundId,
            );
            setTallies({ break: votes.break, stay: votes.stay });
            setMyVote(votes.myVote);
          } else {
            setTallies({ break: 0, stay: 0 });
            setMyVote(null);
          }
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (/room_not_found|room_closed/i.test(msg)) {
            setMissing(true);
            setRoom(null);
            return;
          }
          // Fall through to fetch-only (e.g. rate_limited, already member via fetch)
        }
      }

      const next = await fetchRoomByCode(supabase, code);
      if (!next) {
        if (seenRoomRef.current) {
          toast.message("This room closed.");
          router.push("/rooms");
          return;
        }
        setMissing(true);
        setRoom(null);
        return;
      }
      seenRoomRef.current = true;
      loadErrorToastRef.current = false;
      setMissing(false);
      setRoom(next);
      if (next.activeBreakRoundId) {
        const votes = await fetchBreakVotes(
          supabase,
          next.id,
          next.activeBreakRoundId,
        );
        setTallies({ break: votes.break, stay: votes.stay });
        setMyVote(votes.myVote);
      } else {
        setTallies({ break: 0, stay: 0 });
        setMyVote(null);
      }
    } catch {
      if (!loadErrorToastRef.current) {
        loadErrorToastRef.current = true;
        toast.error("Could not load room");
      }
    }
  }, [code, router, isAuthenticated]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (room?.name && !sessionNameDraft) {
      setSessionNameDraft(room.name);
    }
  }, [room?.name, sessionNameDraft]);

  useEffect(() => {
    if (!room?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`room-row:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            toast.message("This room closed.");
            router.push("/rooms");
            return;
          }
          void loadRoom();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_break_votes",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          void loadRoom();
        },
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void loadRoom();
    }, 8_000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [room?.id, loadRoom, router]);

  useEffect(() => {
    if (missing) {
      toast.error("That room code doesn't exist.");
      router.push("/rooms");
    }
  }, [missing, router]);

  const roundId = room?.activeBreakRoundId ?? null;
  const voteEndsAt = room?.breakVoteEndsAt ?? null;
  const voteActive = Boolean(roundId && voteEndsAt);

  const { secondsLeft } = useRoomCloseWatch(room?.closesAt);
  const { isPomodoro, phase, remainingMs } = usePomodoroCadence(room);

  useEffect(() => {
    if (!isPomodoro) return;
    if (phase === "break" && stateRef.current.session === "LOCKED_IN") {
      dispatch({
        type: "START_SHARED_BREAK",
        durationMs: remainingMs || 5 * 60 * 1000,
      });
    }
    if (
      phase === "work" &&
      (stateRef.current.session === "ON_BREAK" ||
        stateRef.current.session === "CHOOSING_BREAK" ||
        stateRef.current.session === "BREAK_DONE")
    ) {
      dispatch({ type: "LOCK_BACK_IN" });
    }
  }, [isPomodoro, phase, remainingMs]);

  const presenceSelf = useMemo(
    () => {
      const onBreak =
        state.session === "ON_BREAK" ||
        state.session === "CHOOSING_BREAK" ||
        state.session === "BREAK_DONE";
      const breakType =
        state.breakChoiceId ??
        (isPomodoro && onBreak ? "pomodoro" : null);
      return {
        userId,
        username,
        displayName: username,
        avatarPath,
        status: state.session === "LOCKED_IN"
          ? ("LOCKED_IN" as const)
          : onBreak
            ? ("BREAK" as const)
            : ("WAITING" as const),
        elapsedMs: state.elapsedMs,
        seat: null as number | null,
        breakLabel: onBreak ? state.breakLabel || null : null,
        breakType: onBreak ? breakType : null,
      };
    },
    [
      state.elapsedMs,
      state.session,
      state.breakLabel,
      state.breakChoiceId,
      isPomodoro,
      userId,
      username,
      avatarPath,
    ],
  );

  const { members } = useRoomChannel(
    code,
    room?.id ?? null,
    presenceSelf,
    room?.name,
  );
  useSessionClock(state, dispatch);

  useEffect(() => {
    if (status === "loading" || !userId) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let cancelled = false;
    void (async () => {
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
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  useEffect(() => {
    const voteRound = room?.lastVoteRoundId;
    const result = room?.lastVoteResult;
    if (!voteRound || !result) return;
    if (appliedVoteRoundRef.current === voteRound) return;
    appliedVoteRoundRef.current = voteRound;
    if (result === "break") {
      dispatch({ type: "OPEN_SHARED_BREAK_PICKER" });
    } else if (result === "cancelled") {
      toast.message("Break vote cancelled.");
    }
  }, [room?.lastVoteRoundId, room?.lastVoteResult]);

  useEffect(() => {
    if (!room?.id || !roundId || !voteEndsAt) return;
    const ends = new Date(voteEndsAt).getTime();
    const wait = Math.max(0, ends - Date.now() + 250);
    const id = window.setTimeout(() => {
      void resolveBreakVote(createClient(), room.id)
        .then(() => loadRoom())
        .catch(() => {
          void loadRoom();
        });
    }, wait);
    return () => window.clearTimeout(id);
  }, [room?.id, roundId, voteEndsAt, loadRoom]);

  useEffect(() => {
    if (state.session === "ENDED" || state.session === "TAPPED_OUT") {
      setSessionNameDraft(room?.name ?? "");
    }
  }, [state.session, room?.name]);

  async function persistEnd(kind: "end" | "tapout") {
    const s = stateRef.current;
    if (!s.remoteSessionId) return;
    const payload = {
      id: s.remoteSessionId,
      activeMs: s.elapsedMs,
      breakMs: s.breakMs,
      breakTypes: s.breakTypesUsed,
      outcome: kind === "tapout" ? "tapout" : s.didBreakPR ? "pr" : "solid",
      prBroken: s.didBreakPR,
    };
    if (kind === "tapout") {
      await tapOutSession(createClient(), payload);
    } else {
      await endSession(createClient(), payload);
    }
  }

  const onLockIn = useCallback(async () => {
    if (status === "loading" || !userId) return;
    const supabase = createClient();
    const clientId = sessionClientId(state.clientId);
    try {
      const row = await startSession(supabase, {
        sessionName: sessionNameDraft || room?.name || null,
        clientId,
        roomSessionId: room?.roomSessionId ?? null,
      });
      dispatch({
        type: "LOCK_IN",
        sessionName: sessionNameDraft || room?.name || undefined,
        remoteSessionId: row.id,
        clientId,
      });
    } catch (err) {
      if (err instanceof ActiveSessionExistsError) {
        setConflictSession(err.existing);
        setConflictOpen(true);
        return;
      }
      toast.error(userFacingError(err, "Could not start session"));
    }
  }, [
    status,
    userId,
    state.clientId,
    sessionNameDraft,
    room?.name,
    room?.roomSessionId,
  ]);

  const onTapOut = useCallback(async () => {
    try {
      await persistEnd("tapout");
      dispatch({ type: "TAP_OUT" });
    } catch (err) {
      toast.error(userFacingError(err, "Tap out sync failed"));
    }
  }, []);

  const onEndSession = useCallback(async () => {
    try {
      await persistEnd("end");
      dispatch({ type: "END_SESSION" });
    } catch (err) {
      toast.error(userFacingError(err, "End sync failed"));
    }
  }, []);

  async function onRequestBreak() {
    if (!room || isPomodoro) return;
    try {
      await requestSharedBreak(createClient(), room.id);
      await loadRoom();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (raw.includes("vote_in_progress")) {
        await loadRoom();
        return;
      }
      toast.error(userFacingError(err, "Could not start shared break"));
    }
  }

  async function onCancelVote() {
    if (!room) return;
    try {
      await cancelBreakVote(createClient(), room.id);
      await loadRoom();
    } catch (err) {
      toast.error(userFacingError(err, "Could not cancel vote"));
    }
  }

  async function onLeave() {
    try {
      if (isFocusSession(stateRef.current.session) && stateRef.current.remoteSessionId) {
        await persistEnd("end");
        dispatch({ type: "END_SESSION" });
      }
      if (room) {
        try {
          await leaveRoom(createClient(), room.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (!msg.includes("not_in_room")) {
            toast.error(userFacingError(err, "Could not leave room"));
            return;
          }
        }
      }
      router.push("/rooms");
    } catch (err) {
      toast.error(userFacingError(err, "Could not leave room"));
    }
  }

  const displayCode = room?.code ?? code.replace(/\D/g, "").slice(0, 6);
  const isVoteRoom = room?.kind !== "pomodoro";
  const canCancelVote =
    Boolean(userId) && room?.breakVoteRequestedBy === userId;

  const shareDuration =
    state.lastSessionMs || state.elapsedMs || state.personalRecordMs;
  const shareOutcome = resolveOutcome(
    state.session,
    state.lastOutcome,
    state.didBreakPR,
  );

  const roomReceipt: SessionReceiptData = useMemo(
    () => ({
      sessionName: state.sessionName || room?.name || "Room session",
      kind: "room",
      roomCode: room?.code ?? displayCode,
      startedAt: state.sessionStartedAt,
      activeMs: shareDuration,
      breakMs: state.breakMs,
      breakTypesUsed: state.breakTypesUsed,
      outcome: shareOutcome,
      prBroken: state.didBreakPR,
      participants: members.map((m) => ({
        user_id: m.userId,
        username: m.username,
        active_ms:
          m.userId === userId ? shareDuration : m.elapsedMs,
        break_ms: m.userId === userId ? state.breakMs : 0,
        break_types_used:
          m.userId === userId
            ? state.breakTypesUsed
            : m.breakType
              ? [m.breakType]
              : [],
        outcome:
          m.userId === userId
            ? shareOutcome
            : m.status === "LOCKED_IN"
              ? "solid"
              : m.status === "BREAK"
                ? "break"
                : "solid",
        isYou: m.userId === userId,
      })),
    }),
    [
      state.sessionName,
      state.sessionStartedAt,
      state.breakMs,
      state.breakTypesUsed,
      state.didBreakPR,
      room?.name,
      room?.code,
      displayCode,
      shareDuration,
      shareOutcome,
      members,
      userId,
    ],
  );

  return (
    <AppShell
      layoutMode="room-focus"
      presence={
        <RoomPresencePane members={members} selfUserId={userId} />
      }
      presenceStrip={<RoomPresenceStrip members={members} />}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {room?.status === "closing" && secondsLeft != null && (
          <ClosingBanner secondsLeft={secondsLeft} />
        )}

        <FocusTimer
          state={state.session}
          elapsedMs={state.elapsedMs}
          todayTotalMs={state.todayTotalMs}
          personalRecordMs={state.personalRecordMs}
          didBreakPR={state.didBreakPR}
          breakRemainingMs={state.breakRemainingMs}
          breakElapsedMs={state.breakElapsedMs}
          breakOpenEnded={state.breakOpenEnded}
          breakLabel={state.breakLabel}
          breakEmoji={state.breakEmoji}
          sessionName={sessionNameDraft}
          onSessionNameChange={setSessionNameDraft}
          lockInDisabled={status === "loading"}
          topBar={
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  Room Code :{" "}
                  <span className="font-mono text-base font-bold tabular-nums tracking-widest text-slate-900">
                    {displayCode}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {isPomodoro ? "Pomodoro cadence" : "Vote room"} ·{" "}
                  {room?.status ?? "…"}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={async () => {
                    const link = `${window.location.origin}/rooms/${displayCode}`;
                    try {
                      await navigator.clipboard.writeText(link);
                      toast.success("Invite link copied");
                    } catch {
                      try {
                        await navigator.clipboard.writeText(displayCode);
                        toast.success("Room code copied");
                      } catch {
                        toast.error("Could not copy");
                      }
                    }
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Invite
                </Button>
                {isVoteRoom ? (
                  <Button
                    variant="outline"
                    className="rounded-xl border-amber-300 bg-amber-50 font-display font-bold text-amber-900 hover:bg-amber-100"
                    onClick={() => void onRequestBreak()}
                  >
                    BREAK?
                  </Button>
                ) : (
                  <p className="hidden text-[11px] text-slate-400 sm:block">
                    Breaks are automatic
                  </p>
                )}
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void onLeave()}
                >
                  Leave
                </Button>
              </div>
            </div>
          }
          heroTitle={
            <h1 className="flex max-w-full flex-wrap items-baseline justify-center gap-x-2 gap-y-1 pb-0.5 text-center font-display text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
              <span className="min-w-0 max-w-full line-clamp-2">
                {room?.name || "Room"}
              </span>
              <span className="inline-flex shrink-0 items-baseline gap-x-2 whitespace-nowrap leading-snug">
                <LockedInLogo
                  word="Lock"
                  className="text-[0.85em] sm:text-[0.9em]"
                />
                <span>session</span>
              </span>
            </h1>
          }
          onLockIn={() => {
            void onLockIn();
          }}
          onPitStop={() => dispatch({ type: "OPEN_PIT_STOP" })}
          onLockBackIn={() => dispatch({ type: "LOCK_BACK_IN" })}
          onEndSession={() => {
            void onEndSession();
          }}
          onTapOut={() => {
            void onTapOut();
          }}
          onShare={() => dispatch({ type: "OPEN_SHARE" })}
          onClearPrBurst={() => dispatch({ type: "CLEAR_PR_BURST" })}
        />
      </div>

      <PitStopDialog
        open={state.session === "CHOOSING_BREAK"}
        required={state.breakSource === "shared"}
        openEnded={state.breakSource === "shared"}
        onClose={() => dispatch({ type: "CLOSE_PIT_STOP" })}
        onSelect={(choice) =>
          dispatch({
            type: "START_BREAK",
            choice,
            openEnded: state.breakSource === "shared",
          })
        }
      />

      <BreakVoteDialog
        open={voteActive}
        endsAt={voteEndsAt}
        tallies={tallies}
        myVote={myVote}
        canCancel={canCancelVote}
        onVote={async (choice) => {
          const previous = myVote;
          setMyVote(choice);
          if (room) {
            try {
              await castBreakVote(createClient(), room.id, choice);
              await loadRoom();
            } catch (err) {
              setMyVote(previous);
              toast.error(userFacingError(err, "Vote failed"));
            }
          }
        }}
        onCancel={() => void onCancelVote()}
      />

      <ActiveSessionDialog
        open={conflictOpen}
        existing={conflictSession}
        onCancel={() => setConflictOpen(false)}
        onResume={() => {
          if (!conflictSession) return;
          setConflictOpen(false);
          dispatch({
            type: "HYDRATE_REMOTE",
            remoteSessionId: conflictSession.id,
            clientId: conflictSession.client_id,
            elapsedMs: Number(conflictSession.active_ms) || 0,
            sessionName: conflictSession.session_name,
            startedAt: conflictSession.started_at,
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

      <ShareCardDialog
        open={state.shareOpen}
        onOpenChange={(open) =>
          dispatch({ type: open ? "OPEN_SHARE" : "CLOSE_SHARE" })
        }
        durationMs={shareDuration}
        outcome={shareOutcome}
        displayName={profileLabel}
        avatarUrl={avatarUrl}
        sessionId={state.remoteSessionId}
        canPost={isAuthenticated && Boolean(state.remoteSessionId)}
        sessionName={state.sessionName || room?.name}
        receipt={{
          ...roomReceipt,
          endedAt: new Date().toISOString(),
        }}
      />
    </AppShell>
  );
}
