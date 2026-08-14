"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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

export function FollowButton({
  targetUserId,
  initialStatus = "none",
  onNeedAuth,
  onStatusChange,
}: {
  targetUserId: string;
  initialStatus?: FollowRelationStatus;
  onNeedAuth?: () => void;
  onStatusChange?: (status: FollowRelationStatus) => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus, targetUserId]);

  if (status === "self") return null;

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

  if (status === "accepted") {
    return (
      <Button
        variant="outline"
        className="rounded-xl"
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
        className="rounded-xl"
        disabled={busy}
        onClick={() =>
          run(() => unfollow(supabase(), targetUserId), "none")
        }
      >
        Requested · Cancel
      </Button>
    );
  }

  if (status === "pending_incoming") {
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

  // They already follow you (accepted inbound, none outbound) — offer follow back
  // Handled when parent passes a dedicated prop; also support followBack when
  // status is none but parent wants follow-back CTA via initialStatus rejected flow.

  return (
    <Button
      className="rounded-xl"
      disabled={busy}
      onClick={() => {
        if (onNeedAuth) {
          onNeedAuth();
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
