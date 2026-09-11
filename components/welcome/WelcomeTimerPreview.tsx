"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Lock, Play } from "lucide-react";
import { FlipClock } from "@/components/session/FlipClock";
import { springSoft, stateAccent } from "@/components/session/state-accent";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";

type DemoState = "IDLE" | "LOCKED_IN" | "TAPPED_OUT";

export function WelcomeTimerPreview() {
  const [demo, setDemo] = useState<DemoState>("IDLE");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const accumulated = useRef(0);

  useEffect(() => {
    if (demo !== "LOCKED_IN") return;
    startedAt.current = performance.now();
    const id = window.setInterval(() => {
      const start = startedAt.current ?? performance.now();
      setElapsedMs(accumulated.current + (performance.now() - start));
    }, 80);
    return () => {
      window.clearInterval(id);
      if (startedAt.current != null) {
        accumulated.current += performance.now() - startedAt.current;
        startedAt.current = null;
      }
    };
  }, [demo]);

  useEffect(() => {
    if (demo !== "TAPPED_OUT") return;
    const t = window.setTimeout(() => {
      accumulated.current = 0;
      startedAt.current = null;
      setElapsedMs(0);
      setDemo("IDLE");
    }, 1600);
    return () => window.clearTimeout(t);
  }, [demo]);

  const onLockIn = useCallback(() => setDemo("LOCKED_IN"), []);
  const onTapOut = useCallback(() => {
    if (startedAt.current != null) {
      accumulated.current += performance.now() - startedAt.current;
      startedAt.current = null;
    }
    setDemo("TAPPED_OUT");
  }, []);

  const accent = stateAccent(demo === "IDLE" ? "IDLE" : demo);
  const muted = demo === "TAPPED_OUT";

  return (
    <motion.div
      layout
      transition={springSoft}
      className="relative w-full min-w-0 max-w-full"
      animate={
        muted
          ? { filter: "saturate(0.4)", y: 6 }
          : { filter: "saturate(1)", y: 0 }
      }
    >
      <div className="mb-3 flex items-center justify-end">
        <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5">
          <Flame className="h-4 w-4 text-amber-500" />
          <CountUp value={7} className="text-sm font-semibold text-amber-700" />
          <span className="text-xs text-amber-600/80">streak</span>
        </div>
      </div>

      <motion.div
        layout
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4 shadow-soft sm:p-5",
          accent.card,
        )}
        style={{
          boxShadow: demo === "LOCKED_IN" ? accent.glow : undefined,
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Lock className={cn("h-4 w-4", accent.text)} />
          <span className="font-display text-sm font-bold uppercase tracking-[0.14em] text-foreground">
            FOCUS TIMER
          </span>
        </div>

        <div
          className={cn(
            "relative mx-auto mb-4 flex min-h-[108px] w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl border px-2 py-3 sm:min-h-[132px] sm:px-4 sm:py-5",
            muted
              ? "border-border bg-muted/80"
              : "border-border bg-background",
          )}
        >
          {demo === "LOCKED_IN" && (
            <motion.div
              className="pointer-events-none absolute inset-2 rounded-2xl border-2"
              style={{ borderColor: accent.ring }}
              animate={{ scale: [1, 1.015, 1], opacity: [0.45, 0.95, 0.45] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <div className="relative z-10 w-full min-w-0 text-center">
            <FlipClock ms={elapsedMs} size="sm" forceHours={false} />
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {muted
                ? "session stopped"
                : demo === "LOCKED_IN"
                  ? "live elapsed"
                  : "demo · try the button"}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {demo === "LOCKED_IN" ? (
            <motion.div
              key="locked"
              className="flex flex-col gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springSoft}
            >
              <div className="relative p-2">
                <motion.div
                  className="pointer-events-none absolute -inset-2 rounded-2xl border-2 border-lime-400"
                  animate={{ scale: [1, 1.03, 1], opacity: [0.4, 0.95, 0.4] }}
                  transition={{
                    duration: 2.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ boxShadow: "0 0 28px rgba(132,204,22,0.45)" }}
                />
                <Button
                  size="xl"
                  className={cn(
                    "relative z-10 w-full cursor-default py-6 text-xl font-bold tracking-wide sm:text-2xl",
                    accent.button,
                  )}
                  aria-pressed
                >
                  <Lock className="!size-7" />
                  LOCKED IN
                </Button>
              </div>
              <Button
                size="lg"
                variant="outline"
                className="border-border bg-muted text-muted-foreground hover:bg-slate-200"
                onClick={onTapOut}
              >
                TAP OUT
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springSoft}
            >
              <Button
                size="xl"
                className={cn(
                  "w-full py-6 text-xl font-bold tracking-wide shadow-soft sm:text-2xl",
                  accent.button,
                )}
                disabled={muted}
                onClick={onLockIn}
              >
                <Play className="!size-7" />
                LOCK IN
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
