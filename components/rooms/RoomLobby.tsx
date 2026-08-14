"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Rooms aren't listed publicly — join with a 6-digit code from a host. */
export function RoomLobby() {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-base">The Trenches</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500">
          Rooms stay private. Join with a 6-digit code, or create one and share
          it. Empty rooms are deleted.
        </p>
      </CardContent>
    </Card>
  );
}
