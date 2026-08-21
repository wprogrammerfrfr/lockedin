"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  acceptFollow,
  followBack,
  rejectFollow,
  requestFollow,
  unfollow,
} from "@/features/social/api";
import type { FollowRelationStatus } from "@/features/social/types";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import { cn } from "@/lib/utils";

export function FollowButton({
  targetUserId,
  initialStatus = "none",
  onNeedAuth,
  onStatusChange,
  compact = false,
}: {
  targetUserId: string;
  initialStatus?: FollowRelationStatus;
  onNeedAuth?: () => void;
  onStatusChange?: (status: FollowRelationStatus) => void;
  /** Room presence chip: hide when already following; smaller controls. */
  compact?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus, targetUserId]);

  if (status === "self") return null;

  if (compact && (status === "accepted" || status === "blocked")) {
    return null;
  }

  if (status === "blocked") {
    return (
      <Button variant="outline" className="rounded-xl" disabled>
        Blocked
      </Button>
    );
  }

  async function run(fn: () => Promise<void>, next: FollowRelationStatus) {
    setBusy(true);
    try {
      await fn();
      setStatus(next);
      onStatusChange?.(next);
    } catch (err) {
      toast.error(userFacingError(err, "Follow action failed"));
    } finally {
      setBusy(false);
    }
  }

  const supabase = () => createClient();
  const chipClass = compact
    ? "h-7 shrink-0 rounded-lg px-2 text-[11px] font-semibold"
    : "rounded-xl";

  if (status === "accepted") {
    return (
      <Button
        variant="outline"
        className={cn(chipClass)}
        disabled={busy}
        onClick={() =>
          run(() => unfollow(supabase(), targetUserId), "none")
        }
      >
        Following
      </Button>
    );
  }

  if (status === "pending_outgoing") {
    return (
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        className={cn(chipClass, compact && "text-slate-500")}
        disabled={busy}
        onClick={() =>
          run(() => unfollow(supabase(), targetUserId), "none")
        }
      >
        {compact ? "Requested" : "Requested · Cancel"}
      </Button>
    );
  }

  if (status === "pending_incoming") {
    if (compact) {
      return (
        <Button
          size="sm"
          className={cn(chipClass)}
          disabled={busy}
          onClick={() =>
            run(() => acceptFollow(supabase(), targetUserId), "accepted")
          }
        >
          Accept
        </Button>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          className="rounded-xl"
          disabled={busy}
          onClick={() =>
            run(() => acceptFollow(supabase(), targetUserId), "accepted")
          }
        >
          Accept
        </Button>
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={busy}
          onClick={() =>
            run(() => rejectFollow(supabase(), targetUserId), "none")
          }
        >
          Reject
        </Button>
      </div>
    );
  }

  return (
    <Button
      size={compact ? "sm" : "default"}
      className={cn(chipClass)}
      disabled={busy}
      onClick={() => {
        if (!isAuthenticated) {
          onNeedAuth?.();
          return;
        }
        void run(
          () => requestFollow(supabase(), targetUserId),
          "pending_outgoing",
        );
      }}
    >
      Follow
    </Button>
  );
}

export function FollowBackButton({
  targetUserId,
  onDone,
}: {
  targetUserId: string;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Button variant="outline" className="rounded-xl" disabled>
        Friends
      </Button>
    );
  }

  return (
    <Button
      className="rounded-xl"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void followBack(createClient(), targetUserId)
          .then(() => {
            setDone(true);
            onDone?.();
            toast.success("You're friends now");
          })
          .catch((err) => {
            toast.error(userFacingError(err, "Follow back failed"));
          })
          .finally(() => setBusy(false));
      }}
    >
      Follow back
    </Button>
  );
}
