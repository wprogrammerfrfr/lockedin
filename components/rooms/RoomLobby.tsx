"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MOCK_ROOMS = [
  { code: "A7KX2M", seats: "3 / 6", kind: "Vote" },
  { code: "Q9PL4R", seats: "2 / 6", kind: "Pomodoro 50/10" },
];

/** Lightweight lobby preview — live list can replace mocks when RPC ready. */
export function RoomLobby() {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-base">Open rooms</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {MOCK_ROOMS.map((r) => (
          <div
            key={r.code}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <span className="font-mono text-sm font-semibold tracking-wider text-slate-800">
              {r.code}
            </span>
            <span className="text-xs text-slate-500">
              {r.kind} · {r.seats}
            </span>
          </div>
        ))}
        <p className="pt-1 text-xs text-slate-400">
          Create or join with a code above. Rooms are ephemeral (2–6).
        </p>
      </CardContent>
    </Card>
  );
}
