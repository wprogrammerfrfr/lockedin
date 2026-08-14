"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptFollow,
  listIncomingFollowRequests,
  rejectFollow,
} from "@/features/social/api";
import type { FollowRequest } from "@/features/social/types";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

export function FollowRequests() {
  const [items, setItems] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (cancelled?: { current: boolean }) => {
    if (!cancelled?.current) setLoading(true);
    try {
      const supabase = createClient();
      const next = await listIncomingFollowRequests(supabase);
      if (!cancelled?.current) setItems(next);
    } catch {
      if (!cancelled?.current) setItems([]);
    } finally {
      if (!cancelled?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelled = { current: false };
    void refresh(cancelled);
    return () => {
      cancelled.current = true;
    };
  }, [refresh]);

  if (loading) {
    return <p className="text-xs text-slate-400">Loading requests…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        Follow requests will show up here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((req) => (
        <li
          key={req.follower_id}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
        >
          <span className="text-sm text-slate-800">
            {req.profile?.username
              ? `@${req.profile.username}`
              : req.follower_id.slice(0, 8)}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="rounded-xl"
              onClick={async () => {
                try {
                  await acceptFollow(createClient(), req.follower_id);
                  await refresh();
                } catch (e) {
                  toast.error(userFacingError(e, "Accept failed"));
                }
              }}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                try {
                  await rejectFollow(createClient(), req.follower_id);
                  await refresh();
                } catch (e) {
                  toast.error(userFacingError(e, "Reject failed"));
                }
              }}
            >
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
