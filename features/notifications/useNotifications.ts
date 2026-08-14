"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api";
import type { NotificationRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

export function useNotifications(enabled = true) {
  const { user, isAuthenticated } = useAuth();
  const uid = user?.id;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !isAuthenticated) {
      if (mountedRef.current) setItems([]);
      return;
    }
    if (mountedRef.current) setLoading(true);
    try {
      const supabase = createClient();
      const next = await listNotifications(supabase);
      if (mountedRef.current) setItems(next);
    } catch {
      if (mountedRef.current) setItems([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !uid) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const topicPrefix = `notifications:${uid}`;
    for (const existing of supabase.getChannels()) {
      const topic = existing.topic ?? "";
      if (
        topic === `realtime:${topicPrefix}` ||
        topic.startsWith(`realtime:${topicPrefix}:`) ||
        topic === topicPrefix ||
        topic.startsWith(`${topicPrefix}:`)
      ) {
        void supabase.removeChannel(existing);
      }
    }

    const instanceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`;

    channel = supabase
      .channel(`${topicPrefix}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, isAuthenticated, uid, refresh]);

  const markRead = useCallback(async (id: string) => {
    try {
      await markNotificationRead(createClient(), id);
      if (!mountedRef.current) return;
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
    } catch {
      /* keep unread state */
    }
  }, []);

  const markAll = useCallback(async () => {
    try {
      await markAllNotificationsRead(createClient());
      if (!mountedRef.current) return;
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? now })),
      );
    } catch {
      /* keep unread state */
    }
  }, []);

  const unread = items.filter((n) => !n.read_at).length;

  return { items, loading, unread, refresh, markRead, markAll };
}
