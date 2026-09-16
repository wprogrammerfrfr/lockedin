import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoomRow } from "@/types/database";
import type {
  BreakVoteChoice,
  RoomPresenceMember,
  RoomSummary,
} from "@/features/rooms/types";
import type { MeltConfig } from "@/features/session/melt-catalog";
import { publicAvatarUrl } from "@/features/profile/api";

function parseMeltConfig(raw: unknown): MeltConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as Partial<MeltConfig>;
  if (
    (cfg.kind !== "iceCream" && cfg.kind !== "ice") ||
    typeof cfg.containerId !== "string" ||
    typeof cfg.meltDurationMs !== "number" ||
    typeof cfg.displayName !== "string"
  ) {
    return null;
  }
  return cfg as MeltConfig;
}

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
    name: row.name ?? null,
    roomSessionId: row.room_session_id ?? null,
    activeBreakRoundId: row.active_break_round_id ?? null,
    breakVoteEndsAt: row.break_vote_ends_at ?? null,
    breakVoteRequestedBy: row.break_vote_requested_by ?? null,
    lastVoteRoundId: row.last_vote_round_id ?? null,
    lastVoteResult: row.last_vote_result ?? null,
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

export async function createRoom(supabase: SupabaseClient, name: string) {
  return withStaleMembershipRetry(supabase, async () => {
    const { data, error } = await supabase.rpc("create_room", {
      p_name: name.trim(),
    });
    if (error) throw new Error(error.message);
    return asRoom(data);
  });
}

export async function createPomodoroRoom(
  supabase: SupabaseClient,
  workMinutes: number,
  breakMinutes: number,
  name: string,
) {
  return withStaleMembershipRetry(supabase, async () => {
    const { data, error } = await supabase.rpc("create_pomodoro_room", {
      work_minutes: workMinutes,
      break_minutes: breakMinutes,
      p_name: name.trim(),
    });
    if (error) throw new Error(error.message);
    return asRoom(data);
  });
}

