import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoomRow } from "@/types/database";
import type { BreakVoteChoice, RoomSummary } from "@/features/rooms/types";

function mapRoom(row: RoomRow): RoomSummary {
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    closesAt: row.closes_at,
    kind: row.kind ?? "vote",
    workMs: row.work_ms,
    breakMs: row.break_ms,
    phase: row.phase,
    phaseStartedAt: row.phase_started_at,
  };
}

function asRoom(data: unknown): RoomSummary {
  const row = (Array.isArray(data) ? data[0] : data) as RoomRow;
  return mapRoom(row);
}

export async function createRoom(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("create_room");
  if (error) throw new Error(error.message);
  return asRoom(data);
}

export async function createPomodoroRoom(
  supabase: SupabaseClient,
  workMinutes: number,
  breakMinutes: number,
) {
  const { data, error } = await supabase.rpc("create_pomodoro_room", {
    work_minutes: workMinutes,
    break_minutes: breakMinutes,
  });
  if (error) throw new Error(error.message);
  return asRoom(data);
}

export async function joinRoom(supabase: SupabaseClient, code: string) {
  const { data, error } = await supabase.rpc("join_room", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return asRoom(data);
}

export async function leaveRoom(supabase: SupabaseClient, roomId: string) {
  const { error } = await supabase.rpc("leave_room", { p_room_id: roomId });
  if (error) throw new Error(error.message);
}

export async function touchRoomPresence(
  supabase: SupabaseClient,
  roomId: string,
) {
  const { error } = await supabase.rpc("touch_room_presence", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
}

export async function requestSharedBreak(
  supabase: SupabaseClient,
  roomId: string,
) {
  const { data, error } = await supabase.rpc("request_shared_break", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function castBreakVote(
  supabase: SupabaseClient,
  roomId: string,
  roundId: string,
  choice: BreakVoteChoice,
) {
  const { error } = await supabase.rpc("cast_break_vote", {
    p_room_id: roomId,
    p_round_id: roundId,
    p_choice: choice,
  });
  if (error) throw new Error(error.message);
}

export async function pomodoroTick(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase.rpc("pomodoro_tick", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  return data ? asRoom(data) : null;
}

export async function fetchRoomByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<RoomSummary | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRoom(data as RoomRow);
}
