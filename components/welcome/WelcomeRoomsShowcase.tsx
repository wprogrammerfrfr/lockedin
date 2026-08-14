"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { springSoft } from "@/components/session/state-accent";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMs } from "@/features/session/format";
import type { BreakVoteChoice, RoomPresenceMember } from "@/features/rooms/types";
import { cn } from "@/lib/utils";

const DEMO_MEMBERS: RoomPresenceMember[] = [
  {
    userId: "1",
    username: "maya",
    displayName: "Maya",
    avatarPath: null,
    status: "LOCKED_IN",
    elapsedMs: 48 * 60 * 1000 + 12 * 1000,
  },
  {
    userId: "2",
    username: "alex",
    displayName: "Alex",
    avatarPath: null,
    status: "LOCKED_IN",
    elapsedMs: 51 * 60 * 1000 + 4 * 1000,
  },
  {
    userId: "3",
    username: "sam",
    displayName: "Sam",
    avatarPath: null,
    status: "BREAK",
    elapsedMs: 22 * 60 * 1000,
  },
  {
    userId: "4",
    username: "rio",
    displayName: "Rio",
    avatarPath: null,
    status: "WAITING",
    elapsedMs: 0,
  },
];

const ROOM_SEATS = [
  { initials: "MJ", tone: "bg-emerald-100 text-emerald-800" },
  { initials: "AK", tone: "bg-lime-100 text-lime-800" },
  { initials: "SR", tone: "bg-amber-100 text-amber-800" },
  { initials: "RI", tone: "bg-slate-100 text-slate-700" },
  null,
  null,
] as const;

function statusBadge(status: RoomPresenceMember["status"]) {
  switch (status) {
    case "LOCKED_IN":
      return {
        label: "LOCKED IN",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "BREAK":
      return {
        label: "BREAK",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    default:
      return {
        label: status,
        className: "bg-slate-50 text-slate-600 border-slate-200",
      };
  }
}

const SEATS = 6;

export function WelcomeRoomsShowcase() {
  const [kind, setKind] = useState<"vote" | "pomodoro">("vote");
  const [left, setLeft] = useState(30);
  const [tallies, setTallies] = useState({ break: 1, stay: 2 });
  const [myVote, setMyVote] = useState<BreakVoteChoice | null>(null);

  useEffect(() => {
    if (kind !== "vote") return;
    const id = window.setInterval(() => {
      setLeft((n) => (n <= 1 ? 30 : n - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [kind]);

  function vote(choice: BreakVoteChoice) {
    if (myVote) return;
    setMyVote(choice);
    setTallies((t) =>
      choice === "break"
        ? { ...t, break: t.break + 1 }
        : { ...t, stay: t.stay + 1 },
    );
  }

  const slots = Array.from({ length: SEATS }, (_, i) => DEMO_MEMBERS[i] ?? null);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Users className="h-5 w-5 text-emerald-600" />
          Rooms
        </CardTitle>
        <div>
          <p className="font-display text-lg font-bold tracking-tight text-slate-900">
            Lock in with friends. 2–6 people, one room, a code to join.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Everyone runs their own timer. When someone needs a break, the room
            votes — Break vs Stay Locked In. Majority wins; a tie keeps you
            locked in.
          </p>
        </div>
        <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <Users className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="flex -space-x-2">
            {ROOM_SEATS.map((seat, i) =>
              seat ? (
                <Avatar
                  key={seat.initials}
                  className="h-8 w-8 rounded-lg border-2 border-white"
                >
                  <AvatarFallback
                    className={cn(
                      "rounded-lg text-[10px] font-semibold",
                      seat.tone,
                    )}
                  >
                    {seat.initials}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span
                  key={`empty-${i}`}
                  className="h-8 w-8 rounded-lg border-2 border-dashed border-slate-200 bg-white"
                />
              ),
            )}
          </div>
          <p className="ml-auto text-xs font-medium text-slate-500">
            4/6 · Presence
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["vote", "Vote room"],
              ["pomodoro", "Pomodoro"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                kind === id
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <p className="font-display text-sm font-bold text-slate-900">
              Presence
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Room A7KX2M · 4 friends locked in with you
            </p>
            <div className="flex flex-col gap-2">
              {slots.map((m, i) => {
                const badge = m ? statusBadge(m.status) : null;
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
                          <AvatarFallback className="rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
                            {m.username.slice(0, 2).toUpperCase()}
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
                            className={cn(
                              "rounded-lg text-[10px]",
                              badge.className,
                            )}
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

          {kind === "vote" ? (
            <div className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
              <p className="font-display text-lg font-semibold text-slate-900">
                Shared break vote
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Majority of eligible voters wins. Tie or timeout → stay locked
                in.
              </p>
              <p className="mt-6 text-center font-mono text-3xl tabular-nums text-slate-800">
                {left}s
              </p>
              <p className="mt-2 text-center text-xs text-slate-500">
                Break {tallies.break} · Stay {tallies.stay}
                {myVote ? ` · You: ${myVote}` : ""}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  className="rounded-xl bg-amber-100 text-amber-900 hover:bg-amber-200"
                  disabled={Boolean(myVote)}
                  onClick={() => vote("break")}
                >
                  Break
                </Button>
                <Button
                  className="rounded-xl"
                  variant="outline"
                  disabled={Boolean(myVote)}
                  onClick={() => vote("stay")}
                >
                  Stay Locked In
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center rounded-2xl border border-lime-300 bg-lime-50/60 p-5 sm:p-6">
              <p className="font-display text-lg font-semibold text-slate-900">
                Pomodoro cadence
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Host sets work / break. The room auto-flips LOCKED IN ↔ BREAK
                together — no voting.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["50 / 10", "25 / 5", "45 / 15"].map((label, i) => (
                  <span
                    key={label}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-medium",
                      i === 0
                        ? "border-lime-400 bg-lime-50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-600",
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
