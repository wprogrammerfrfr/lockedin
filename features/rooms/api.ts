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

function roomStatusOf(rooms: unknown): string | null {
  if (!rooms) return null;
  const row = Array.isArray(rooms) ? rooms[0] : rooms;
  if (row && typeof row === "object" && "status" in row) {
    return String((row as { status: unknown }).status);
  }
  return null;
}

function isAlreadyInOtherRoom(err: unknown): boolean {
  return err instanceof Error && err.message.includes("already_in_other_room");
}

export async function leaveRoom(supabase: SupabaseClient, roomId: string) {
  const { error } = await supabase.rpc("leave_room", { p_room_id: roomId });
  if (error) throw new Error(error.message);
}

/** Leave waiting/live/closing rooms so a new create/join is not blocked. */
export async function leaveOpenRooms(
  supabase: SupabaseClient,
  exceptRoomId?: string,
) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return;

  const { data, error } = await supabase
    .from("room_members")
    .select("room_id, rooms!inner(status)")
    .eq("user_id", userId);
  if (error || !data) return;

  for (const row of data) {
    const status = roomStatusOf((row as { rooms?: unknown }).rooms);
    if (status !== "waiting" && status !== "live" && status !== "closing") {
      continue;
    }
    const roomId = (row as { room_id: string }).room_id;
    if (exceptRoomId && roomId === exceptRoomId) continue;
    try {
      await leaveRoom(supabase, roomId);
    } catch {
      /* stale membership best-effort */
    }
  }
}

async function withStaleMembershipRetry<T>(
  supabase: SupabaseClient,
  fn: () => Promise<T>,
  exceptRoomId?: string,
): Promise<T> {
  await leaveOpenRooms(supabase, exceptRoomId);
  try {
    return await fn();
  } catch (err) {
    if (!isAlreadyInOtherRoom(err)) throw err;
    await leaveOpenRooms(supabase, exceptRoomId);
    return await fn();
  }
}

export async function createRoom(supabase: SupabaseClient) {
  return withStaleMembershipRetry(supabase, async () => {
    const { data, error } = await supabase.rpc("create_room");
    if (error) throw new Error(error.message);
    return asRoom(data);
  });
}

export async function createPomodoroRoom(
  supabase: SupabaseClient,
  workMinutes: number,
  breakMinutes: number,
) {
  return withStaleMembershipRetry(supabase, async () => {
    const { data, error } = await supabase.rpc("create_pomodoro_room", {
      work_minutes: workMinutes,
      break_minutes: breakMinutes,
    });
    if (error) throw new Error(error.message);
    return asRoom(data);
  });
}

export async function joinRoom(supabase: SupabaseClient, code: string) {
  const normalized = code.trim().toUpperCase();
  const existing = await fetchRoomByCode(supabase, normalized).catch(
    () => null,
  );
  return withStaleMembershipRetry(
    supabase,
    async () => {
      const { data, error } = await supabase.rpc("join_room", {
        p_code: normalized,
      });
      if (error) throw new Error(error.message);
      return asRoom(data);
    },
    existing?.id,
  );
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
