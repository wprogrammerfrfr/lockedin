"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * One half of a flip card. Parent MUST be exactly 50% of the full card height.
 * Digit is laid out at 200% height so top/bottom halves share the same glyph
 * center — this keeps curved digits (0, 3, 6, 8, 9) aligned at the seam.
 *
 * NOTE: Do not use marginTop % for the bottom offset — % margins resolve against
 * width, not height, which hides the bottom half of every digit.
 */
export type FlipClockSize = "default" | "sm" | "xs";

const DIGIT_GLYPH: Record<FlipClockSize, string> = {
  default:
    "text-[4.5rem] sm:text-[5.25rem] md:text-[6.75rem] lg:text-[7.5rem]",
  sm: "text-[2.25rem] sm:text-[2.75rem] md:text-[3.25rem]",
  xs: "text-lg font-bold",
};

const DIGIT_BOX: Record<FlipClockSize, string> = {
  default: "h-24 w-[4.5rem] sm:h-28 sm:w-20 md:h-36 md:w-24 lg:h-40 lg:w-28",
  sm: "h-14 w-10 sm:h-16 sm:w-12 md:h-[4.5rem] md:w-14",
  xs: "h-10 w-7 rounded-lg",
};

const COLON_BOX: Record<FlipClockSize, string> = {
  default:
    "h-24 w-3 sm:h-28 md:h-36 md:w-3.5 lg:h-40 text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
  sm: "h-14 w-2 sm:h-16 md:h-[4.5rem] md:w-2.5 text-lg sm:text-xl md:text-2xl",
  xs: "h-10 w-1.5 text-sm",
};

export function DigitHalf({
  value,
  half,
  className,
  size = "default",
}: {
  value: string;
  half: "top" | "bottom";
  className?: string;
  size?: FlipClockSize;
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
            "flex select-none items-center justify-center font-mono font-bold leading-none tabular-nums",
            DIGIT_GLYPH[size],
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export function FlipDigit({
  digit,
  muted,
  size = "default",
}: {
  digit: string;
  muted?: boolean;
  size?: FlipClockSize;
}) {
  const [active, setActive] = useState(digit);
  const [prev, setPrev] = useState(digit);
  const [flipping, setFlipping] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const activeRef = useRef(digit);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const beginFlip = useCallback((from: string, to: string) => {
    if (from === to) {
      busyRef.current = false;
      return;
    }
    busyRef.current = true;
    setPrev(from);
    setActive(to);
    setFlipping(true);
  }, []);

  const finishFlip = useCallback(() => {
    setFlipping(false);
    busyRef.current = false;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending != null && pending !== activeRef.current) {
      beginFlip(activeRef.current, pending);
    }
  }, [beginFlip]);

  useEffect(() => {
    if (digit === activeRef.current && !busyRef.current) return;
    if (digit === activeRef.current) return;
    if (busyRef.current) {
      // Keep only the latest target so lagged seconds don't stack ghosts
      pendingRef.current = digit;
      return;
    }
    beginFlip(activeRef.current, digit);
  }, [digit, beginFlip]);

  const panel = muted
    ? "bg-red-100/90 text-red-700/80 border border-red-200/70"
    : "bg-slate-900 text-white border border-slate-700";
  const xsPanel = muted
    ? "bg-red-100/90 text-red-700/80"
    : "bg-slate-900 text-white";
  const digitPanel = size === "xs" ? xsPanel : panel;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        DIGIT_BOX[size],
        size === "xs" &&
          (muted
            ? "border border-red-200/70"
            : "border border-slate-700"),
      )}
      style={{ perspective: 900, transformStyle: "preserve-3d" }}
    >
      {/* Static top — always the destination digit */}
      <div className="absolute inset-x-0 top-0 z-[1] h-1/2">
        <DigitHalf
          value={active}
          half="top"
          size={size}
          className={cn(digitPanel, size !== "xs" && "border-b-0")}
        />
      </div>

      {/* Static bottom — old while flipping, then destination */}
      <div className="absolute inset-x-0 bottom-0 z-[1] h-1/2">
        <DigitHalf
          value={flipping ? prev : active}
          half="bottom"
          size={size}
          className={cn(digitPanel, size !== "xs" && "border-t-0")}
        />
      </div>

      {/* Hinge — full-width, 1px, dead center (hidden on xs wall clock) */}
      {size !== "xs" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 h-[1px] -translate-y-1/2 bg-black/40" />
      )}

      {flipping && (
        <>
          {/* Phase 1: old top folds down */}
          <motion.div
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
              className={cn(
                digitPanel,
                size !== "xs" && "border-b-0 shadow-soft",
              )}
            />
          </motion.div>

          {/* Phase 2: new bottom unfolds into place */}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-20 h-1/2 origin-top"
            style={{
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d",
            }}
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={flipBottomTransition}
            onAnimationComplete={finishFlip}
          >
            <DigitHalf
              value={active}
              half="bottom"
              size={size}
              className={cn(digitPanel, size !== "xs" && "border-t-0")}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}

const HOUR_MS = 3_600_000;

export function FlipClock({
  ms,
  value,
  forceHours = true,
  className,
  muted,
  size = "default",
}: {
  ms?: number;
  /** Wall-clock / literal display string (e.g. "14:32"). Skips duration formatting. */
  value?: string;
  forceHours?: boolean;
  className?: string;
  muted?: boolean;
  size?: FlipClockSize;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

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

  const measured = width > 0;
  const compact = size === "sm" || size === "xs";
  const elapsed = ms ?? 0;
  const narrow = !measured || width < (size === "xs" ? 0 : compact ? 360 : 480);
  const showHours = forceHours && (!narrow || elapsed >= HOUR_MS);
  const showCs = !value && size === "default" && measured && width >= 400;
  const text = value ?? formatMs(elapsed, showHours);
  const cs = formatCentiseconds(elapsed);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "flex w-full min-w-0 items-end justify-center",
        size === "xs"
          ? "gap-0.5"
          : compact
            ? "gap-1 sm:gap-1.5 md:gap-2"
            : "gap-1.5 sm:gap-2 md:gap-2.5",
        className,
      )}
      aria-label={showCs ? `${text}:${cs}` : text}
      style={{ perspective: 1200 }}
    >
      {text.split("").map((ch, i) =>
        ch === ":" ? (
          <span
            key={`colon-${i}`}
            className={cn(
              "flex shrink-0 items-center justify-center font-mono font-bold opacity-45",
              COLON_BOX[size],
              muted ? "text-red-400" : "text-slate-500",
            )}
          >
            :
          </span>
        ) : (
          <FlipDigit key={`pos-${i}`} digit={ch} muted={muted} size={size} />
        ),
      )}
      {showCs && (
        <span
          className={cn(
            "mb-1 flex shrink-0 items-baseline gap-0.5 font-mono font-bold tabular-nums sm:mb-1.5 md:mb-2",
            "text-lg sm:text-xl md:text-2xl lg:text-3xl",
            muted ? "text-red-400/70" : "text-slate-400",
          )}
        >
          <span className="opacity-45">:</span>
          {cs}
        </span>
      )}
    </div>
  );
}
