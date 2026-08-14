"use client";

import { motion } from "framer-motion";
import { springSoft } from "@/components/session/state-accent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatMs } from "@/features/session/format";
import type { RoomPresenceMember } from "@/features/rooms/types";
import { cn } from "@/lib/utils";

function shortBreakLabel(
  breakType?: string | null,
  breakLabel?: string | null,
): string | null {
  const typeMap: Record<string, string> = {
    hydration: "Hydration",
    doomscroll: "Doomscroll",
    touch_grass: "Touch Grass",
    smart_alignment: "Smart alignment",
    dynamic: "Dynamic",
    pomodoro: "Pomodoro",
  };
  if (breakType && typeMap[breakType]) return typeMap[breakType];
  if (breakLabel?.trim()) {
    const raw = breakLabel.trim();
    if (/hydration/i.test(raw)) return "Hydration";
    if (/doomscroll/i.test(raw)) return "Doomscroll";
    if (/touch grass/i.test(raw)) return "Touch Grass";
    if (/smart alignment/i.test(raw)) return "Smart alignment";
    if (/pomodoro/i.test(raw)) return "Pomodoro";
    if (/shared/i.test(raw)) return "Shared";
    return raw.length > 18 ? `${raw.slice(0, 16)}…` : raw;
  }
  return null;
}

function statusBadge(member: RoomPresenceMember) {
  switch (member.status) {
    case "LOCKED_IN":
      return {
        label: "LOCKED IN",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "BREAK": {
      const kind = shortBreakLabel(member.breakType, member.breakLabel);
      return {
        label: kind ? `BREAK · ${kind}` : "BREAK",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }
    case "LACKING":
      return {
        label: "Lacking",
        className: "bg-slate-100 text-slate-500 border-slate-200",
      };
    default:
      return {
        label: member.status,
        className: "bg-slate-50 text-slate-600 border-slate-200",
      };
  }
}

export function RoomPresencePane({
  members,
  seats = 6,
}: {
  members: RoomPresenceMember[];
  seats?: number;
}) {
  const slots = Array.from({ length: Math.min(6, Math.max(2, seats)) }, (_, i) => {
    return members.find((m) => m.seat === i + 1) ?? null;
  });

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div>
        <p className="font-display text-sm font-bold text-slate-900">Presence</p>
        <p className="text-xs text-slate-500">2–6 seats · text only</p>
      </div>
      <div className="flex flex-col gap-2">
        {slots.map((m, i) => {
          const badge = m ? statusBadge(m) : null;
          return (
            <motion.div
              key={m?.userId ?? `empty-${i}`}
              layout
              transition={springSoft}
              className={cn(
                "rounded-xl border border-slate-200 bg-white p-3",
                !m && "border-dashed bg-slate-50",
              )}
            >
              {m ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 rounded-xl">
                    {m.avatarPath ? (
                      <AvatarImage src={m.avatarPath} alt="" />
                    ) : null}
                    <AvatarFallback className="rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
                      {(m.username || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-slate-800">
                      {m.username}
                    </p>
                    <p className="font-mono text-[11px] tabular-nums text-slate-400">
                      {formatMs(m.elapsedMs)}
                    </p>
                  </div>
                  {badge && (
                    <Badge
                      variant="outline"
                      className={cn("max-w-[9.5rem] truncate rounded-lg text-[10px]", badge.className)}
                      title={badge.label}
                    >
                      {badge.label}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Open seat</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
