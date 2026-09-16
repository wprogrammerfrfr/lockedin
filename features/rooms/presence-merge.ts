import { pickNewerClockFields } from "@/features/rooms/live-member-clock";
import type { RoomPresenceMember } from "@/features/rooms/types";

function isLiveFocusStatus(status: RoomPresenceMember["status"]): boolean {
  return status === "LOCKED_IN" || status === "BREAK";
}

/**
 * Merge Realtime presence with optimistic local stamps and ghost peers whose
 * devices slept (dropped from presence but still LOCKED_IN/BREAK in the table).
 */
export function mergePresenceOnSync(
  incoming: Map<string, RoomPresenceMember>,
  prev: Map<string, RoomPresenceMember>,
  tableMembers: RoomPresenceMember[],
): Map<string, RoomPresenceMember> {
  const next = new Map<string, RoomPresenceMember>();

  for (const [id, remote] of incoming) {
    const local = prev.get(id);
    if (!local) {
      next.set(id, remote);
      continue;
    }
    const clocks = pickNewerClockFields(remote, local);
    next.set(id, {
      ...remote,
      elapsedMs: clocks.elapsedMs,
      clockSyncedAt: clocks.clockSyncedAt,
      breakElapsedMs: clocks.breakElapsedMs,
      breakRemainingMs: clocks.breakRemainingMs,
      breakOpenEnded: clocks.breakOpenEnded,
    });
  }

  for (const row of tableMembers) {
    if (incoming.has(row.userId)) continue;
    if (!isLiveFocusStatus(row.status)) continue;
    const ghost = prev.get(row.userId);
    if (!ghost || !isLiveFocusStatus(ghost.status)) continue;
    next.set(row.userId, {
      ...ghost,
      status: row.status,
      seat: row.seat ?? ghost.seat,
      username: row.username || ghost.username,
      displayName: row.displayName || ghost.displayName,
      avatarPath: row.avatarPath || ghost.avatarPath,
      breakLabel: row.breakLabel ?? ghost.breakLabel,
      breakType: row.breakType ?? ghost.breakType,
    });
  }

  return next;
}
