"use client";

import { use, useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { FocusTimer } from "@/components/session/FocusTimer";
import { ClosingBanner } from "@/components/rooms/ClosingBanner";
import { RoomPresencePane } from "@/components/rooms/RoomPresencePane";
import { RoomPresenceStrip } from "@/components/rooms/RoomPresenceStrip";
import { BreakVoteDialog } from "@/components/rooms/BreakVoteDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  castBreakVote,
  fetchRoomByCode,
  leaveRoom,
  requestSharedBreak,
} from "@/features/rooms/api";
import { useRoomCloseWatch } from "@/features/rooms/closeWatch";
import { usePomodoroCadence } from "@/features/rooms/usePomodoroCadence";
import { useRoomChannel } from "@/features/rooms/useRoomChannel";
import type { RoomSummary } from "@/features/rooms/types";
import { initialState, reducer } from "@/features/session/reducer";
import { useSessionClock } from "@/features/session/useSessionClock";
import { createClient } from "@/lib/supabase/client";
import { publicAvatarUrl } from "@/features/profile/api";
import { userFacingError } from "@/lib/supabase/errors";

export default function RoomFocusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const { status, user, profile, avatarUrl } = useAuth();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [sessionNameDraft, setSessionNameDraft] = useState("");
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteEndsAt, setVoteEndsAt] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<"break" | "stay" | null>(null);

  const userId = user?.id ?? null;
  const username = profile?.username?.trim() || "you";
  const avatarPath = avatarUrl;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchRoomByCode(createClient(), code);
        if (!cancelled) setRoom(next);
      } catch {
        if (!cancelled) setRoom(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const { secondsLeft } = useRoomCloseWatch(room?.closesAt);
  const { isPomodoro } = usePomodoroCadence(room);

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

  const roomMembers = members.length
    ? members
    : ([presenceSelf].filter((m) => m.userId) as typeof members);

  useEffect(() => {
    if (state.session === "ENDED" || state.session === "TAPPED_OUT") {
      setSessionNameDraft("");
    }
  }, [state.session]);

  async function onRequestBreak() {
    if (!room || isPomodoro) return;
    try {
      const data = (await requestSharedBreak(
        createClient(),
        room.id,
      )) as { round_id?: string; ends_at?: string } | null;
      setRoundId(data?.round_id ?? "round");
      setVoteEndsAt(data?.ends_at ?? new Date(Date.now() + 30_000).toISOString());
      setMyVote("break");
      setVoteOpen(true);
    } catch (err) {
      toast.error(userFacingError(err, "Could not start shared break"));
      dispatch({ type: "OPEN_PIT_STOP" });
    }
  }

  return (
    <AppShell
      layoutMode="room-focus"
      presence={<RoomPresencePane members={roomMembers} />}
      presenceStrip={<RoomPresenceStrip members={roomMembers} />}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-slate-900">
              Room {code.toUpperCase()}
            </p>
            <p className="text-xs text-slate-500">
              {room?.kind === "pomodoro" ? "Pomodoro cadence" : "Vote room"} ·{" "}
              {room?.status ?? "…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isPomodoro && state.session === "LOCKED_IN" && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={onRequestBreak}
              >
                Request shared break
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
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
              }}
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
          onLockIn={() =>
            dispatch({ type: "LOCK_IN", sessionName: sessionNameDraft })
          }
          onPitStop={onRequestBreak}
          onLockBackIn={() => dispatch({ type: "LOCK_BACK_IN" })}
          onEndSession={() => dispatch({ type: "END_SESSION" })}
          onTapOut={() => dispatch({ type: "TAP_OUT" })}
          onShare={() => dispatch({ type: "OPEN_SHARE" })}
          onClearPrBurst={() => dispatch({ type: "CLEAR_PR_BURST" })}
        />
      </div>

      <BreakVoteDialog
        open={voteOpen}
        endsAt={voteEndsAt}
        tallies={{ break: 1, stay: 0 }}
        myVote={myVote}
        onVote={async (choice) => {
          const previous = myVote;
          setMyVote(choice);
          if (room && roundId) {
            try {
              await castBreakVote(createClient(), room.id, roundId, choice);
            } catch (err) {
              setMyVote(previous);
              toast.error(userFacingError(err, "Vote failed"));
            }
          }
        }}
        onClose={() => setVoteOpen(false)}
      />
    </AppShell>
  );
}
