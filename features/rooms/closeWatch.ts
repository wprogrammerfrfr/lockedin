"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** When `closesAt` is set, warn once; when reached, toast and navigate to lobby. */
export function useRoomCloseWatch(closesAt: string | null | undefined) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const warnedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!closesAt) {
      setSecondsLeft(null);
      warnedForRef.current = null;
      return;
    }

    if (warnedForRef.current !== closesAt) {
      warnedForRef.current = closesAt;
      const secs = Math.max(
        0,
        Math.ceil((new Date(closesAt).getTime() - Date.now()) / 1000),
      );
      toast.warning(
        secs > 0
          ? `Not enough members — room closing in ${secs}s.`
          : "Not enough members — room closing.",
      );
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
        toast.warning("Room closed — not enough members.");
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
