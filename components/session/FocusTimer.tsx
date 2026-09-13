"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IceCreamCone, Lock, Pause, Play, Share2, Trophy } from "lucide-react";

import { FlipClock, type FlipClockTone } from "@/components/session/FlipClock";
import { MeltScene, PROGRESS_RING_CIRC } from "@/components/session/MeltScene";
import { MeltTimerChip } from "@/components/session/MeltTimerChip";
import { ParticleBurst } from "@/components/session/ParticleBurst";
import {
  breakTypeAccent,
  springSoft,
  stateAccent,
} from "@/components/session/state-accent";
import { Button } from "@/components/ui/button";
import { getBreakType, type BreakTypeId } from "@/features/session/break-types";
import { buildBreakLiveLabel, formatMs } from "@/features/session/format";
import type { SessionState } from "@/features/session/types";
import type { MeltConfig } from "@/features/session/melt-catalog";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

function upperLocaleFor(locale: Locale): string {
  if (locale === "tr") return "tr-TR";
  if (locale === "ko") return "ko-KR";
  return "en-US";
}

function upper(text: string, locale: Locale): string {
  return text.toLocaleUpperCase(upperLocaleFor(locale));
}

export function FocusTimer({
  state,
  elapsedMs,
  todayTotalMs,
  personalRecordMs,
  didBreakPR,
  breakRemainingMs,
  breakElapsedMs = 0,
  breakOpenEnded = false,
  breakTypeId,
  breakDurationMs = 0,
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
  hidePersonalBreak = false,
  heroTitle,
  topBar,
  meltConfig = null,
  meltProgress = 0,
  onMeltIt,
  onSpeedUpMelt,
  meltAnimSpeed = 1,
  meltComplete = false,
  heroLayout = "solo",
  heroExtra,
  children,
}: {
  state: SessionState;
  elapsedMs: number;
  todayTotalMs: number;
  personalRecordMs: number;
  didBreakPR: boolean;
  breakRemainingMs: number;
  breakElapsedMs?: number;
  breakOpenEnded?: boolean;
  breakTypeId?: BreakTypeId | null;
  breakDurationMs?: number;
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
  hidePersonalBreak?: boolean;
  heroTitle?: ReactNode;
  topBar?: ReactNode;
  meltConfig?: MeltConfig | null;
  meltProgress?: number;
  onMeltIt?: () => void;
  onSpeedUpMelt?: () => void;
  meltAnimSpeed?: number;
  meltComplete?: boolean;
  /** Solo keeps ring+dessert; room puts clock left + table in the outline. */
  heroLayout?: "solo" | "room";
  /** Room table (or other) rendered inside the hero outline. */
  heroExtra?: ReactNode;
  /** Extra content below the hero (legacy; prefer heroExtra for rooms). */
  children?: ReactNode;
}) {
  const { t, locale } = useTranslation();
  const breakDef = getBreakType(breakTypeId);
  const accent =
    state === "ON_BREAK" && breakDef
      ? breakTypeAccent(breakDef.theme)
      : stateAccent(state);
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

  const breakElapsedForLabel = breakOpenEnded
    ? breakElapsedMs
    : Math.max(0, breakDurationMs - breakRemainingMs);

  const breakLiveLabel =
    state === "ON_BREAK" && breakTypeId
      ? buildBreakLiveLabel(breakTypeId, breakElapsedForLabel, t)
      : "";

  useEffect(() => {
    if (!didBreakPR) return;
    const timer = setTimeout(onClearPrBurst, 1400);
    return () => clearTimeout(timer);
  }, [didBreakPR, onClearPrBurst]);

  const isMeltMode = Boolean(
    meltConfig &&
      (state === "LOCKED_IN" ||
        state === "ON_BREAK" ||
        state === "CHOOSING_BREAK" ||
        state === "BREAK_DONE"),
  );
  const isRoomHero = heroLayout === "room";
  const showMeltItChip =
    Boolean(onMeltIt) &&
    (state === "IDLE" || state === "TAPPED_OUT" || state === "ENDED");
  const isDev = process.env.NODE_ENV !== "production";

  /** Room hero: stack in portrait, side-by-side only when wider than tall. */
  const roomHeroRef = useRef<HTMLDivElement>(null);
  const [roomLandscape, setRoomLandscape] = useState(false);
  useLayoutEffect(() => {
    if (!isRoomHero) return;
    const el = roomHeroRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setRoomLandscape(width > height && width >= 560);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isRoomHero]);

  const meltItChip = showMeltItChip ? (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="z-20 flex shrink-0 items-center gap-1.5 self-start rounded-full border border-amber-300 bg-card/95 px-3 py-1.5 text-xs font-bold tracking-wide text-amber-800 shadow-soft backdrop-blur-sm hover:bg-amber-50 disabled:opacity-50 dark:border-amber-400/40 dark:text-amber-300 dark:hover:bg-amber-400/15"
      onClick={onMeltIt}
      disabled={lockInDisabled}
    >
      <IceCreamCone className="h-3.5 w-3.5" aria-hidden />
      {t("melt.action.meltIt")}
    </motion.button>
  ) : null;

  const roomClockMs =
    state === "ON_BREAK"
      ? breakOpenEnded
        ? breakElapsedMs
        : breakRemainingMs
      : elapsedMs;
  const roomClockTone: FlipClockTone = muted
    ? "stopped"
    : state === "LOCKED_IN" || state === "ON_BREAK"
      ? "live"
      : "idle";
  const roomStatusLabel =
    state === "BREAK_DONE"
      ? upper(t("timer.breakComplete"), locale)
      : state === "ON_BREAK"
        ? breakDef
          ? breakLiveLabel
          : t("timer.onBreak")
        : state === "CHOOSING_BREAK"
          ? upper(t("timer.pausedBreak"), locale)
          : muted
            ? upper(t("timer.sessionStopped"), locale)
            : state === "LOCKED_IN"
              ? upper(t("timer.liveElapsed"), locale)
              : state === "ENDED"
                ? upper(t("timer.sessionLogged"), locale)
                : upper(t("timer.ready"), locale);

  return (
    <motion.div
      layout
      transition={springSoft}
      className={cn("relative", isRoomHero && "flex min-h-0 flex-1 flex-col")}
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
          isRoomHero && "flex min-h-0 flex-1 flex-col",
          isActiveFocus
            ? isRoomHero
              ? "p-2.5 sm:p-4"
              : "p-3 sm:p-5"
            : "p-4 sm:p-8",
          accent.card,
          muted && "grayscale-[0.35]",
        )}
        style={{
          boxShadow:
            state === "LOCKED_IN" || state === "ON_BREAK"
              ? accent.glow
              : undefined,
        }}
      >
        {topBar ? (
          <div
            className={cn(
              "shrink-0",
              isActiveFocus ? "mb-2 sm:mb-3" : "mb-4",
            )}
          >
            {topBar}
          </div>
        ) : null}
        {heroTitle ? (
          <div
            className={cn(
              "flex shrink-0 justify-center text-center",
              isActiveFocus ? "mb-2 sm:mb-3" : "mb-5",
            )}
          >
            {heroTitle}
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center gap-2 text-center",
              isActiveFocus ? "mb-3" : "mb-5",
            )}
          >
            <Lock className={cn("h-5 w-5 shrink-0", accent.text)} />
            <span
              className={cn(
                "font-display text-xl font-bold tracking-tight sm:text-2xl",
                muted
                  ? "text-red-700 dark:text-red-300"
                  : "text-foreground",
              )}
            >
              {(sessionName ?? "").trim() ||
                upper(t("timer.label"), locale)}
            </span>
          </div>
        )}

        <div
          className={cn(
            "relative mx-auto flex min-w-0 w-full items-center justify-center overflow-visible rounded-2xl border px-2 sm:px-8 md:px-10",
            isRoomHero
              ? "mb-2 min-h-0 flex-1 border-border bg-background py-2 sm:mb-3 sm:py-3"
              : isMeltMode
                ? "mb-3 min-h-[200px] border-border bg-background py-3 sm:min-h-[280px] sm:py-4 md:min-h-[360px]"
                : isActiveFocus
                  ? "mb-3 min-h-[120px] py-3 sm:mb-4 sm:min-h-[200px] sm:py-6 md:min-h-[220px] lg:min-h-[240px]"
                  : "mb-4 min-h-[140px] py-4 sm:mb-6 sm:min-h-[280px] sm:py-10 md:min-h-[320px] lg:min-h-[360px]",
            isRoomHero
              ? state === "ON_BREAK" && breakDef
                ? cn(accent.border, accent.bg)
                : muted
                  ? "border-red-200/60 bg-red-50/50 dark:border-red-400/30 dark:bg-red-500/10"
                  : "border-border bg-background"
              : isMeltMode && state === "ON_BREAK" && breakDef
                ? cn(accent.border, accent.bg)
                : !isMeltMode &&
                  (muted
                    ? "border-red-200/60 bg-red-50/50 dark:border-red-400/30 dark:bg-red-500/10"
                    : state === "ON_BREAK" && breakDef
                      ? cn(accent.border, accent.bg)
                      : "border-border bg-background"),
          )}
        >
          <ParticleBurst active={didBreakPR && state === "LOCKED_IN"} />
          <ParticleBurst
            active={meltComplete && isMeltMode && state === "LOCKED_IN"}
          />

          {state === "LOCKED_IN" && (
            <motion.div
              className="pointer-events-none absolute inset-2 rounded-2xl border-2"
              style={{ borderColor: accent.ring }}
              animate={{ scale: [1, 1.015, 1], opacity: [0.45, 0.95, 0.45] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <div
            className={cn(
              "relative z-10 w-full min-w-0 text-center",
              isRoomHero && "flex h-full min-h-0 flex-col",
            )}
          >
            {isRoomHero ? (
              <motion.div
                key="room-hero"
                ref={roomHeroRef}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springSoft}
                className={cn(
                  "flex h-full min-h-0 w-full gap-2",
                  roomLandscape
                    ? "flex-row items-stretch gap-4"
                    : "flex-col items-stretch",
                )}
              >
                <div
                  className={cn(
                    "flex shrink-0 flex-col gap-1.5",
                    roomLandscape
                      ? "items-start self-start pt-1"
                      : "items-center self-center",
                  )}
                >
                  {meltItChip}
                  {state === "BREAK_DONE" ? (
                    <p className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {t("timer.lockBackIn")}
                    </p>
                  ) : (
                    <FlipClock
                      ms={roomClockMs}
                      tone={roomClockTone}
                      size="sm"
                    />
                  )}
                  <p
                    className={cn(
                      "max-w-[11rem] text-[10px] leading-snug tracking-[0.12em]",
                      roomLandscape ? "text-left" : "text-center",
                      muted ? "text-red-400/70" : "text-muted-foreground",
                      accent.text &&
                        (state === "ON_BREAK" || state === "CHOOSING_BREAK") &&
                        accent.text,
                    )}
                  >
                    {state === "ON_BREAK" && breakDef ? (
                      <>
                        <span className="mr-1" aria-hidden>
                          {breakDef.emoji}
                        </span>
                        {roomStatusLabel}
                      </>
                    ) : (
                      roomStatusLabel
                    )}
                  </p>
                  {isMeltMode && meltConfig ? (
                    <MeltTimerChip
                      elapsedMs={elapsedMs}
                      meltProgress={meltProgress}
                      meltDurationMs={meltConfig.meltDurationMs}
                      showElapsed={false}
                      className="relative"
                    />
                  ) : null}
                  {onSpeedUpMelt && isDev && isMeltMode ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[10px] text-muted-foreground hover:text-amber-500 dark:hover:text-amber-400"
                      onClick={onSpeedUpMelt}
                    >
                      ⚡ speed up melt ({meltAnimSpeed}x)
                    </Button>
                  ) : null}
                  <AnimatePresence>
                    {didBreakPR && state === "LOCKED_IN" && (
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={springSoft}
                        className="font-display text-sm font-semibold text-amber-600 dark:text-amber-400"
                      >
                        {t("timer.newPr")}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-visible">
                  {heroExtra}
                </div>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                {isMeltMode && meltConfig ? (
                  <motion.div
                    key="melt-scene"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={springSoft}
                    className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:items-center sm:gap-6 md:gap-8"
                  >
                    <div className="relative aspect-square w-[min(100%,240px)] shrink-0 overflow-visible sm:w-[min(100%,min(420px,55%))]">
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="xMidYMid meet"
                        aria-hidden
                      >
                        <circle
                          cx={50}
                          cy={50}
                          r={46}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="text-slate-200"
                        />
                        <motion.circle
                          cx={50}
                          cy={50}
                          r={46}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          className={
                            state === "LOCKED_IN"
                              ? "text-lime-500"
                              : "text-amber-400"
                          }
                          strokeDasharray={PROGRESS_RING_CIRC}
                          strokeDashoffset={PROGRESS_RING_CIRC}
                          initial={{ strokeDashoffset: PROGRESS_RING_CIRC }}
                          animate={{
                            strokeDashoffset:
                              PROGRESS_RING_CIRC * (1 - meltProgress),
                          }}
                          transition={springSoft}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="absolute inset-[12%] flex items-center justify-center overflow-visible">
                        <MeltScene
                          config={meltConfig}
                          progress={meltProgress}
                          size="lg"
                          animated={state === "LOCKED_IN"}
                          className="!mx-auto !h-full !w-full !max-h-full !max-w-full"
                        />
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col items-center justify-center gap-3 sm:flex-1">
                      {meltItChip}
                      {state === "BREAK_DONE" ? (
                        <>
                          <p className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                            {t("timer.lockBackIn")}
                          </p>
                          <p className="text-xs tracking-[0.16em] text-muted-foreground">
                            {upper(t("timer.breakComplete"), locale)}
                          </p>
                        </>
                      ) : state === "ON_BREAK" || state === "CHOOSING_BREAK" ? (
                        <>
                          <p
                            className={cn(
                              "text-base font-semibold sm:text-lg",
                              accent.text,
                            )}
                          >
                            {state === "CHOOSING_BREAK" ? (
                              upper(t("timer.pausedBreak"), locale)
                            ) : breakDef ? (
                              <>
                                <span className="mr-1.5" aria-hidden>
                                  {breakDef.emoji}
                                </span>
                                {breakLiveLabel}
                              </>
                            ) : (
                              t("timer.onBreak")
                            )}
                          </p>
                          {state === "ON_BREAK" ? (
                            <FlipClock
                              ms={
                                breakOpenEnded
                                  ? breakElapsedMs
                                  : breakRemainingMs
                              }
                            />
                          ) : (
                            <FlipClock ms={elapsedMs} muted />
                          )}
                          <MeltTimerChip
                            elapsedMs={elapsedMs}
                            meltProgress={meltProgress}
                            meltDurationMs={meltConfig.meltDurationMs}
                            showElapsed={false}
                            className="relative"
                          />
                        </>
                      ) : (
                        <>
                          <FlipClock ms={elapsedMs} muted={muted} />
                          <p className="text-xs tracking-[0.16em] text-muted-foreground">
                            {upper(t("timer.liveElapsed"), locale)}
                          </p>
                          <MeltTimerChip
                            elapsedMs={elapsedMs}
                            meltProgress={meltProgress}
                            meltDurationMs={meltConfig.meltDurationMs}
                            showElapsed={false}
                            className="relative"
                          />
                          {onSpeedUpMelt && isDev ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-[10px] text-muted-foreground hover:text-amber-500 dark:hover:text-amber-400"
                              onClick={onSpeedUpMelt}
                            >
                              ⚡ speed up melt ({meltAnimSpeed}x)
                            </Button>
                          ) : null}
                          <AnimatePresence>
                            {didBreakPR && (
                              <motion.p
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={springSoft}
                                className="font-display text-lg font-semibold text-amber-600 dark:text-amber-400"
                              >
                                {t("timer.newPr")}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  </motion.div>
                ) : state === "BREAK_DONE" ? (
                  <motion.div
                    key="lock-back"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={springSoft}
                    className="flex flex-col items-center gap-1.5 px-2"
                  >
                    {meltItChip}
                    <p className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                      {t("timer.lockBackIn")}
                    </p>
                    <p className="mt-3 text-xs tracking-[0.16em] text-muted-foreground">
                      {upper(t("timer.breakComplete"), locale)}
                    </p>
                  </motion.div>
                ) : state === "ON_BREAK" ? (
                  <motion.div
                    key="break-count"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={springSoft}
                    className="flex flex-col items-center gap-1.5"
                  >
                    {meltItChip}
                    <p
                      className={cn(
                        "mb-3 text-base font-semibold sm:text-lg",
                        accent.text,
                      )}
                    >
                      {breakDef ? (
                        <>
                          <span className="mr-1.5" aria-hidden>
                            {breakDef.emoji}
                          </span>
                          {breakLiveLabel}
                        </>
                      ) : null}
                    </p>
                    <FlipClock
                      ms={breakOpenEnded ? breakElapsedMs : breakRemainingMs}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="focus-clock"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={springSoft}
                    className="flex flex-col items-center gap-1.5"
                  >
                    {meltItChip}
                    <FlipClock ms={elapsedMs} muted={muted} />
                    <p
                      className={cn(
                        "mt-3 text-xs tracking-[0.16em]",
                        muted ? "text-red-400/70" : "text-muted-foreground",
                      )}
                    >
                      {upper(
                        muted
                          ? t("timer.sessionStopped")
                          : state === "LOCKED_IN"
                            ? t("timer.liveElapsed")
                            : state === "CHOOSING_BREAK"
                              ? t("timer.pausedBreak")
                              : state === "ENDED"
                                ? t("timer.sessionLogged")
                                : t("timer.ready"),
                        locale,
                      )}
                    </p>
                    <AnimatePresence>
                      {didBreakPR && state === "LOCKED_IN" && (
                        <motion.p
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={springSoft}
                          className="mt-3 font-display text-lg font-semibold text-amber-600 dark:text-amber-400"
                        >
                          {t("timer.newPr")}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {children}

        <div
          className={cn(
            "grid shrink-0 grid-cols-2 gap-2 sm:gap-3",
            isActiveFocus ? "mb-2 sm:mb-3" : "mb-5 sm:mb-8",
          )}
        >
          <div
            className={cn(
              "rounded-xl border",
              isActiveFocus ? "px-3 py-2" : "px-4 py-3",
              muted
                ? "border-red-200/60 bg-red-50/40 dark:border-red-400/30 dark:bg-red-500/10"
                : "border-border bg-card",
            )}
          >
            <p
              className={cn(
                "text-[10px] tracking-[0.14em]",
                muted ? "text-red-400/70" : "text-muted-foreground",
              )}
            >
              {upper(t("timer.today"), locale)}
            </p>
            <p
              className={cn(
                "mt-0.5 font-mono tabular-nums",
                isActiveFocus ? "text-base" : "mt-1 text-lg",
                muted
                  ? "text-red-700/70 dark:text-red-300/80"
                  : "text-foreground",
              )}
            >
              {formatMs(todayTotalMs)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl border",
              isActiveFocus ? "px-3 py-2" : "px-4 py-3",
              muted
                ? "border-red-200/60 bg-red-50/40 dark:border-red-400/30 dark:bg-red-500/10"
                : "border-amber-200 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-400/10",
            )}
          >
            <p
              className={cn(
                "flex items-center gap-1 text-[10px] tracking-[0.14em]",
                muted ? "text-red-400/70" : "text-amber-600 dark:text-amber-400",
              )}
            >
              <Trophy className="h-3 w-3" /> {upper(t("timer.pr"), locale)}
            </p>
            <p
              className={cn(
                "mt-0.5 font-mono tabular-nums",
                isActiveFocus ? "text-base" : "mt-1 text-lg",
                muted
                  ? "text-red-700/70 dark:text-red-300/80"
                  : "text-amber-700 dark:text-amber-400",
              )}
            >
              {formatMs(personalRecordMs)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:gap-3">
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
                  className="w-full border border-lime-500/40 bg-lime-400 py-6 text-xl font-bold tracking-wide text-slate-950 hover:bg-lime-300 sm:py-8 sm:text-2xl"
                  onClick={onLockBackIn}
                >
                  <Play className="!size-6" />
                  {t("timer.lockBackIn")}
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  className="w-full border-border py-6 text-xl font-bold tracking-wide text-foreground sm:py-8 sm:text-2xl"
                  onClick={onEndSession}
                >
                  {t("timer.endSession")}
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
                  <span className="mb-1.5 block text-[10px] tracking-[0.14em] text-muted-foreground">
                    {upper(t("timer.sessionName"), locale)}{" "}
                    <span className="normal-case tracking-normal text-muted-foreground">
                      {t("timer.optional")}
                    </span>
                  </span>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => onSessionNameChange(e.target.value)}
                    placeholder={t("timer.sessionNamePlaceholder")}
                    maxLength={80}
                    className="w-full cursor-text rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-border focus:ring-2 focus:ring-ring/40"
                  />
                </label>
                <Button
                  size="xl"
                  className={cn(
                    "relative z-10 w-full py-6 text-xl font-bold tracking-wide shadow-soft sm:py-8 sm:text-2xl md:text-3xl",
                    accent.button,
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
                    "flex w-full items-center justify-center rounded-2xl border font-display font-bold tracking-wide",
                    isActiveFocus
                      ? "py-3 text-base sm:py-3.5 sm:text-lg"
                      : "py-5 text-lg sm:py-6 sm:text-xl",
                    accent.button,
                  )}
                >
                  <Pause className="mr-2 h-5 w-5" />
                  {state === "CHOOSING_BREAK"
                    ? t("timer.break")
                    : t("timer.onBreak")}
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
                  className="pointer-events-none absolute -inset-1.5 rounded-xl border-2 border-lime-400 sm:-inset-2 sm:rounded-2xl"
                  animate={{ scale: [1, 1.03, 1], opacity: [0.4, 0.95, 0.4] }}
                  transition={{
                    duration: 2.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ boxShadow: "0 0 28px rgba(132,204,22,0.45)" }}
                />
                <Button
                  size="lg"
                  className={cn(
                    "relative z-10 w-full cursor-default py-3 text-base font-bold tracking-wide sm:py-3.5 sm:text-lg",
                    accent.button,
                  )}
                  aria-pressed
                >
                  <Lock className="!size-5" />
                  {t("timer.lockedIn")}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSecondary && (
              <motion.div
                key="secondary"
                className="grid grid-cols-2 gap-2 sm:gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={springSoft}
              >
                {state === "LOCKED_IN" && !hidePersonalBreak ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-400/40 dark:text-amber-300 dark:hover:bg-amber-400/15"
                    onClick={onPitStop}
                  >
                    <Pause className="h-4 w-4" />
                    {t("timer.break")}
                  </Button>
                ) : null}
                {state === "ON_BREAK" || state === "CHOOSING_BREAK" ? (
                  <Button
                    size="lg"
                    className="col-span-2 border border-lime-500/40 bg-lime-400 text-slate-950 hover:bg-lime-300"
                    onClick={onLockBackIn}
                  >
                    <Play className="h-4 w-4" />
                    {t("timer.lockBackIn")}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className={cn(
                      "border border-red-600 bg-red-500 text-white hover:bg-red-600",
                      hidePersonalBreak && "col-span-2",
                    )}
                    onClick={onTapOut}
                  >
                    {t("timer.finish")}
                  </Button>
                )}
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
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
              {t("timer.shareSession")}
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
