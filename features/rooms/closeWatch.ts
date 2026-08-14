"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** When `closesAt` is reached, toast and navigate back to the rooms lobby. */
export function useRoomCloseWatch(closesAt: string | null | undefined) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!closesAt) {
      setSecondsLeft(null);
      return;
    }

    const target = new Date(closesAt).getTime();
    let closed = false;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const left = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !closed) {
        closed = true;
        toast.message("Room closed — not enough members.");
        router.push("/rooms");
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [closesAt, router]);

  return { secondsLeft };
}
