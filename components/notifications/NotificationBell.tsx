"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useNotifications } from "@/features/notifications/useNotifications";
import { cn } from "@/lib/utils";

export function NotificationBell({
  enabled = true,
  menuAlign = "sidebar",
}: {
  enabled?: boolean;
  menuAlign?: "sidebar" | "header";
}) {
  const { items, unread, markRead, markAll } = useNotifications(enabled);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative rounded-xl"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-500" />
        {unread > 0 && (
          <span
            className={cn(
              "absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-lime-500",
            )}
          />
        )}
      </Button>
      {open && (
        <div
          className={cn(
            "absolute z-50 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-soft",
            menuAlign === "header"
              ? "right-0 top-full mt-2"
              : "bottom-12 left-0 lg:bottom-auto lg:left-full lg:top-0 lg:ml-2",
          )}
        >
          <NotificationList
            items={items}
            onMarkRead={markRead}
            onMarkAll={markAll}
          />
        </div>
      )}
    </div>
  );
}
