"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  fetchRoomMembers,
  sweepRoom,
  touchRoomPresence,
} from "@/features/rooms/api";
import { pickNewerClockFields } from "@/features/rooms/live-member-clock";
import { mergePresenceOnSync } from "@/features/rooms/presence-merge";
import type { RoomPresenceMember } from "@/features/rooms/types";
import type { MeltConfig } from "@/features/session/melt-catalog";
import {
  getFollowRelation,
  requestFollow,
} from "@/features/social/api";
import { userFacingError } from "@/lib/supabase/errors";

const TOUCH_MS = 10_000;
/** Sweep stale seats every 3 touches (~30s) so disconnects advance closing. */
const SWEEP_EVERY_TOUCHES = 3;

/** Presence track payload: nested melt config is stringified on the wire. */
type PresenceTrackPayload = Omit<RoomPresenceMember, "meltConfig"> & {
  meltConfig?: unknown;
};

function parsePresenceMeltConfig(raw: unknown): MeltConfig | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const cfg = value as Partial<MeltConfig>;
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

function normalizePresenceMember(
  meta: PresenceTrackPayload,
  key: string,
): RoomPresenceMember {
  const userId = meta.userId || key;
  const clamp01 = (v: unknown): number | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    return Math.min(1, Math.max(0, v));
  };
  return {
    ...meta,
    userId,
    meltConfig: parsePresenceMeltConfig(meta.meltConfig),
    meltBoardX: clamp01(meta.meltBoardX),
    meltBoardZ: clamp01(meta.meltBoardZ),
    isAnonymous: Boolean(meta.isAnonymous),
  };
}

/** Exported for unit tests — prefer newer clockSyncedAt over stale presence. */
export function mergeMembers(
  table: RoomPresenceMember[],
  presence: Map<string, RoomPresenceMember>,
  opts?: { presenceSynced?: boolean },
): RoomPresenceMember[] {
  const bySeat = new Map<number, RoomPresenceMember>();
  const extras: RoomPresenceMember[] = [];
  const presenceSynced = opts?.presenceSynced ?? false;

  for (const m of table) {
    const live = presence.get(m.userId);
    // After Realtime has synced once, drop idle seats that left presence
    // (tab/app closed). Keep LOCKED_IN/BREAK ghosts for sleep/reconnect.
    if (presenceSynced && !live) {
      if (m.status !== "LOCKED_IN" && m.status !== "BREAK") {
        continue;
      }
    }
    const next: RoomPresenceMember = live
      ? (() => {
          // Prefer DB status when it already left WAITING so a stale presence
          // snapshot cannot erase a persisted melt_config / board seat.
          const effectiveStatus =
            m.status !== "WAITING" ? m.status : live.status;
          const inMeltFocus =
            effectiveStatus === "LOCKED_IN" || effectiveStatus === "BREAK";
          const customizing = inMeltFocus
            ? false
            : (live.meltCustomizing ?? m.meltCustomizing ?? false);
          const clocks = pickNewerClockFields(live, m);
          const onBreak =
            effectiveStatus === "BREAK" ||
            live.status === "BREAK" ||
            m.status === "BREAK";
          return {
            ...m,
            status: effectiveStatus,
            elapsedMs: clocks.elapsedMs,
            clockSyncedAt: clocks.clockSyncedAt,
            username: live.username || m.username,
            displayName: live.displayName || m.displayName,
            avatarPath: live.avatarPath || m.avatarPath,
            isAnonymous: live.isAnonymous ?? m.isAnonymous ?? false,
            breakLabel: onBreak
              ? live.breakLabel || m.breakLabel || null
              : null,
            breakType: onBreak
              ? live.breakType || m.breakType || null
              : null,
            breakElapsedMs: onBreak ? clocks.breakElapsedMs ?? 0 : 0,
            breakRemainingMs: onBreak ? clocks.breakRemainingMs ?? 0 : 0,
            breakOpenEnded: onBreak ? clocks.breakOpenEnded ?? false : false,
            meltConfig:
              inMeltFocus || customizing
                ? live.meltConfig ?? m.meltConfig ?? null
                : null,
            meltAnimOffsetMs: live.meltAnimOffsetMs ?? m.meltAnimOffsetMs ?? 0,
            meltAnimSpeed: live.meltAnimSpeed ?? m.meltAnimSpeed ?? 1,
            meltCustomizing: customizing,
            meltStatusLabel: live.meltStatusLabel ?? m.meltStatusLabel ?? null,
            meltBoardX: inMeltFocus
              ? live.meltBoardX ?? m.meltBoardX ?? null
              : null,
            meltBoardZ: inMeltFocus
              ? live.meltBoardZ ?? m.meltBoardZ ?? null
              : null,
          };
        })()
      : m;
    if (typeof next.seat === "number" && next.seat >= 1) {
      bySeat.set(next.seat, next);
    } else {
      extras.push(next);
    }
  }

  const slots: RoomPresenceMember[] = [];
  for (let seat = 1; seat <= 6; seat += 1) {
    const m = bySeat.get(seat);
    if (m) slots.push(m);
  }
  return [...slots, ...extras];
}

