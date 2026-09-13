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
import { Copy, IceCreamCone } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LockedInLogo } from "@/components/brand/LockedInLogo";
import { FocusTimer } from "@/components/session/FocusTimer";
import { ClosingBanner } from "@/components/rooms/ClosingBanner";
import { RoomPresencePane } from "@/components/rooms/RoomPresencePane";
import { RoomPresenceStrip } from "@/components/rooms/RoomPresenceStrip";
import { BreakVoteDialog } from "@/components/rooms/BreakVoteDialog";
import { ActiveSessionDialog } from "@/components/session/ActiveSessionDialog";
import { BreakStartDialog } from "@/components/session/BreakStartDialog";
import { MeltBuilderDialog } from "@/components/session/MeltBuilderDialog";
import { MeltPostActionDialog } from "@/components/session/MeltPostActionDialog";
import { RoomMeltTable } from "@/components/rooms/RoomMeltTable";
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
import {
  memberDisplayClock,
  type SelfLiveClock,
} from "@/features/rooms/live-member-clock";
import { usePomodoroCadence } from "@/features/rooms/usePomodoroCadence";
import { useRoomChannel } from "@/features/rooms/useRoomChannel";
import type { BreakVoteChoice, RoomSummary } from "@/features/rooms/types";
import {
  buildBreakLiveLabel,
  resolveOutcome,
} from "@/features/session/format";
import { pickRandomBreakType } from "@/features/session/break-types";
import { initialState, projectBreakHistory, reducer } from "@/features/session/reducer";
import {
  breakTimerMs,
  loadBreakTimerMinutes,
} from "@/lib/preferences/break-timer";
import { useSessionClock } from "@/features/session/useSessionClock";
import { useOfflineQueueReplay } from "@/features/session/useOfflineQueueReplay";
import type { SessionReceiptData } from "@/components/session/SessionReceiptCard";
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
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { userFacingError } from "@/lib/supabase/errors";
import {
  createMeltConfig,
  dessertMetadataFromState,
  type MeltConfig,
} from "@/features/session/melt-catalog";
import {
  computeMeltProgress,
  isMeltComplete,
  meltRoomStatusLabel,
} from "@/features/session/melt-utils";

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

async function shareOrCopyInvite(link: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      return "copied" as const;
    }
  } catch {
    // Fall through to the native share sheet or legacy copy.
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: "LockedIn room",
        text: "Join my LockedIn room",
        url: link,
      });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled" as const;
      }
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = link;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied ? ("copied" as const) : ("failed" as const);
}