export async function joinRoom(supabase: SupabaseClient, code: string) {
  const normalized = code.trim();
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
  status?: string | null,
  elapsedMs?: number | null,
  breakLabel?: string | null,
  meltConfig?: MeltConfig | null,
  meltAnimOffsetMs?: number | null,
  meltBoardX?: number | null,
  meltBoardZ?: number | null,
) {
  const { error } = await supabase.rpc("touch_room_presence", {
    p_room_id: roomId,
    p_status: status ?? null,
    p_elapsed_ms:
      typeof elapsedMs === "number" ? Math.round(elapsedMs) : null,
    p_break_label: breakLabel?.trim() || null,
    p_melt_config: meltConfig ?? null,
    p_melt_anim_offset_ms:
      typeof meltAnimOffsetMs === "number" ? Math.round(meltAnimOffsetMs) : 0,
    p_melt_board_x:
      typeof meltBoardX === "number" && Number.isFinite(meltBoardX)
        ? Math.min(1, Math.max(0, meltBoardX))
        : null,
    p_melt_board_z:
      typeof meltBoardZ === "number" && Number.isFinite(meltBoardZ)
        ? Math.min(1, Math.max(0, meltBoardZ))
        : null,
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
  return asRoom(data);
}

export async function castBreakVote(
  supabase: SupabaseClient,
  roomId: string,
  choice: BreakVoteChoice,
) {
  const { error } = await supabase.rpc("cast_break_vote", {
    p_room_id: roomId,
    p_choice: choice,
  });
  if (error) throw new Error(error.message);
}

export async function cancelBreakVote(
  supabase: SupabaseClient,
  roomId: string,
) {
  const { data, error } = await supabase.rpc("cancel_break_vote", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  return asRoom(data);
}

export async function resolveBreakVote(
  supabase: SupabaseClient,
  roomId: string,
): Promise<{ result: "break" | "stay" | "cancelled" | null }> {
  const { data, error } = await supabase.rpc("resolve_break_vote", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  const row = data as { result?: string | null } | null;
  const result = row?.result;
  if (result === "break" || result === "stay" || result === "cancelled") {
    return { result };
  }
  return { result: null };
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
    .eq("code", code.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRoom(data as RoomRow);
}

export async function fetchRoomMembers(
  supabase: SupabaseClient,
  roomId: string,
): Promise<RoomPresenceMember[]> {
  const { data, error } = await supabase
    .from("room_members")
    .select(
      "user_id, seat, focus_status, elapsed_ms, break_label, last_seen_at, melt_config, melt_anim_offset_ms, melt_board_x, melt_board_z, profiles(username, avatar_path)",
    )
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const profile = Array.isArray(
      (row as { profiles?: unknown }).profiles,
    )
      ? (row as { profiles: { username?: string; avatar_path?: string | null }[] })
          .profiles[0]
      : (row as { profiles?: { username?: string; avatar_path?: string | null } })
          .profiles;
    const username = profile?.username?.trim() || "member";
    const rawStatus = (row as { focus_status?: string | null }).focus_status;
    const status: RoomPresenceMember["status"] =
      rawStatus === "LOCKED_IN" ||
      rawStatus === "BREAK" ||
      rawStatus === "LACKING" ||
      rawStatus === "IDLE"
        ? rawStatus
        : "WAITING";
    const breakLabel =
      (row as { break_label?: string | null }).break_label?.trim() || null;
    const meltConfig = parseMeltConfig(
      (row as { melt_config?: unknown }).melt_config,
    );
    const rawBoardX = (row as { melt_board_x?: number | null }).melt_board_x;
    const rawBoardZ = (row as { melt_board_z?: number | null }).melt_board_z;
    const meltBoardX =
      typeof rawBoardX === "number" && Number.isFinite(rawBoardX)
        ? Math.min(1, Math.max(0, rawBoardX))
        : null;
    const meltBoardZ =
      typeof rawBoardZ === "number" && Number.isFinite(rawBoardZ)
        ? Math.min(1, Math.max(0, rawBoardZ))
        : null;
    const lastSeenRaw = (row as { last_seen_at?: string | null }).last_seen_at;
    const lastSeenMs = lastSeenRaw ? Date.parse(lastSeenRaw) : NaN;
    const clockSyncedAt = Number.isFinite(lastSeenMs) ? lastSeenMs : undefined;

    return {
      userId: (row as { user_id: string }).user_id,
      username,
      displayName: username,
      avatarPath: publicAvatarUrl(profile?.avatar_path ?? null),
      status,
      elapsedMs: Number((row as { elapsed_ms?: number | null }).elapsed_ms) || 0,
      clockSyncedAt,
      // DB has no break ms fields; Realtime presence / ghost stamps win in merge.
      seat: (row as { seat?: number | null }).seat ?? null,
      breakLabel,
      // break_label stores the stable break type id for table-only fallback.
      breakType: breakLabel,
      meltConfig,
      meltAnimOffsetMs:
        Number(
          (row as { melt_anim_offset_ms?: number | null }).melt_anim_offset_ms,
        ) || 0,
      meltBoardX,
      meltBoardZ,
    };
  });
}

export async function fetchBreakVotes(
  supabase: SupabaseClient,
  roomId: string,
  roundId: string,
): Promise<{ break: number; stay: number; myVote: BreakVoteChoice | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const { data, error } = await supabase
    .from("room_break_votes")
    .select("user_id, choice")
    .eq("room_id", roomId)
    .eq("round_id", roundId);
  if (error) throw new Error(error.message);
  let breakN = 0;
  let stayN = 0;
  let myVote: BreakVoteChoice | null = null;
  for (const row of data ?? []) {
    const choice = (row as { choice: string }).choice;
    if (choice === "break") breakN += 1;
    if (choice === "stay") stayN += 1;
    if (uid && (row as { user_id: string }).user_id === uid) {
      myVote = choice === "stay" ? "stay" : "break";
    }
  }
  return { break: breakN, stay: stayN, myVote };
}
