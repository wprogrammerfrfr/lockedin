"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";

import { formatCentiseconds, formatMs } from "@/features/session/format";
import { cn } from "@/lib/utils";

/** Crisp mechanical flip — high damping avoids 3D overshoot/ghosting. */
const flipTopTransition = { duration: 0.3, ease: [0.4, 0, 0.6, 1] as const };
const flipBottomTransition = {
  duration: 0.3,
  ease: [0.4, 0, 0.6, 1] as const,
  delay: 0.3,
};

/** If onAnimationComplete never fires, unlock the digit after this. */
const FLIP_WATCHDOG_MS = 800;

/**
 * One half of a flip card. Parent MUST be exactly 50% of the full card height.
 * Digit is laid out at 200% height so top/bottom halves share the same glyph
 * center — this keeps curved digits (0, 3, 6, 8, 9) aligned at the seam.
 *
 * NOTE: Do not use marginTop % for the bottom offset — % margins resolve against
 * width, not height, which hides the bottom half of every digit.
 */
export type FlipClockSize = "default" | "sm" | "xs";

/** Visual tone for digit panels — idle is theme chrome, live is neon, stopped is red. */
export type FlipClockTone = "live" | "idle" | "stopped";

function resolveTone(tone?: FlipClockTone, muted?: boolean): FlipClockTone {
  if (tone) return tone;
  return muted ? "stopped" : "live";
}

const PANEL_BY_TONE: Record<FlipClockTone, string> = {
  stopped:
    "bg-red-100/90 text-red-700/80 border border-red-200/70 dark:bg-red-500/15 dark:text-red-300 dark:border-red-400/30",
  idle: "bg-card text-foreground border border-border dark:bg-zinc-900 dark:text-zinc-100 dark:border-white/10",
  live: "bg-slate-900 text-white border border-slate-700 dark:bg-zinc-950 dark:text-lime-300 dark:border-lime-400/20",
};

const XS_PANEL_BY_TONE: Record<FlipClockTone, string> = {
  stopped:
    "bg-red-100/90 text-red-700/80 dark:bg-red-500/15 dark:text-red-300",
  idle: "bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100",
  live: "bg-slate-900 text-white dark:bg-zinc-950 dark:text-lime-300",
};

const XS_BORDER_BY_TONE: Record<FlipClockTone, string> = {
  stopped: "border border-red-200/70 dark:border-red-400/30",
  idle: "border border-border dark:border-white/10",
  live: "border border-slate-700 dark:border-lime-400/20",
};

const COLON_BY_TONE: Record<FlipClockTone, string> = {
  stopped: "text-red-400",
  idle: "text-muted-foreground",
  live: "text-slate-500 flip-neon-sm dark:opacity-100",
};

const CS_BY_TONE: Record<FlipClockTone, string> = {
  stopped: "text-red-400/70",
  idle: "text-muted-foreground",
  live: "text-slate-400 flip-neon-sm",
};

const DIGIT_GLYPH: Record<FlipClockSize, string> = {
  default:
    "text-[3.5rem] sm:text-[5.25rem] md:text-[6.75rem] lg:text-[7.5rem]",
  sm: "text-[2.25rem] sm:text-[2.75rem] md:text-[3.25rem]",
  xs: "text-lg font-bold",
};

const DIGIT_BOX: Record<FlipClockSize, string> = {
  default: "h-20 w-14 sm:h-28 sm:w-20 md:h-36 md:w-24 lg:h-40 lg:w-28",
  sm: "h-14 w-10 sm:h-16 sm:w-12 md:h-[4.5rem] md:w-14",
  xs: "h-10 w-7 rounded-lg",
};

const COLON_BOX: Record<FlipClockSize, string> = {
  default:
    "h-20 w-2.5 sm:h-28 md:h-36 md:w-3.5 lg:h-40 text-xl sm:text-3xl md:text-4xl lg:text-5xl",
  sm: "h-14 w-2 sm:h-16 md:h-[4.5rem] md:w-2.5 text-lg sm:text-xl md:text-2xl",
  xs: "h-10 w-1.5 text-sm",
};