export default function RoomFocusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const { t } = useTranslation();
  const { status, user, profile, avatarUrl, isAuthenticated, profileLabel } =
    useAuth();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [missing, setMissing] = useState(false);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [sessionNameDraft, setSessionNameDraft] = useState("");
  const [breakTimerMinutes, setBreakTimerMinutes] = useState(
    loadBreakTimerMinutes,
  );
  const [tallies, setTallies] = useState({ break: 0, stay: 0 });
  const [myVote, setMyVote] = useState<BreakVoteChoice | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictSession, setConflictSession] = useState<SessionRow | null>(
    null,
  );
  const [meltDialogDismissed, setMeltDialogDismissed] = useState(false);
  const [lastRemoteId, setLastRemoteId] = useState<string | null>(null);
  /** Own melt-board seat; null = auto-spread until the user drags. */
  const [meltBoardPos, setMeltBoardPos] = useState<{
    x: number | null;
    z: number | null;
  }>({ x: null, z: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  const seenRoomRef = useRef(false);
  const joinedRef = useRef(false);
  const appliedVoteRoundRef = useRef<string | null>(null);
  const prevActiveBreakRoundRef = useRef<string | null>(null);
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
          toast.message(t("room.toast.closed"));
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
        toast.error(t("room.toast.loadFailed"));
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
            toast.message(t("room.toast.closed"));
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
      toast.error(t("room.toast.notFound"));
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
        state.breakTypeId ??
        (isPomodoro && onBreak ? "pomodoro" : null);
      const breakLabel = state.breakTypeId
        ? buildBreakLiveLabel(state.breakTypeId, state.breakElapsedMs, t)
        : breakType === "pomodoro"
          ? t("room.pomodoro")
          : null;
      const customizing = state.meltBuilderOpen && state.session !== "LOCKED_IN";
      return {
        userId,
        username,
        displayName: username,
        avatarPath,
        status: customizing
          ? ("CUSTOMIZING" as const)
          : state.session === "LOCKED_IN"
            ? ("LOCKED_IN" as const)
            : onBreak
              ? ("BREAK" as const)
              : ("WAITING" as const),
        elapsedMs: state.elapsedMs,
        seat: null as number | null,
        breakLabel: onBreak ? breakLabel : null,
        breakType: onBreak ? breakType : null,
        breakElapsedMs: onBreak
          ? state.breakOpenEnded
            ? state.breakElapsedMs
            : Math.max(0, state.breakDurationMs - state.breakRemainingMs)
          : 0,
        breakRemainingMs: onBreak ? state.breakRemainingMs : 0,
        breakOpenEnded: onBreak ? state.breakOpenEnded : false,
        meltConfig: state.meltConfig,
        meltAnimOffsetMs: state.meltAnimOffsetMs,
        meltAnimSpeed: state.meltAnimSpeed,
        meltCustomizing: customizing,
        meltStatusLabel: customizing
          ? meltRoomStatusLabel(true, state.meltConfig, t)
          : null,
        meltBoardX: meltBoardPos.x,
        meltBoardZ: meltBoardPos.z,
      };
    },
    [
      state.elapsedMs,
      state.session,
      state.breakTypeId,
      state.breakElapsedMs,
      state.breakRemainingMs,
      state.breakDurationMs,
      state.breakOpenEnded,
      state.meltConfig,
      state.meltAnimOffsetMs,
      state.meltAnimSpeed,
      state.meltBuilderOpen,
      meltBoardPos.x,
      meltBoardPos.z,
      isPomodoro,
      userId,
      username,
      avatarPath,
      t,
    ],
  );

  const { members } = useRoomChannel(
    code,
    room?.id ?? null,
    presenceSelf,
    room?.name,
  );

  const selfLive = useMemo((): SelfLiveClock | null => {
    if (!userId) return null;
    return {
      userId,
      elapsedMs: presenceSelf.elapsedMs,
      status: presenceSelf.status,
      breakElapsedMs: presenceSelf.breakElapsedMs,
      breakRemainingMs: presenceSelf.breakRemainingMs,
      breakOpenEnded: presenceSelf.breakOpenEnded,
    };
  }, [
    userId,
    presenceSelf.elapsedMs,
    presenceSelf.status,
    presenceSelf.breakElapsedMs,
    presenceSelf.breakRemainingMs,
    presenceSelf.breakOpenEnded,
  ]);

  // Hydrate board seat from DB/presence when local has not been set yet.
  useEffect(() => {
    const melting =
      (state.session === "LOCKED_IN" ||
        state.session === "ON_BREAK" ||
        state.session === "CHOOSING_BREAK" ||
        state.session === "BREAK_DONE") &&
      Boolean(state.meltConfig);
    if (!melting || !userId || meltBoardPos.x != null) return;
    const selfMember = members.find((m) => m.userId === userId);
    if (
      typeof selfMember?.meltBoardX === "number" &&
      typeof selfMember?.meltBoardZ === "number"
    ) {
      setMeltBoardPos({
        x: selfMember.meltBoardX,
        z: selfMember.meltBoardZ,
      });
    }
  }, [members, userId, meltBoardPos.x, state.session, state.meltConfig]);

  // Clear board seat when leaving melt mode.
  useEffect(() => {
    const melting =
      (state.session === "LOCKED_IN" ||
        state.session === "ON_BREAK" ||
        state.session === "CHOOSING_BREAK" ||
        state.session === "BREAK_DONE") &&
      Boolean(state.meltConfig);
    if (!melting && (meltBoardPos.x != null || meltBoardPos.z != null)) {
      setMeltBoardPos({ x: null, z: null });
    }
  }, [state.session, state.meltConfig, meltBoardPos.x, meltBoardPos.z]);

  const onMeltBoardPosChange = useCallback((x: number, z: number) => {
    setMeltBoardPos({ x, z });
  }, []);

  useSessionClock(state, dispatch, { isAuthenticated });
  useOfflineQueueReplay(status !== "loading" && isAuthenticated);

  // Auto-end stale orphans left by sleep / kill while in a room session
  useEffect(() => {
    if (status === "loading" || !isAuthenticated || !userId) return;
    if (isFocusSession(state.session)) return;

    let cancelled = false;
    void (async () => {
      try {
        const existing = await resumeActiveSession(createClient());
        if (cancelled || !existing || !isSessionStale(existing)) return;
        const activeMs = Number(existing.active_ms) || 0;
        const breakMs = Number(existing.break_ms) || 0;
        const prBroken =
          state.personalRecordMs > 0 && activeMs > state.personalRecordMs;
        await endSession(createClient(), {
          id: existing.id,
          activeMs,
          breakMs,
          breakTypes: existing.break_types_used,
          outcome: prBroken ? "pr" : "solid",
          prBroken,
        });
        if (!cancelled) {
          toast.success(
            prBroken
              ? t("room.toast.savedPr")
              : t("room.toast.saved"),
          );
        }
      } catch {
        /* conflict dialog covers fresh multi-device */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth gate only
  }, [status, isAuthenticated, userId]);

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
    const currentActive = room?.activeBreakRoundId ?? null;
    const prevActive = prevActiveBreakRoundRef.current;
    const voteRound = room?.lastVoteRoundId;
    const result = room?.lastVoteResult;

    // Only react when a live vote round just resolved (active → null).
    const justResolved =
      Boolean(prevActive) &&
      !currentActive &&
      Boolean(voteRound) &&
      prevActive === voteRound;

    prevActiveBreakRoundRef.current = currentActive;

    if (!justResolved || !voteRound || !result) return;
    if (appliedVoteRoundRef.current === voteRound) return;
    appliedVoteRoundRef.current = voteRound;

    if (result === "break") {
      // Stay voters keep focusing; break voters / non-voters in the round take break.
      if (myVote === "stay") return;
      if (stateRef.current.session === "LOCKED_IN") {
        dispatch({ type: "OPEN_SHARED_BREAK_PICKER" });
      }
    } else if (result === "cancelled") {
      toast.message(t("room.toast.voteCancelled"));
    }
  }, [room?.activeBreakRoundId, room?.lastVoteRoundId, room?.lastVoteResult, myVote, t]);

  // Auto-resume non-stale cloud session for this room (or orphan-end if stale)
  useEffect(() => {
    if (status === "loading" || !userId || !room?.roomSessionId) return;
    if (isFocusSession(state.session)) return;

    let cancelled = false;
    void (async () => {
      try {
        const existing = await resumeActiveSession(createClient());
        if (cancelled || !existing) return;
        if (
          existing.room_session_id &&
          room.roomSessionId &&
          existing.room_session_id !== room.roomSessionId
        ) {
          return;
        }
        if (!isSessionStale(existing)) {
          setLastRemoteId(existing.id);
          dispatch(hydrateRemoteFromSessionRow(existing));
          toast.message("Resumed your session");
          return;
        }
        const activeMs = Number(existing.active_ms) || 0;
        const breakMs = Number(existing.break_ms) || 0;
        await endSession(createClient(), {
          id: existing.id,
          activeMs,
          breakMs,
          breakTypes: existing.break_types_used,
          outcome: "solid",
          prBroken: false,
        });
      } catch {
        /* ignore — conflict dialog handles LOCK IN */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / room session gate
  }, [status, userId, room?.roomSessionId]);

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
    setLastRemoteId(s.remoteSessionId);
    const meta = dessertMetadataFromState(
      s.meltConfig,
      s.meltAnimOffsetMs,
      s.elapsedMs,
      s.meltComplete,
      s.meltOutcomeAction,
      s.meltHistory,
    );
    const payload = {
      id: s.remoteSessionId,
      activeMs: s.elapsedMs,
      breakMs: s.breakMs,
      breakTypes: s.breakTypesUsed,
      breakHistory: projectBreakHistory(s),
      outcome: kind === "tapout" ? "tapout" : s.didBreakPR ? "pr" : "solid",
      prBroken: s.didBreakPR,
      dessertMetadata: meta,
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
      setLastRemoteId(row.id);
      dispatch({
        type: "LOCK_IN",
        sessionName: sessionNameDraft || room?.name || undefined,
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
            const row = await startSession(createClient(), {
              sessionName: sessionNameDraft || room?.name || null,
              clientId,
              roomSessionId: room?.roomSessionId ?? null,
            });
            setLastRemoteId(row.id);
            dispatch({
              type: "LOCK_IN",
              sessionName: sessionNameDraft || room?.name || undefined,
              remoteSessionId: row.id,
              clientId,
            });
            return;
          } catch {
            /* fall through to dialog */
          }
        }
        setConflictSession(existing);
        setConflictOpen(true);
        return;
      }
      toast.error(userFacingError(err, t("room.toast.startFailed")));
    }
  }, [
    status,
    userId,
    state.clientId,
    state.personalRecordMs,
    sessionNameDraft,
    room?.name,
    room?.roomSessionId,
  ]);

  const onMeltLockIn = useCallback(
    async (config: MeltConfig) => {
      if (status === "loading" || !userId) return;
      const supabase = createClient();
      const clientId = sessionClientId(state.clientId);
      try {
        const row = await startSession(supabase, {
          sessionName: sessionNameDraft || room?.name || null,
          clientId,
          roomSessionId: room?.roomSessionId ?? null,
          dessertMetadata: {
            active: {
              config,
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
          sessionName: sessionNameDraft || room?.name || undefined,
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
        toast.error(userFacingError(err, t("room.toast.startFailed")));
      }
    },
    [
      status,
      userId,
      state.clientId,
      sessionNameDraft,
      room?.name,
      room?.roomSessionId,
      t,
    ],
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
  }, [state.session, state.meltConfig, state.meltComplete, meltProgress, t]);

  const dessertMetadata = dessertMetadataFromState(
    state.meltConfig,
    state.meltAnimOffsetMs,
    state.elapsedMs,
    state.meltComplete,
    state.meltOutcomeAction,
    state.meltHistory,
  );

  const onTapOut = useCallback(async () => {
    try {
      await persistEnd("tapout");
      dispatch({ type: "TAP_OUT" });
    } catch (err) {
      toast.error(userFacingError(err, t("room.toast.tapOutFailed")));
    }
  }, []);

  const onEndSession = useCallback(async () => {
    try {
      await persistEnd("end");
      dispatch({ type: "END_SESSION" });
    } catch (err) {
      toast.error(userFacingError(err, t("room.toast.endFailed")));
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
      toast.error(userFacingError(err, t("room.toast.sharedBreakFailed")));
    }
  }

  async function onCancelVote() {
    if (!room) return;
    try {
      await cancelBreakVote(createClient(), room.id);
      await loadRoom();
    } catch (err) {
      toast.error(userFacingError(err, t("room.toast.cancelVoteFailed")));
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
            toast.error(userFacingError(err, t("room.toast.leaveFailed")));
            return;
          }
        }
      }
      router.push("/rooms");
    } catch (err) {
      toast.error(userFacingError(err, t("room.toast.leaveFailed")));
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
    () => {
      const shareNow = Date.now();
      return {
        sessionName: state.sessionName || room?.name || t("room.sessionFallback"),
        kind: "room",
        roomCode: room?.code ?? displayCode,
        startedAt: state.sessionStartedAt,
        activeMs: shareDuration,
        breakMs: state.breakMs,
        breakTypesUsed: state.breakTypesUsed,
        breakHistory: state.breakHistory,
        outcome: shareOutcome,
        prBroken: state.didBreakPR,
        dessertMetadata,
        participants: members.map((m) => {
          const live = memberDisplayClock(m, shareNow, selfLive);
          return {
            user_id: m.userId,
            username: m.username,
            active_ms:
              m.userId === userId ? shareDuration : live.elapsedMs,
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
          };
        }),
      };
    },
    [
      state.sessionName,
      state.sessionStartedAt,
      state.breakMs,
      state.breakTypesUsed,
      state.breakHistory,
      state.didBreakPR,
      room?.name,
      room?.code,
      displayCode,
      shareDuration,
      shareOutcome,
      dessertMetadata,
      members,
      userId,
      selfLive,
      t,
    ],
  );

  return (
    <AppShell
      layoutMode="room-focus"
      presence={
        <RoomPresencePane
          members={members}
          selfUserId={userId}
          selfLive={selfLive}
        />
      }
      presenceStrip={
        <RoomPresenceStrip
          members={members}
          selfLive={selfLive}
          compact={
            state.session === "LOCKED_IN" ||
            state.session === "ON_BREAK" ||
            state.session === "CHOOSING_BREAK"
          }
        />
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        {room?.status === "closing" && secondsLeft != null && (
          <ClosingBanner secondsLeft={secondsLeft} />
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
          sessionName={sessionNameDraft}
          onSessionNameChange={setSessionNameDraft}
          lockInDisabled={status === "loading"}
          topBar={
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {t("room.roomCode")}{" "}
                  <span className="font-mono text-sm font-bold tabular-nums tracking-widest text-foreground sm:text-base">
                    {displayCode}
                  </span>
                </p>
                <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                  {isPomodoro ? t("room.pomodoroCadence") : t("room.voteRoom")} ·{" "}
                  {room?.status ?? "…"}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                {(state.session === "IDLE" ||
                  state.session === "TAPPED_OUT" ||
                  state.session === "ENDED") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg border-amber-300 bg-amber-50 px-2.5 font-display text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50 sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300 dark:hover:bg-amber-400/25"
                    onClick={() => dispatch({ type: "OPEN_MELT_BUILDER" })}
                    disabled={status === "loading"}
                  >
                    <IceCreamCone className="mr-1 h-3.5 w-3.5 sm:mr-1.5" />
                    {t("melt.action.meltIt")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm"
                  onClick={async () => {
                    const link = `${window.location.origin}/rooms/${displayCode}`;
                    const result = await shareOrCopyInvite(link);
                    if (result === "copied") {
                      toast.success(t("room.toast.inviteCopied"));
                    } else if (result === "failed") {
                      toast.error(t("room.toast.copyFailed"));
                    }
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5 sm:mr-1.5" />
                  {t("room.invite")}
                </Button>
                {isVoteRoom ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg border-amber-300 bg-amber-50 px-2.5 font-display text-xs font-bold text-amber-900 hover:bg-amber-100 sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm"
                    onClick={() => void onRequestBreak()}
                  >
                    {t("room.breakQuestion")}
                  </Button>
                ) : (
                  <p className="hidden text-[11px] text-muted-foreground sm:block">
                    {t("room.breaksAutomatic")}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm"
                  onClick={() => void onLeave()}
                >
                  {t("room.leave")}
                </Button>
              </div>
            </div>
          }
          heroTitle={
            <h1 className="flex max-w-full flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 pb-0.5 text-center font-display text-lg font-bold leading-snug tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              <span className="min-w-0 max-w-full line-clamp-2">
                {room?.name || t("room.fallbackName")}
              </span>
              <span className="inline-flex shrink-0 items-baseline gap-x-2 whitespace-nowrap leading-snug">
                <LockedInLogo
                  word="Lock"
                  className="text-[0.85em] sm:text-[0.9em]"
                />
                <span>{t("room.heroSession")}</span>
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
          heroLayout="room"
          heroExtra={
            <RoomMeltTable
              members={members}
              selfUserId={userId}
              selfLive={selfLive}
              onBoardPosChange={onMeltBoardPosChange}
            />
          }
        />
      </div>

      <BreakStartDialog
        open={state.session === "CHOOSING_BREAK"}
        required={state.breakSource === "shared"}
        breakTimerMinutes={breakTimerMinutes}
        onClose={() => dispatch({ type: "CLOSE_PIT_STOP" })}
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

      <MeltBuilderDialog
        open={state.meltBuilderOpen}
        onClose={() => dispatch({ type: "CLOSE_MELT_BUILDER" })}
        onMeltIt={(config) => {
          void onMeltLockIn(config);
        }}
        variant="room"
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
            if (prevId && meltConfig) {
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
                    sessionName: state.sessionName || room?.name || null,
                    clientId,
                    roomSessionId: room?.roomSessionId ?? null,
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
                    sessionName: state.sessionName || room?.name || undefined,
                    remoteSessionId: row.id,
                    clientId,
                    meltConfig,
                  });
                } catch (err) {
                  toast.error(
                    userFacingError(err, t("room.toast.startFailed")),
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
              toast.error(userFacingError(err, t("room.toast.voteFailed")));
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
            toast.success(t("room.toast.remoteTapOut"));
          } catch (err) {
            toast.error(userFacingError(err, t("room.toast.remoteTapOutFailed")));
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
        sessionId={lastRemoteId}
        canPost={isAuthenticated && Boolean(lastRemoteId)}
        sessionName={state.sessionName || room?.name}
        receipt={{
          ...roomReceipt,
          endedAt: new Date().toISOString(),
        }}
      />
    </AppShell>
  );
}
