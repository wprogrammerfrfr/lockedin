"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RoomPresenceMember } from "@/features/rooms/types";
import { cn } from "@/lib/utils";

export function RoomPresenceStrip({
  members,
  seats = 6,
}: {
  members: RoomPresenceMember[];
  seats?: number;
}) {
  const slots = Array.from(
    { length: Math.min(6, Math.max(2, seats)) },
    (_, i) => members.find((m) => m.seat === i + 1) ?? null,
  );
  const filled = slots.filter(Boolean).length;

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <Users className="h-4 w-4 shrink-0 text-slate-400" />
      <div className="flex -space-x-2">
        {slots.map((m, i) =>
          m ? (
            <Avatar
              key={m.userId}
              className="h-7 w-7 rounded-lg border-2 border-white"
            >
              {m.avatarPath ? <AvatarImage src={m.avatarPath} alt="" /> : null}
              <AvatarFallback className="rounded-lg bg-slate-100 text-[9px] font-semibold text-slate-600">
                {(m.username || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span
              key={`empty-${i}`}
              className="h-7 w-7 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50"
            />
          ),
        )}
      </div>
      <p className={cn("ml-auto text-xs font-medium text-slate-500")}>
        {filled}/{slots.length} · Attendance
      </p>
    </div>
  );
}