export function DigitHalf({
  value,
  half,
  className,
  size = "default",
  neon,
}: {
  value: string;
  half: "top" | "bottom";
  className?: string;
  size?: FlipClockSize;
  neon?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        size === "xs"
          ? null
          : half === "top"
            ? "rounded-t-xl"
            : "rounded-b-xl",
        className
      )}
    >
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{
          height: "200%",
          top: half === "top" ? "0%" : "-100%",
        }}
      >
        <span
          className={cn(
            "flex select-none items-center justify-center font-flip font-bold leading-none tabular-nums",
            DIGIT_GLYPH[size],
            neon && "flip-neon",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function FlipDigitImpl({
  digit,
  tone = "live",
  size = "default",
}: {
  digit: string;
  tone?: FlipClockTone;
  size?: FlipClockSize;
}) {
  const [active, setActive] = useState(digit);
  const [prev, setPrev] = useState(digit);
  const [flipping, setFlipping] = useState(false);
  const [flipGen, setFlipGen] = useState(0);
  const busyRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const activeRef = useRef(digit);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Current in-flight flip id — late completes from older flips are ignored. */
  const flipGenRef = useRef(0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current != null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const finishFlip = useCallback(() => {
    clearWatchdog();
    if (!busyRef.current) return;
    setFlipping(false);
    busyRef.current = false;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending != null && pending !== activeRef.current) {
      beginFlipRef.current(activeRef.current, pending);
    }
  }, [clearWatchdog]);

  const beginFlip = useCallback(
    (from: string, to: string) => {
      if (from === to) {
        busyRef.current = false;
        setFlipping(false);
        clearWatchdog();
        return;
      }
      const gen = flipGenRef.current + 1;
      flipGenRef.current = gen;
      busyRef.current = true;
      setPrev(from);
      setActive(to);
      setFlipGen(gen);
      setFlipping(true);
      clearWatchdog();
      watchdogRef.current = setTimeout(() => {
        // Missed onAnimationComplete (tab throttle / nested 3D) — unlock.
        if (busyRef.current && flipGenRef.current === gen) finishFlip();
      }, FLIP_WATCHDOG_MS);
    },
    [clearWatchdog, finishFlip],
  );

  const beginFlipRef = useRef(beginFlip);
  beginFlipRef.current = beginFlip;

  useEffect(() => {
    return () => clearWatchdog();
  }, [clearWatchdog]);

  useEffect(() => {
    if (digit === activeRef.current) {
      // Mid-flip sets active to the destination immediately, so digit===active
      // while busy is normal. Only unlock if busy but animation layers are gone.
      if (busyRef.current && !flipping) finishFlip();
      return;
    }
    if (busyRef.current) {
      // Keep only the latest target so lagged seconds don't stack ghosts
      pendingRef.current = digit;
      return;
    }
    beginFlip(activeRef.current, digit);
  }, [digit, beginFlip, finishFlip, flipping]);

  const digitPanel =
    size === "xs" ? XS_PANEL_BY_TONE[tone] : PANEL_BY_TONE[tone];
  const neon = tone === "live";
  const completeGen = flipGen;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        DIGIT_BOX[size],
        size === "xs" && XS_BORDER_BY_TONE[tone],
      )}
      style={{ perspective: 900, transformStyle: "preserve-3d" }}
    >
      {/* Static top — always the destination digit */}
      <div className="absolute inset-x-0 top-0 z-[1] h-1/2">
        <DigitHalf
          value={active}
          half="top"
          size={size}
          neon={neon}
          className={cn(digitPanel, size !== "xs" && "border-b-0")}
        />
      </div>

      {/* Static bottom — old while flipping, then destination */}
      <div className="absolute inset-x-0 bottom-0 z-[1] h-1/2">
        <DigitHalf
          value={flipping ? prev : active}
          half="bottom"
          size={size}
          neon={neon}
          className={cn(digitPanel, size !== "xs" && "border-t-0")}
        />
      </div>

      {/* Hinge — full-width, 1px, dead center (hidden on xs wall clock) */}
      {size !== "xs" && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-1/2 z-40 h-[1px] -translate-y-1/2",
            tone === "live"
              ? "bg-black/40 dark:bg-lime-400/20"
              : tone === "stopped"
                ? "bg-red-900/20 dark:bg-red-400/20"
                : "bg-black/20 dark:bg-white/15",
          )}
        />
      )}

      {flipping && (
        <>
          {/* Phase 1: old top folds down */}
          <motion.div
            key={`flip-top-${completeGen}`}
            className="absolute inset-x-0 top-0 z-30 h-1/2 origin-bottom"
            style={{
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d",
            }}
            initial={{ rotateX: 0 }}
            animate={{ rotateX: -90 }}
            transition={flipTopTransition}
          >
            <DigitHalf
              value={prev}
              half="top"
              size={size}
              neon={neon}
              className={cn(
                digitPanel,
                size !== "xs" && "border-b-0 shadow-soft",
              )}
            />
          </motion.div>

          {/* Phase 2: new bottom unfolds into place */}
          <motion.div
            key={`flip-bottom-${completeGen}`}
            className="absolute inset-x-0 bottom-0 z-20 h-1/2 origin-top"
            style={{
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d",
            }}
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={flipBottomTransition}
            onAnimationComplete={() => {
              if (flipGenRef.current === completeGen) finishFlip();
            }}
          >
            <DigitHalf
              value={active}
              half="bottom"
              size={size}
              neon={neon}
              className={cn(digitPanel, size !== "xs" && "border-t-0")}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}

/** Memo so centisecond parent ticks do not re-render unchanged digits. */
export const FlipDigit = memo(FlipDigitImpl);

const HOUR_MS = 3_600_000;

/** Stable digit roles so resize never remaps FlipDigit identity. */
const TIME_KEYS = [
  "h0",
  "h1",
  "colon-hm",
  "m0",
  "m1",
  "colon-ms",
  "s0",
  "s1",
] as const;

export function FlipClock({
  ms,
  value,
  forceHours = true,
  className,
  muted,
  tone,
  size = "default",
}: {
  ms?: number;
  /** Wall-clock / literal display string (e.g. "14:32"). Skips duration formatting. */
  value?: string;
  forceHours?: boolean;
  className?: string;
  /** @deprecated Prefer `tone="stopped"`. Kept for solo TAP OUT call sites. */
  muted?: boolean;
  tone?: FlipClockTone;
  size?: FlipClockSize;
}) {
  const resolvedTone = resolveTone(tone, muted);
  /** Outer container — measured to get the available width. */
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Inner flex row — we read its natural (unscaled) scroll width. */
  const rowRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const [rowHeight, setRowHeight] = useState<number | null>(null);

  const measured = width > 0;
  const isMobile = measured && width < 640;
  const compact = size === "sm" || size === "xs";
  const elapsed = ms ?? 0;
  // On narrow mobile widths, prefer MM:SS until the timer passes one hour.
  const effectiveForceHours = isMobile ? false : forceHours;
  const showHours = Boolean(value)
    ? false
    : effectiveForceHours || elapsed >= HOUR_MS;
  const showCs = !value && size === "default" && measured && width >= 400;
  const text = value ?? formatMs(elapsed, showHours);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || width === 0) return;
    // scrollWidth gives the natural (pre-transform) width
    const naturalW = row.scrollWidth;
    const naturalH = row.offsetHeight;
    const s = naturalW > 0 ? Math.min(1, width / naturalW) : 1;
    // Only update state when values actually change to avoid re-render loops
    setScale((prev) => (Math.abs(prev - s) < 0.001 ? prev : s));
    setRowHeight((prev) => (prev === naturalH ? prev : naturalH));
  }, [width, text]);
  const cs = formatCentiseconds(elapsed);

  const chars = text.split("");
  const useRoleKeys = !value && showHours && chars.length === 8;

  const gapClass =
    size === "xs"
      ? "gap-0.5"
      : compact
        ? "gap-1 sm:gap-1.5 md:gap-2"
        : "gap-1 sm:gap-2 md:gap-2.5";

  return (
    /*
     * Outer: fills available width, reports it via ResizeObserver, and acts as
     * the height container — collapses to the scaled row height so no dead
     * space sits below the status label.
     */
    <div
      ref={wrapRef}
      className={cn("w-full min-w-0", className)}
      aria-label={showCs ? `${text}:${cs}` : text}
      style={
        rowHeight != null
          ? { height: rowHeight * scale }
          : undefined
      }
    >
      {/*
       * Inner: natural (unscaled) flex row. Scale origin is top-center so
       * the digit tops stay flush with the outline top-padding.
       */}
      <div
        ref={rowRef}
        className={cn(
          "flex items-end justify-center",
          gapClass,
        )}
        style={{
          transformOrigin: "top center",
          transform: scale < 1 ? `scale(${scale})` : undefined,
          perspective: 1200,
        }}
      >
        {chars.map((ch, i) =>
          ch === ":" ? (
            <span
              key={useRoleKeys ? TIME_KEYS[i] : `colon-${i}`}
              className={cn(
                "flex shrink-0 items-center justify-center font-flip font-bold opacity-45",
                COLON_BOX[size],
                COLON_BY_TONE[resolvedTone],
              )}
            >
              :
            </span>
          ) : (
            <FlipDigit
              key={useRoleKeys ? TIME_KEYS[i] : `pos-${i}`}
              digit={ch}
              tone={resolvedTone}
              size={size}
            />
          ),
        )}
        {showCs && (
          <span
            className={cn(
              "mb-1 flex shrink-0 items-baseline gap-0.5 font-flip font-bold tabular-nums sm:mb-1.5 md:mb-2",
              "text-lg sm:text-xl md:text-2xl lg:text-3xl",
              CS_BY_TONE[resolvedTone],
            )}
          >
            <span className="opacity-45">:</span>
            {cs}
          </span>
        )}
      </div>
    </div>
  );
}
