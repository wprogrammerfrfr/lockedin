"use client";

import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { pomodoroTick } from "@/features/rooms/api";
import type { RoomSummary } from "@/features/rooms/types";

/**
 * For pomodoro rooms: poll pomodoro_tick and expose remaining ms in the
 * current server phase so late joiners sync to wall-clock cadence.
 */
export function usePomodoroCadence(
  room: RoomSummary | null,
  onPhase?: (phase: "work" | "break", remainingMs: number) => void,
) {
  const isPomodoro = room?.kind === "pomodoro" && room.status === "live";

  const remainingMs = useMemo(() => {
    if (!isPomodoro || !room?.phaseStartedAt) return 0;
    const started = new Date(room.phaseStartedAt).getTime();
    const duration =
      room.phase === "break"
        ? room.breakMs ?? 10 * 60_000
        : room.workMs ?? 50 * 60_000;
    return Math.max(0, duration - (Date.now() - started));
  }, [isPomodoro, room]);

  useEffect(() => {
    if (!isPomodoro || !room?.id) return;

    toast.message("This room runs on a Pomodoro cadence.", {
      id: `pomodoro-${room.id}`,
      duration: 4000,
    });

    const supabase = createClient();
    const id = window.setInterval(() => {
      void pomodoroTick(supabase, room.id).catch(() => undefined);
    }, 5_000);

    return () => window.clearInterval(id);
  }, [isPomodoro, room?.id]);

  useEffect(() => {
    if (!isPomodoro || !room?.phase) return;
    const phase = room.phase === "break" ? "break" : "work";
    onPhase?.(phase, remainingMs);
  }, [isPomodoro, onPhase, remainingMs, room?.phase]);

  return {
    isPomodoro,
    phase: (room?.phase === "break" ? "break" : "work") as "work" | "break",
    remainingMs,
  };
}