function joinToastMessage(username: string, roomName: string | null | undefined) {
  const name = roomName?.trim();
  const who = username.trim() || "Someone";
  return name ? `${who} entered ${name}` : `${who} entered the room`;
}

async function toastMemberJoined(
  member: RoomPresenceMember,
  roomName: string | null | undefined,
  selfUserId: string | null,
  selfIsAnonymous: boolean,
) {
  if (!selfUserId || member.userId === selfUserId) return;

  const message = joinToastMessage(member.username, roomName);
  const targetIsAnonymous = Boolean(member.isAnonymous);

  // Guests cannot follow; logged-in users cannot follow guests.
  if (selfIsAnonymous || targetIsAnonymous) {
    toast.message(message);
    return;
  }

  let relation: Awaited<ReturnType<typeof getFollowRelation>> = "none";
  try {
    relation = await getFollowRelation(createClient(), member.userId);
  } catch {
    /* still show join toast without Follow */
  }

  if (relation === "none" || relation === "rejected") {
    toast.message(message, {
      action: {
        label: "Follow",
        onClick: () => {
          void requestFollow(createClient(), member.userId)
            .then(() => toast.success(`Followed @${member.username}`))
            .catch((err) =>
              toast.error(userFacingError(err, "Follow action failed")),
            );
        },
      },
    });
    return;
  }

  toast.message(message);
}

