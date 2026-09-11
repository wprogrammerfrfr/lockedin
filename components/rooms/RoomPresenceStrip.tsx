"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RoomPresenceMember } from "@/features/rooms/types";
import { cn } from "@/lib/utils";

export function RoomPresenceStrip({
  members,
  seats = 6,
  compact = false,
}: {
  members: RoomPresenceMember[];
  seats?: number;
  /** Tighter strip while locked in so the hero keeps more vertical space. */
  compact?: boolean;
}) {
  const slots = Array.from(
    { length: Math.min(6, Math.max(2, seats)) },
    (_, i) => members.find((m) => m.seat === i + 1) ?? null,
  );
  const filled = slots.filter(Boolean).length;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-border bg-card",
        compact ? "px-2.5 py-1.5" : "px-3 py-2.5",
      )}
    >
      <Users
        className={cn(
          "shrink-0 text-muted-foreground",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
      <div className="flex -space-x-2">
        {slots.map((m, i) =>
          m ? (
            <Avatar
              key={m.userId}
              className={cn(
                "rounded-lg border-2 border-white",
                compact ? "h-6 w-6" : "h-7 w-7",
              )}
            >
              {m.avatarPath ? <AvatarImage src={m.avatarPath} alt="" /> : null}
              <AvatarFallback className="rounded-lg bg-muted text-[9px] font-semibold text-muted-foreground">
                {(m.username || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span
              key={`empty-${i}`}
              className={cn(
                "rounded-lg border-2 border-dashed border-border bg-background",
                compact ? "h-6 w-6" : "h-7 w-7",
              )}
            />
          ),
        )}
      </div>
      <p className={cn("ml-auto text-xs font-medium text-muted-foreground")}>
        {filled}/{slots.length} · Attendance
      </p>
    </div>
  );
}
