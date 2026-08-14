"use client";

import { Button } from "@/components/ui/button";
import type { NotificationRow } from "@/types/database";

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

export function NotificationList({
  items,
  onMarkRead,
  onMarkAll,
}: {
  items: NotificationRow[];
  onMarkRead: (id: string) => void;
  onMarkAll: () => void;
}) {
  return (
    <div className="max-h-80 overflow-y-auto">
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
      {items.length === 0 && (
        <p className="px-2 py-4 text-xs text-slate-400">You&apos;re caught up.</p>
      )}
      <ul className="space-y-1">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onMarkRead(n.id)}
              className="w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50"
            >
              <p className="text-xs font-medium text-slate-800">
                {labelFor(n)}
                {!n.read_at && (
                  <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-lime-500 align-middle" />
                )}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
