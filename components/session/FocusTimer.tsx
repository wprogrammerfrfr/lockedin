"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Pause, Play, Share2, Trophy } from "lucide-react";

import { FlipClock } from "@/components/session/FlipClock";
import { ParticleBurst } from "@/components/session/ParticleBurst";
import {
  springSoft,
  stateAccent,
} from "@/components/session/state-accent";
import { Button } from "@/components/ui/button";
import { formatMs } from "@/features/session/format";
import type { SessionState } from "@/features/session/types";
import { cn } from "@/lib/utils";

export function FocusTimer({
  state,
  elapsedMs,
  todayTotalMs,
  personalRecordMs,
  didBreakPR,
  breakRemainingMs,
  breakLabel,
  breakEmoji,
  sessionName,
  onSessionNameChange,
  onLockIn,
  onPitStop,
  onLockBackIn,
  onEndSession,
  onTapOut,
  onShare,
  onClearPrBurst,
  lockInDisabled = false,
}: {
  state: SessionState;
  elapsedMs: number;
  todayTotalMs: number;
  personalRecordMs: number;
  didBreakPR: boolean;
  breakRemainingMs: number;
  breakLabel: string;
  breakEmoji: string;
  sessionName: string;
  onSessionNameChange: (value: string) => void;
  onLockIn: () => void;
  onPitStop: () => void;
  onLockBackIn: () => void;
  onEndSession: () => void;
  onTapOut: () => void;
  onShare: () => void;
  onClearPrBurst: () => void;
  lockInDisabled?: boolean;
}) {
  const accent = stateAccent(state);
  const muted = state === "TAPPED_OUT";
  const showSecondary =
    state === "LOCKED_IN" ||
    state === "ON_BREAK" ||
    state === "CHOOSING_BREAK";
  const isActiveFocus =
    state === "LOCKED_IN" ||
    state === "ON_BREAK" ||
    state === "CHOOSING_BREAK" ||
    state === "BREAK_DONE";

  useEffect(() => {
    if (!didBreakPR) return;
    const t = setTimeout(onClearPrBurst, 1400);
    return () => clearTimeout(t);
  }, [didBreakPR, onClearPrBurst]);

  return (
    <motion.div
      layout
      transition={springSoft}
      className="relative"
      animate={
        muted
          ? { filter: "saturate(0.35)", y: 6 }
          : { filter: "saturate(1)", y: 0 }
      }
    >
      <motion.div
        layout
        className={cn(
          "relative overflow-visible rounded-2xl border shadow-soft",
          isActiveFocus ? "p-3 sm:p-5" : "p-4 sm:p-8",
          accent.card,
          muted && "grayscale-[0.35]"
        )}
        style={{
          boxShadow:
            state === "LOCKED_IN" || state === "ON_BREAK"
              ? accent.glow
              : undefined,
        }}
      >
        <div className={cn("flex items-center gap-2", isActiveFocus ? "mb-3" : "mb-5")}>
          <Lock className={cn("h-4 w-4", accent.text)} />
          <span
            className={cn(
              "font-display text-sm font-bold uppercase tracking-[0.14em]",
              muted ? "text-red-700" : "text-slate-800"
            )}
          >
            {(sessionName ?? "").trim() || "FOCUS TIMER"}
          </span>
        </div>

        <div
          className={cn(
            "relative mx-auto flex w-full items-center justify-center overflow-visible rounded-2xl border px-2 sm:px-8 md:px-10",
            isActiveFocus
              ? "mb-3 min-h-[120px] py-3 sm:mb-4 sm:min-h-[200px] sm:py-6 md:min-h-[220px] lg:min-h-[240px]"
              : "mb-4 min-h-[140px] py-4 sm:mb-6 sm:min-h-[280px] sm:py-10 md:min-h-[320px] lg:min-h-[360px]",
            muted
              ? "border-red-200/60 bg-red-50/50"
              : "border-slate-100 bg-slate-50"
          )}
        >
          <ParticleBurst active={didBreakPR && state === "LOCKED_IN"} />

          {state === "LOCKED_IN" && (
            <motion.div
              className="pointer-events-none absolute inset-2 rounded-2xl border-2"
              style={{ borderColor: accent.ring }}
              animate={{ scale: [1, 1.015, 1], opacity: [0.45, 0.95, 0.45] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <div className="relative z-10 w-full text-center">
            <AnimatePresence mode="wait">
              {state === "BREAK_DONE" ? (
                <motion.div
                  key="lock-back"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={springSoft}
                  className="px-2"
                >
                  <p className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
                    LOCK BACK IN
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                    Break complete
                  </p>
                </motion.div>
              ) : state === "ON_BREAK" ? (
                <motion.div
                  key="break-count"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={springSoft}
                >
                  <p className="mb-3 text-sm font-medium text-amber-700">
                    <span className="mr-1.5" aria-hidden>
                      {breakEmoji}
                    </span>
                    {breakLabel}
                  </p>
                  <FlipClock ms={breakRemainingMs} />
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                    break countdown
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="focus-clock"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={springSoft}
                >
                  <FlipClock ms={elapsedMs} muted={muted} />
                  <p
                    className={cn(
                      "mt-3 text-xs uppercase tracking-[0.16em]",
                      muted ? "text-red-400/70" : "text-slate-400"
                    )}
                  >
                    {muted
                      ? "session stopped"
                      : state === "LOCKED_IN"
                        ? "live elapsed"
                        : state === "CHOOSING_BREAK"
                          ? "paused · break"
                          : state === "ENDED"
                            ? "session logged"
                            : "ready when you are"}
                  </p>
                  <AnimatePresence>
                    {didBreakPR && state === "LOCKED_IN" && (
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={springSoft}
                        className="mt-3 font-display text-lg font-semibold text-amber-600"
                      >
                        New PR
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className={cn("grid grid-cols-2 gap-3", isActiveFocus ? "mb-3 sm:mb-4" : "mb-5 sm:mb-8")}>
          <div
            className={cn(
              "rounded-xl border px-4 py-3",
              muted
                ? "border-red-200/60 bg-red-50/40"
                : "border-slate-200 bg-white"
            )}
          >
            <p
              className={cn(
                "text-[10px] uppercase tracking-[0.14em]",
                muted ? "text-red-400/70" : "text-slate-400"
              )}
            >
              Today
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-lg tabular-nums",
                muted ? "text-red-700/70" : "text-slate-800"
              )}
            >
              {formatMs(todayTotalMs)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl border px-4 py-3",
              muted
                ? "border-red-200/60 bg-red-50/40"
                : "border-amber-200 bg-amber-50/60"
            )}
          >
            <p
              className={cn(
                "flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]",
                muted ? "text-red-400/70" : "text-amber-600"
              )}
            >
              <Trophy className="h-3 w-3" /> PR
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-lg tabular-nums",
                muted ? "text-red-700/70" : "text-amber-700"
              )}
            >
              {formatMs(personalRecordMs)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3">
          <AnimatePresence mode="wait">
            {state === "BREAK_DONE" ? (
              <motion.div
                key="post-break"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={springSoft}
                className="grid gap-3 sm:grid-cols-2"
              >
                <Button
                  size="xl"
                  className="w-full py-6 text-xl font-bold tracking-wide sm:py-8 sm:text-2xl bg-lime-400 text-slate-950 hover:bg-lime-300 border border-lime-500/40"
                  onClick={onLockBackIn}
                >
                  <Play className="!size-6" />
                  LOCK BACK IN
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  className="w-full border-slate-300 py-6 text-xl font-bold tracking-wide text-slate-700 sm:py-8 sm:text-2xl"
                  onClick={onEndSession}
                >
                  END SESSION
                </Button>
              </motion.div>
            ) : state === "IDLE" ||
              state === "TAPPED_OUT" ||
              state === "ENDED" ? (
              <motion.div
                key="lock-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={springSoft}
                className="flex flex-col gap-3"
              >
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    Session Name{" "}
                    <span className="normal-case tracking-normal text-slate-400">
                      (optional)
                    </span>
                  </span>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => onSessionNameChange(e.target.value)}
                    placeholder="e.g. CS midterm grind"
                    maxLength={80}
                    className="w-full cursor-text rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
                <Button
                  size="xl"
                  className={cn(
                    "relative z-10 w-full py-6 text-xl font-bold tracking-wide shadow-soft sm:py-8 sm:text-2xl md:text-3xl",
                    muted ? accent.button : accent.button
                  )}
                  disabled={lockInDisabled}
                  onClick={onLockIn}
                >
                  <Play className="!size-7" />
                  LOCK IN
                </Button>
              </motion.div>
            ) : state === "ON_BREAK" || state === "CHOOSING_BREAK" ? (
              <motion.div
                key="on-break-status"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={springSoft}
              >
                <div
                  className={cn(
                    "flex w-full items-center justify-center rounded-2xl border py-5 font-display text-lg font-bold tracking-wide sm:py-6 sm:text-xl",
                    accent.button
                  )}
                >
                  <Pause className="mr-2 h-5 w-5" />
                  {state === "CHOOSING_BREAK" ? "BREAK" : "ON BREAK"}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="locked-in"
                className="relative"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={springSoft}
              >
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
                    "relative z-10 w-full cursor-default py-6 text-xl font-bold tracking-wide sm:py-8 sm:text-2xl md:text-3xl",
                    accent.button
                  )}
                  aria-pressed
                >
                  <Lock className="!size-7" />
                  LOCKED IN
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSecondary && (
              <motion.div
                key="secondary"
                className="grid grid-cols-2 gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={springSoft}
              >
                {state === "LOCKED_IN" ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={onPitStop}
                  >
                    <Pause className="h-4 w-4" />
                    BREAK
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  size="lg"
                  className={cn(
                    "border border-red-600 bg-red-500 text-white hover:bg-red-600",
                    (state === "ON_BREAK" || state === "CHOOSING_BREAK") &&
                      "col-span-2"
                  )}
                  onClick={onTapOut}
                >
                  TAP OUT
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {(state === "ENDED" || state === "TAPPED_OUT") && (
          <div className="mt-5 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                muted
                  ? "text-red-400/80 hover:text-red-600"
                  : "text-slate-500 hover:text-slate-800"
              )}
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
              Share Session
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
