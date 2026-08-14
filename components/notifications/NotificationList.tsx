"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptFollow,
  followBack,
  listIncomingFollowRequests,
  rejectFollow,
} from "@/features/social/api";
import type { FollowRequest } from "@/features/social/types";
import type { NotificationRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

type FollowBackEntry = {
  userId: string;
  username: string | null;
  status: "offer" | "friends";
};

function labelFor(n: NotificationRow) {
  switch (n.type) {
    case "follow_request":
      return "New follow request";
    case "follow_accept":
      return "Follow request accepted";
    case "like":
      return "Liked your session";
    case "comment":
      return "Commented on your session";
    case "streak_7":
      return "7-day streak unlocked";
    case "session_4h":
      return "4h+ session milestone";
    case "lines_1000":
      return "1000+ lines milestone";
    default:
      return String(n.type);
  }
}

function followerIdFromPayload(payload: Record<string, unknown>): string | null {
  const id = payload.follower_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function hrefForNotification(n: NotificationRow): string | null {
  const p = (n.payload ?? {}) as Record<string, unknown>;
  switch (n.type) {
    case "like":
    case "comment":
      return "/explore";
    case "follow_accept": {
      const username = p.username;
      if (typeof username === "string" && username.length > 0) {
        return `/u/${username}`;
      }
      return "/explore";
    }
    case "follow_request": {
      const username = p.username;
      if (typeof username === "string" && username.length > 0) {
        return `/u/${username}`;
      }
      return null;
    }
    case "streak_7":
    case "session_4h":
    case "lines_1000":
      return "/dashboard";
    default:
      return null;
  }
}

export function NotificationList({
  items,
  pendingRequests,
  onMarkRead,
  onMarkAll,
  onRequestsChange,
}: {
  items: NotificationRow[];
  pendingRequests: FollowRequest[];
  onMarkRead: (id: string) => void;
  onMarkAll: () => void;
  onRequestsChange?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [followBackQueue, setFollowBackQueue] = useState<FollowBackEntry[]>([]);

  const requestByFollower = new Map(
    pendingRequests.map((r) => [r.follower_id, r]),
  );

  async function handleAccept(
    followerId: string,
    username: string | null,
    notificationId?: string,
  ) {
    setBusyId(followerId);
    try {
      await acceptFollow(createClient(), followerId);
      if (notificationId) onMarkRead(notificationId);
      onRequestsChange?.();
      setFollowBackQueue((prev) => {
        if (prev.some((e) => e.userId === followerId)) return prev;
        return [
          ...prev,
          { userId: followerId, username, status: "offer" },
        ];
      });
      toast.success("Follow accepted");
    } catch (err) {
      toast.error(userFacingError(err, "Accept failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(followerId: string, notificationId?: string) {
    setBusyId(followerId);
    try {
      await rejectFollow(createClient(), followerId);
      if (notificationId) onMarkRead(notificationId);
      onRequestsChange?.();
      toast.message("Request rejected");
    } catch (err) {
      toast.error(userFacingError(err, "Reject failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleFollowBack(entry: FollowBackEntry) {
    setBusyId(entry.userId);
    try {
      await followBack(createClient(), entry.userId);
      setFollowBackQueue((prev) =>
        prev.map((e) =>
          e.userId === entry.userId ? { ...e, status: "friends" } : e,
        ),
      );
      toast.success("You're friends now");
    } catch (err) {
      toast.error(userFacingError(err, "Follow back failed"));
      setFollowBackQueue((prev) =>
        prev.filter((e) => e.userId !== entry.userId),
      );
    } finally {
      setBusyId(null);
    }
  }

  const handledFollowers = new Set<string>();

  return (
    <div className="max-h-[inherit] overflow-y-auto">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="font-display text-xs font-semibold text-slate-700">
          Notifications
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px]"
          onClick={onMarkAll}
        >
          Mark all read
        </Button>
      </div>

      {pendingRequests.length > 0 || followBackQueue.length > 0 ? (
        <div className="mb-3 space-y-1 border-b border-slate-100 pb-3">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Follow requests
          </p>
          <ul className="space-y-1">
            {pendingRequests.map((req) => (
              <li
                key={req.follower_id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <Link
                  href={
                    req.profile?.username
                      ? `/u/${req.profile.username}`
                      : "#"
                  }
                  className="min-w-0 truncate text-xs font-medium text-slate-800"
                >
                  {req.profile?.username
                    ? `@${req.profile.username}`
                    : "New request"}
                </Link>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    className="h-7 rounded-lg px-2 text-[11px]"
                    disabled={busyId === req.follower_id}
                    onClick={() =>
                      void handleAccept(
                        req.follower_id,
                        req.profile?.username ?? null,
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg px-2 text-[11px]"
                    disabled={busyId === req.follower_id}
                    onClick={() => void handleReject(req.follower_id)}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
            {followBackQueue.map((entry) => (
              <li
                key={`fb-${entry.userId}`}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <Link
                    href={entry.username ? `/u/${entry.username}` : "#"}
                    className="block truncate text-xs font-medium text-slate-800"
                  >
                    {entry.username ? `@${entry.username}` : "Accepted"}
                  </Link>
                  <p className="text-[10px] text-slate-400">Just accepted</p>
                </div>
                {entry.status === "friends" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg px-2 text-[11px]"
                    disabled
                  >
                    Friends
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 rounded-lg px-2 text-[11px]"
                    disabled={busyId === entry.userId}
                    onClick={() => void handleFollowBack(entry)}
                  >
                    Follow back
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {items.length === 0 &&
        pendingRequests.length === 0 &&
        followBackQueue.length === 0 && (
          <p className="px-2 py-4 text-xs text-slate-400">
            You&apos;re caught up.
          </p>
        )}
      <ul className="space-y-1">
        {items.map((n) => {
          const followerId =
            n.type === "follow_request"
              ? followerIdFromPayload(n.payload ?? {})
              : null;
          const req = followerId ? requestByFollower.get(followerId) : null;
          const showActions =
            n.type === "follow_request" &&
            followerId &&
            req &&
            !handledFollowers.has(followerId);

          if (followerId && showActions) {
            handledFollowers.add(followerId);
          }

          if (
            n.type === "follow_request" &&
            followerId &&
            requestByFollower.has(followerId)
          ) {
            return null;
          }

          return (
            <li key={n.id}>
              <div className="rounded-lg px-2 py-2 hover:bg-slate-50">
                {(() => {
                  const href = hrefForNotification(n);
                  const body = (
                    <>
                      <p className="text-xs font-medium text-slate-800">
                        {labelFor(n)}
                        {!n.read_at && (
                          <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-lime-500 align-middle" />
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </>
                  );
                  if (href) {
                    return (
                      <Link
                        href={href}
                        onClick={() => onMarkRead(n.id)}
                        className="block w-full text-left"
                      >
                        {body}
                      </Link>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      className="w-full text-left"
                    >
                      {body}
                    </button>
                  );
                })()}
                {showActions && followerId ? (
                  <div className="mt-2 flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 rounded-lg px-2 text-[11px]"
                      disabled={busyId === followerId}
                      onClick={() =>
                        void handleAccept(
                          followerId,
                          req?.profile?.username ?? null,
                          n.id,
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg px-2 text-[11px]"
                      disabled={busyId === followerId}
                      onClick={() => void handleReject(followerId, n.id)}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Lightweight pending follow-request list for the notification panel. */
export function usePendingFollowRequests(enabled: boolean) {
  const [requests, setRequests] = useState<FollowRequest[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRequests([]);
      return;
    }
    try {
      setRequests(await listIncomingFollowRequests(createClient()));
    } catch {
      setRequests([]);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return { requests, refresh, pendingCount: requests.length };
}
