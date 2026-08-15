"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  fetchRoomMembers,
  touchRoomPresence,
} from "@/features/rooms/api";
import type { RoomPresenceMember } from "@/features/rooms/types";
import {
  getFollowRelation,
  requestFollow,
} from "@/features/social/api";
import { userFacingError } from "@/lib/supabase/errors";

const TOUCH_MS = 10_000;

function mergeMembers(
  table: RoomPresenceMember[],
  presence: Map<string, RoomPresenceMember>,
): RoomPresenceMember[] {
  const bySeat = new Map<number, RoomPresenceMember>();
  const extras: RoomPresenceMember[] = [];

  for (const m of table) {
    const live = presence.get(m.userId);
    const next: RoomPresenceMember = live
      ? {
          ...m,
          status: m.status !== "WAITING" ? m.status : live.status,
          elapsedMs: live.elapsedMs || m.elapsedMs,
          username: live.username || m.username,
          displayName: live.displayName || m.displayName,
          avatarPath: live.avatarPath || m.avatarPath,
          breakLabel:
            live.status === "BREAK" || m.status === "BREAK"
              ? live.breakLabel || m.breakLabel || null
              : null,
          breakType:
            live.status === "BREAK" || m.status === "BREAK"
              ? live.breakType || m.breakType || null
              : null,
        }
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
) {
  if (!selfUserId || member.userId === selfUserId) return;

  const message = joinToastMessage(member.username, roomName);
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
  const [channelStatus, setChannelStatus] = useState<
    "idle" | "joined" | "error" | "closed"
  >("idle");
  const selfRef = useRef(self);
  selfRef.current = self;
  const roomNameRef = useRef(roomName);
  roomNameRef.current = roomName;
  const knownIdsRef = useRef<Set<string> | null>(null);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const members = mergeMembers(tableMembers, presenceById);

  const applyTableRows = useCallback(
    (rows: RoomPresenceMember[], cancelled: { current: boolean }) => {
      if (cancelled.current) return;

      const prev = knownIdsRef.current;
      if (prev === null) {
        knownIdsRef.current = new Set(rows.map((r) => r.userId));
      } else {
        const selfId = selfRef.current.userId;
        for (const row of rows) {
          if (prev.has(row.userId)) continue;
          void toastMemberJoined(row, roomNameRef.current, selfId);
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
    void channel
      .track({
        userId: s.userId,
        username: s.username,
        displayName: s.displayName,
        avatarPath: s.avatarPath,
        status: s.status,
        elapsedMs: s.elapsedMs,
        seat: s.seat,
        breakLabel: s.status === "BREAK" ? s.breakLabel ?? null : null,
        breakType: s.status === "BREAK" ? s.breakType ?? null : null,
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!code || !roomId || !self.userId) return;

    const cancelled = { current: false };
    const supabase = createClient();
    const channel = supabase.channel(`room:${code}`, {
      config: { presence: { key: self.userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        if (cancelled.current) return;
        const state = channel.presenceState() as Record<string, unknown[]>;
        const next = new Map<string, RoomPresenceMember>();
        for (const key of Object.keys(state)) {
          const metas = state[key] ?? [];
          for (const meta of metas) {
            const m = meta as RoomPresenceMember;
            const userId = m.userId || key;
            next.set(userId, { ...m, userId });
          }
        }
        setPresenceById(next);
      })
      .subscribe((status) => {
        if (cancelled.current) return;
        if (status === "SUBSCRIBED") {
          setChannelStatus("joined");
          trackSelf();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChannelStatus("error");
        } else if (status === "CLOSED") {
          setChannelStatus("closed");
        }
      });

    const touchId = window.setInterval(() => {
      const s = selfRef.current;
      void touchRoomPresence(
        supabase,
        roomId,
        s.status,
        s.elapsedMs,
        s.status === "BREAK" ? s.breakLabel ?? null : null,
      ).catch(() => undefined);
      trackSelf();
    }, TOUCH_MS);

    return () => {
      cancelled.current = true;
      window.clearInterval(touchId);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [code, roomId, self.userId, trackSelf]);

  const elapsedSec = Math.floor(self.elapsedMs / 1000);
  useEffect(() => {
    trackSelf();
  }, [
    self.status,
    elapsedSec,
    self.seat,
    self.breakLabel,
    self.breakType,
    trackSelf,
  ]);

  useEffect(() => {
    if (!roomId || !self.userId) return;
    void touchRoomPresence(
      createClient(),
      roomId,
      self.status,
      self.elapsedMs,
      self.status === "BREAK" ? self.breakLabel ?? null : null,
    ).catch(() => undefined);
  }, [self.status, self.breakLabel, roomId, self.userId]);

  return { members, channelStatus };
}
