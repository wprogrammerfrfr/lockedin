"use client";

import { useEffect, useState } from "react";
import { FlipClock } from "@/components/session/FlipClock";
import { cn } from "@/lib/utils";

function formatLocalHm(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function RoomWallClock({ className }: { className?: string }) {
  const [value, setValue] = useState(() => formatLocalHm(new Date()));

  useEffect(() => {
    const tick = () => setValue(formatLocalHm(new Date()));
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <FlipClock
      value={value}
      size="xs"
      className={cn("w-auto justify-end gap-0.5", className)}
    />
  );
}
