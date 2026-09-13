"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RoomPresenceMember } from "@/features/rooms/types";
import {
  memberDisplayClock,
  useNow,
  type SelfLiveClock,
} from "@/features/rooms/live-member-clock";
import { formatMs } from "@/features/session/format";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

export function RoomPresenceStrip({
  members,
  seats = 6,
  compact = false,
  selfLive = null,
}: {
  members: RoomPresenceMember[];
  seats?: number;
  /** Tighter strip while locked in so the hero keeps more vertical space. */
  compact?: boolean;
  /** Local session clock — bypasses presence lag for the current user. */
  selfLive?: SelfLiveClock | null;
}) {
  const { t } = useTranslation();
  const now = useNow(1_000);
  const slots = Array.from(
    { length: Math.min(6, Math.max(2, seats)) },
    (_, i) => members.find((m) => m.seat === i + 1) ?? null,
  );
  const filled = slots.filter(Boolean).length;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border border-border bg-card sm:gap-3",
        compact ? "px-2 py-1.5" : "px-3 py-2.5",
      )}
    >
      <Users
        className={cn(
          "shrink-0 text-muted-foreground",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {slots.map((m, i) => {
          if (!m) {
            return (
              <span
                key={`empty-${i}`}
                className={cn(
                  "shrink-0 rounded-lg border-2 border-dashed border-border bg-background",
                  compact ? "h-6 w-6" : "h-7 w-7",
                )}
              />
            );
          }
          const clock = memberDisplayClock(m, now, selfLive);
          const onBreak = m.status === "BREAK";
          return (
            <div
              key={m.userId}
              className="flex shrink-0 flex-col items-center gap-0.5"
            >
              <Avatar
                className={cn(
                  "rounded-lg border-2 border-white dark:border-zinc-800",
                  compact ? "h-6 w-6" : "h-7 w-7",
                )}
              >
                {m.avatarPath ? <AvatarImage src={m.avatarPath} alt="" /> : null}
                <AvatarFallback className="rounded-lg bg-muted text-[9px] font-semibold text-muted-foreground">
                  {(m.username || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p
                className={cn(
                  "font-mono text-[8px] leading-none tabular-nums sm:text-[9px]",
                  onBreak
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              >
                {formatMs(clock.displayMs)}
              </p>
            </div>
          );
        })}
      </div>
      <p
        className={cn(
          "ml-auto shrink-0 text-[10px] font-medium text-muted-foreground sm:text-xs",
        )}
      >
        {filled}/{slots.length} · {t("room.attendance")}
      </p>
    </div>
  );
}
