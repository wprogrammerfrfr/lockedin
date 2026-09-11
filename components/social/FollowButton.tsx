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
import { useTranslation } from "@/lib/i18n/LocaleProvider";
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
  const { t } = useTranslation();
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
        {t("social.blocked")}
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
      toast.error(userFacingError(err, t("social.followFailed")));
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
        {t("social.following")}
      </Button>
    );
  }

  if (status === "pending_outgoing") {
    return (
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        className={cn(chipClass, compact && "text-muted-foreground")}
        disabled={busy}
        onClick={() =>
          run(() => unfollow(supabase(), targetUserId), "none")
        }
      >
        {compact ? t("social.requested") : t("social.requestedCancel")}
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
          {t("social.accept")}
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
          {t("social.accept")}
        </Button>
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={busy}
          onClick={() =>
            run(() => rejectFollow(supabase(), targetUserId), "none")
          }
        >
          {t("social.reject")}
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
      {t("social.follow")}
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
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Button variant="outline" className="rounded-xl" disabled>
        {t("social.friends")}
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
            toast.success(t("social.friendsNow"));
          })
          .catch((err) => {
            toast.error(userFacingError(err, t("social.followBackFailed")));
          })
          .finally(() => setBusy(false));
      }}
    >
      {t("social.followBack")}
    </Button>
  );
}