export function useRoomChannel(
  code: string | null,
  roomId: string | null,
  self: Omit<RoomPresenceMember, "userId"> & { userId: string | null },
  roomName?: string | null,
) {
  const [tableMembers, setTableMembers] = useState<RoomPresenceMember[]>([]);
  const [presenceById, setPresenceById] = useState<
    Map<string, RoomPresenceMember>
  >(() => new Map());
  const [presenceSynced, setPresenceSynced] = useState(false);
  const [channelStatus, setChannelStatus] = useState<
    "idle" | "joined" | "error" | "closed"
  >("idle");
  const selfRef = useRef(self);
  selfRef.current = self;
  const roomNameRef = useRef(roomName);
  roomNameRef.current = roomName;
  const knownIdsRef = useRef<Set<string> | null>(null);
  const tableMembersRef = useRef<RoomPresenceMember[]>([]);
  tableMembersRef.current = tableMembers;
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const touchCountRef = useRef(0);

  const members = mergeMembers(tableMembers, presenceById, {
    presenceSynced,
  });

  const applyTableRows = useCallback(
    (rows: RoomPresenceMember[], cancelled: { current: boolean }) => {
      if (cancelled.current) return;

      const prev = knownIdsRef.current;
      if (prev === null) {
        knownIdsRef.current = new Set(rows.map((r) => r.userId));
      } else {
        const selfId = selfRef.current.userId;
        const selfAnon = Boolean(selfRef.current.isAnonymous);
        for (const row of rows) {
          if (prev.has(row.userId)) continue;
          void toastMemberJoined(row, roomNameRef.current, selfId, selfAnon);
        }
        knownIdsRef.current = new Set(rows.map((r) => r.userId));
      }

      setTableMembers(rows);
    },
    [],
  );

  const loadTable = useCallback(
    async (id: string, cancelled: { current: boolean }) => {
      try {
        const rows = await fetchRoomMembers(createClient(), id);
        applyTableRows(rows, cancelled);
      } catch {
        /* keep last snapshot */
      }
    },
    [applyTableRows],
  );

  useEffect(() => {
    knownIdsRef.current = null;
    if (!roomId) {
      setTableMembers([]);
      return;
    }
    const cancelled = { current: false };
    void loadTable(roomId, cancelled);

    const supabase = createClient();
    const channel = supabase
      .channel(`room-members:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void loadTable(roomId, cancelled);
        },
      )
      .subscribe();

    return () => {
      cancelled.current = true;
      knownIdsRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomId, loadTable]);

  const trackSelf = useCallback(() => {
    const channel = channelRef.current;
    const s = selfRef.current;
    if (!channel || !s.userId) return;
    const meltActive =
      (s.status === "LOCKED_IN" || s.status === "BREAK") && Boolean(s.meltConfig);
    const clockSyncedAt = Date.now();
    const payload: PresenceTrackPayload = {
      userId: s.userId,
      username: s.username,
      displayName: s.displayName,
      avatarPath: s.avatarPath,
      status: s.status,
      elapsedMs: s.elapsedMs,
      clockSyncedAt,
      seat: s.seat,
      isAnonymous: Boolean(s.isAnonymous),
      breakLabel: s.status === "BREAK" ? s.breakLabel ?? null : null,
      breakType: s.status === "BREAK" ? s.breakType ?? null : null,
      breakElapsedMs: s.status === "BREAK" ? s.breakElapsedMs ?? 0 : 0,
      breakRemainingMs: s.status === "BREAK" ? s.breakRemainingMs ?? 0 : 0,
      breakOpenEnded:
        s.status === "BREAK" ? s.breakOpenEnded ?? false : false,
      // Stringify nested melt config so Realtime presence does not drop it.
      meltConfig: meltActive ? JSON.stringify(s.meltConfig) : null,
      meltAnimOffsetMs: meltActive ? (s.meltAnimOffsetMs ?? 0) : 0,
      meltAnimSpeed: s.meltAnimSpeed ?? 1,
      meltCustomizing: s.meltCustomizing ?? false,
      meltStatusLabel: s.meltStatusLabel ?? null,
      meltBoardX: meltActive ? (s.meltBoardX ?? null) : null,
      meltBoardZ: meltActive ? (s.meltBoardZ ?? null) : null,
    };
    // Optimistically update local presence so self timers move even when
    // Realtime does not echo metadata-only track() updates.
    setPresenceById((prev) => {
      const next = new Map(prev);
      next.set(
        s.userId!,
        normalizePresenceMember(payload, s.userId!),
      );
      return next;
    });
    void channel.track(payload).catch(() => undefined);
  }, []);

  const touchSelf = useCallback((roomIdArg: string) => {
    const s = selfRef.current;
    const meltActive =
      (s.status === "LOCKED_IN" || s.status === "BREAK") && Boolean(s.meltConfig);
    void touchRoomPresence(
      createClient(),
      roomIdArg,
      s.status,
      s.elapsedMs,
      s.status === "BREAK" ? s.breakType ?? null : null,
      meltActive ? (s.meltConfig ?? null) : null,
      meltActive ? (s.meltAnimOffsetMs ?? 0) : 0,
      meltActive ? (s.meltBoardX ?? null) : null,
      meltActive ? (s.meltBoardZ ?? null) : null,
    ).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!code || !roomId || !self.userId) return;

    const cancelled = { current: false };
    const supabase = createClient();
    const channel = supabase.channel(`room:${code}`, {
      config: { presence: { key: self.userId } },
    });
    channelRef.current = channel;
    setPresenceSynced(false);

    channel
      .on("presence", { event: "sync" }, () => {
        if (cancelled.current) return;
        const state = channel.presenceState() as Record<string, unknown[]>;
        const incoming = new Map<string, RoomPresenceMember>();
        for (const key of Object.keys(state)) {
          const metas = state[key] ?? [];
          for (const meta of metas) {
            const m = normalizePresenceMember(
              meta as RoomPresenceMember & { meltConfig?: unknown },
              key,
            );
            incoming.set(m.userId, m);
          }
        }
        setPresenceById((prev) =>
          mergePresenceOnSync(incoming, prev, tableMembersRef.current),
        );
        setPresenceSynced(true);
      })
      .subscribe((status) => {
        if (cancelled.current) return;
        if (status === "SUBSCRIBED") {
          setChannelStatus("joined");
          trackSelf();
          touchSelf(roomId);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChannelStatus("error");
        } else if (status === "CLOSED") {
          setChannelStatus("closed");
        }
      });

    const touchId = window.setInterval(() => {
      touchSelf(roomId);
      trackSelf();
      touchCountRef.current += 1;
      if (touchCountRef.current % SWEEP_EVERY_TOUCHES === 0) {
        void sweepRoom(createClient(), roomId)
          .then(() => loadTable(roomId, cancelled))
          .catch(() => undefined);
      }
    }, TOUCH_MS);

    return () => {
      cancelled.current = true;
      window.clearInterval(touchId);
      channelRef.current = null;
      touchCountRef.current = 0;
      setPresenceSynced(false);
      void supabase.removeChannel(channel);
    };
  }, [code, roomId, self.userId, trackSelf, touchSelf, loadTable]);

  const elapsedSec = Math.floor(self.elapsedMs / 1000);
  const breakClockSec = Math.floor(
    ((self.breakOpenEnded ? self.breakElapsedMs : self.breakRemainingMs) ?? 0) /
      1000,
  );
  useEffect(() => {
    trackSelf();
  }, [
    self.avatarPath,
    self.username,
    self.status,
    self.isAnonymous,
    elapsedSec,
    self.seat,
    self.breakLabel,
    self.breakType,
    breakClockSec,
    self.breakOpenEnded,
    self.meltConfig,
    self.meltAnimOffsetMs,
    self.meltAnimSpeed,
    self.meltCustomizing,
    self.meltStatusLabel,
    self.meltBoardX,
    self.meltBoardZ,
    trackSelf,
  ]);

  useEffect(() => {
    if (!roomId || !self.userId) return;
    touchSelf(roomId);
  }, [
    self.status,
    self.breakType,
    self.meltConfig,
    self.meltAnimOffsetMs,
    self.meltBoardX,
    self.meltBoardZ,
    roomId,
    self.userId,
    touchSelf,
  ]);

  return { members, channelStatus };
}
