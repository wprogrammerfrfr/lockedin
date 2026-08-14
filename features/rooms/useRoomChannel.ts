"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { touchRoomPresence } from "@/features/rooms/api";
import type { RoomPresenceMember } from "@/features/rooms/types";

const TOUCH_MS = 10_000;

export function useRoomChannel(
  code: string | null,
  roomId: string | null,
  self: Omit<RoomPresenceMember, "userId"> & { userId: string | null },
) {
  const [members, setMembers] = useState<RoomPresenceMember[]>([]);
  const [channelStatus, setChannelStatus] = useState<
    "idle" | "joined" | "error" | "closed"
  >("idle");
  const selfRef = useRef(self);
  selfRef.current = self;

  const syncPresence = useCallback(
    (state: Record<string, unknown[]>, cancelled: { current: boolean }) => {
      if (cancelled.current) return;
      const next: RoomPresenceMember[] = [];
      for (const key of Object.keys(state)) {
        const metas = state[key] ?? [];
        for (const meta of metas) {
          next.push(meta as RoomPresenceMember);
        }
      }
      setMembers(next);
    },
    [],
  );

  useEffect(() => {
    if (!code || !roomId || !self.userId) return;

    const cancelled = { current: false };
    const supabase = createClient();
    const channel = supabase.channel(`room:${code}`, {
      config: { presence: { key: self.userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        syncPresence(
          channel.presenceState() as Record<string, unknown[]>,
          cancelled,
        );
      })
      .subscribe((status) => {
        if (cancelled.current) return;
        if (status === "SUBSCRIBED") {
          setChannelStatus("joined");
          const s = selfRef.current;
          void channel
            .track({
              userId: s.userId,
              username: s.username,
              displayName: s.displayName,
              avatarPath: s.avatarPath,
              status: s.status,
              elapsedMs: s.elapsedMs,
              seat: s.seat,
            })
            .catch(() => undefined);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChannelStatus("error");
          setMembers((prev) =>
            prev.map((m) =>
              m.userId === self.userId ? { ...m, status: "LACKING" } : m,
            ),
          );
        } else if (status === "CLOSED") {
          setChannelStatus("closed");
        }
      });

    const touchId = window.setInterval(() => {
      void touchRoomPresence(supabase, roomId).catch(() => undefined);
      const s = selfRef.current;
      void channel
        .track({
          userId: s.userId,
          username: s.username,
          displayName: s.displayName,
          avatarPath: s.avatarPath,
          status: s.status,
          elapsedMs: s.elapsedMs,
          seat: s.seat,
        })
        .catch(() => undefined);
    }, TOUCH_MS);

    return () => {
      cancelled.current = true;
      window.clearInterval(touchId);
      void supabase.removeChannel(channel);
    };
  }, [code, roomId, self.userId, syncPresence]);

  return { members, channelStatus };
}
