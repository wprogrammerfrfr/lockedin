"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptFollow,
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
}: {
  targetUserId: string;
  initialStatus?: FollowRelationStatus;
  onNeedAuth?: () => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  if (status === "self") return null;

  async function run(fn: () => Promise<void>, next: FollowRelationStatus) {
    setBusy(true);
    try {
      await fn();
      setStatus(next);
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
      <Button variant="outline" className="rounded-xl" disabled>
        Requested
      </Button>
    );
  }

  if (status === "pending_incoming") {
    return (
      <div className="flex gap-2">
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
