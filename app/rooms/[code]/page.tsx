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
import { AppShell } from "@/components/layout/AppShell";
import { FocusTimer } from "@/components/session/FocusTimer";
import { ClosingBanner } from "@/components/rooms/ClosingBanner";
import { RoomPresencePane } from "@/components/rooms/RoomPresencePane";
import { RoomPresenceStrip } from "@/components/rooms/RoomPresenceStrip";
import { BreakVoteDialog } from "@/components/rooms/BreakVoteDialog";
import { ActiveSessionDialog } from "@/components/session/ActiveSessionDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  castBreakVote,
  fetchBreakVotes,
  fetchRoomByCode,
  leaveRoom,
  requestSharedBreak,
  resolveBreakVote,
} from "@/features/rooms/api";
import { useRoomCloseWatch } from "@/features/rooms/closeWatch";
import { usePomodoroCadence } from "@/features/rooms/usePomodoroCadence";
import { useRoomChannel } from "@/features/rooms/useRoomChannel";
import { majorityBreakResult } from "@/features/rooms/vote";
import type { BreakVoteChoice, RoomSummary } from "@/features/rooms/types";
import { initialState, reducer } from "@/features/session/reducer";
import { useSessionClock } from "@/features/session/useSessionClock";
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
  const { status, user, profile, avatarUrl } = useAuth();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [missing, setMissing] = useState(false);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [sessionNameDraft, setSessionNameDraft] = useState("");
  const [tallies, setTallies] = useState({ break: 0, stay: 0 });
  const [myVote, setMyVote] = useState<BreakVoteChoice | null>(null);
  const [resolvedRound, setResolvedRound] = useState<string | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictSession, setConflictSession] = useState<SessionRow | null>(
    null,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const talliesRef = useRef(tallies);
  talliesRef.current = tallies;
  const seenRoomRef = useRef(false);

  const userId = user?.id ?? null;
  const username = profile?.username?.trim() || "you";
  const avatarPath = avatarUrl;

  const loadRoom = useCallback(async () => {
    try {
      const next = await fetchRoomByCode(createClient(), code);
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
      setMissing(false);
      setRoom(next);
      if (next.activeBreakRoundId) {
        const votes = await fetchBreakVotes(
          createClient(),
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
      if (!seenRoomRef.current) {
        setMissing(true);
        setRoom(null);
      }
    }
  }, [code, router]);

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
  const voteActive = Boolean(roundId && voteEndsAt && resolvedRound !== roundId);

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
    () => ({
      userId,
      username,
      displayName: username,
      avatarPath,
      status:
        state.session === "LOCKED_IN"
          ? ("LOCKED_IN" as const)
          : state.session === "ON_BREAK" ||
              state.session === "CHOOSING_BREAK" ||
              state.session === "BREAK_DONE"
            ? ("BREAK" as const)
            : ("WAITING" as const),
      elapsedMs: state.elapsedMs,
      seat: null as number | null,
    }),
    [state.elapsedMs, state.session, userId, username, avatarPath],
  );

  const { members } = useRoomChannel(code, room?.id ?? null, presenceSelf);
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

  const membersLenRef = useRef(0);
  membersLenRef.current = members.length;

  const applyVoteResult = useCallback((result: "break" | "stay") => {
    if (result === "break" && stateRef.current.session === "LOCKED_IN") {
      dispatch({ type: "START_SHARED_BREAK" });
    }
  }, []);

  useEffect(() => {
    if (!room?.id || !roundId || !voteEndsAt) return;
    if (resolvedRound === roundId) return;
    const ends = new Date(voteEndsAt).getTime();
    const wait = Math.max(0, ends - Date.now());
    const id = window.setTimeout(() => {
      setResolvedRound(roundId);
      const t = talliesRef.current;
      const result = majorityBreakResult(
        t.break,
        t.stay,
        Math.max(membersLenRef.current, 1),
      );
      applyVoteResult(result);
      void resolveBreakVote(createClient(), room.id)
        .then((resolved) => {
          if (resolved.result) applyVoteResult(resolved.result);
          void loadRoom();
        })
        .catch(() => {
          void loadRoom();
        });
    }, wait);
    return () => window.clearTimeout(id);
  }, [
    room?.id,
    roundId,
    voteEndsAt,
    resolvedRound,
    applyVoteResult,
    loadRoom,
  ]);

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
      breakMs: 0,
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

  return (
    <AppShell
      layoutMode="room-focus"
      presence={<RoomPresencePane members={members} />}
      presenceStrip={<RoomPresenceStrip members={members} />}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-slate-900">
              {room?.name || "Room"}
            </p>
            <p className="font-mono text-xs tabular-nums tracking-[0.18em] text-slate-500">
              {displayCode}
              <span className="ml-2 tracking-normal text-slate-400">
                {isPomodoro ? "Pomodoro cadence" : "Vote room"} ·{" "}
                {room?.status ?? "…"}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
          breakLabel={state.breakLabel}
          breakEmoji={state.breakEmoji}
          sessionName={sessionNameDraft}
          onSessionNameChange={setSessionNameDraft}
          lockInDisabled={status === "loading"}
          hidePersonalBreak
          onLockIn={() => {
            void onLockIn();
          }}
          onPitStop={() => {
            void onRequestBreak();
          }}
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

      <BreakVoteDialog
        open={voteActive}
        endsAt={voteEndsAt}
        tallies={tallies}
        myVote={myVote}
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
        onClose={() => undefined}
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
    </AppShell>
  );
}
