"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RoomPresenceMember } from "@/features/rooms/types";
import {
  memberDisplayClock,
  useNow,
  type SelfLiveClock,
} from "@/features/rooms/live-member-clock";
import type { MeltConfig } from "@/features/session/melt-catalog";
import { MeltScene } from "@/components/session/MeltScene";
import { computeMeltProgress } from "@/features/session/melt-utils";
import { formatMs } from "@/features/session/format";
import { springSoft } from "@/components/session/state-accent";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

export type RoomMeltMember = RoomPresenceMember & {
  meltConfig?: MeltConfig | null;
  meltAnimOffsetMs?: number;
  meltAnimSpeed?: number;
  meltCustomizing?: boolean;
  meltBoardX?: number | null;
  meltBoardZ?: number | null;
};

/** Horizontal pad on the slab (percent of container; matches front apron ~8–296 / 320). */
const BOARD_X_MIN = 0.05;
const BOARD_X_MAX = 0.91;
/** Depth: 0 = front (larger), 1 = back (smaller / higher). */
const BOARD_Z_MIN = 0;
const BOARD_Z_MAX = 1;
/**
 * Tabletop contact as % from bottom of the chrome box.
 * Shorter chrome (viewBox 320×78): top face ~y22–36, lip ~36–46 → contact ~42%.
 */
const TABLETOP_BOTTOM_PCT = 42;
/** Extra stage height above the chrome for scoop/topping headroom. */
const STAGE_HEADROOM_RATIO = 0.18;
const DESSERT_MIN_PX = 88;
const DESSERT_MAX_PX = 220;

function isActiveMelt(member: RoomMeltMember): boolean {
  if (!member.meltConfig || member.meltCustomizing) return false;
  return member.status === "LOCKED_IN" || member.status === "BREAK";
}

function sortMeltingMembers(members: RoomMeltMember[]): RoomMeltMember[] {
  return members
    .filter(isActiveMelt)
    .sort((a, b) => {
      const seatA = typeof a.seat === "number" ? a.seat : 99;
      const seatB = typeof b.seat === "number" ? b.seat : 99;
      if (seatA !== seatB) return seatA - seatB;
      return a.userId.localeCompare(b.userId);
    });
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function autoLayout(
  index: number,
  total: number,
): { x: number; z: number } {
  const tPos = total === 1 ? 0.5 : (index + 0.5) / total;
  return { x: clamp01(tPos), z: index % 2 === 0 ? 0 : 1 };
}

function boardToStyle(x: number, z: number) {
  const leftPct = (BOARD_X_MIN + clamp01(x) * (BOARD_X_MAX - BOARD_X_MIN)) * 100;
  const depth = clamp01(z);
  const scale = 1 - depth * 0.08;
  const zIndex = depth < 0.5 ? 20 : 10;
  return { leftPct, scale, zIndex };
}

/**
 * Dessert footprint from stage height (primary) and width / count (secondary).
 * Table hugs this size — never a fixed 104px cap.
 */
function dessertWidthPx(
  stageWidth: number,
  stageHeight: number,
  count: number,
): number {
  if (stageWidth <= 0 && stageHeight <= 0) return 96;
  const n = Math.max(1, count);
  const fromHeight = stageHeight > 0 ? stageHeight * 0.48 : DESSERT_MIN_PX;
  const fromWidth =
    stageWidth > 0 ? (stageWidth / n) * 0.72 : DESSERT_MIN_PX;
  return Math.min(
    DESSERT_MAX_PX,
    Math.max(DESSERT_MIN_PX, Math.min(fromHeight, fromWidth)),
  );
}

function tableChromeWidthPx(dessertPx: number, count: number): number {
  const n = Math.max(1, count);
  return Math.round(n * dessertPx * 1.55 + 24);
}

/** Flat 2D table slab — compact top + short legs (viewBox 320×78). */
function SideTableChrome({ className }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none h-full w-full", className)}
      viewBox="0 0 320 78"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Legs — short so scoops dominate the stage */}
      <rect x="28" y="46" width="10" height="22" fill="#9CA3AF" />
      <rect x="282" y="46" width="10" height="22" fill="#9CA3AF" />
      {/* Front lip */}
      <rect x="12" y="36" width="296" height="12" fill="#D1D5DB" />
      {/* Top surface */}
      <rect x="12" y="22" width="296" height="16" rx="6" fill="#E5E7EB" />
    </svg>
  );
}

function DessertOnTable({
  member,
  selfUserId,
  selfLive,
  now,
  meltingCount,
  index,
  total,
  tableRef,
  dessertPx,
  tabletopFromBottomPct,
  onBoardPosChange,
}: {
  member: RoomMeltMember;
  selfUserId: string | null;
  selfLive?: SelfLiveClock | null;
  now: number;
  meltingCount: number;
  index: number;
  total: number;
  tableRef: RefObject<HTMLDivElement | null>;
  dessertPx: number;
  /** Contact line as % from bottom of the board wrapper. */
  tabletopFromBottomPct: number;
  onBoardPosChange?: (x: number, z: number) => void;
}) {
  const { t } = useTranslation();
  const isSelf = member.userId === selfUserId;
  const config = member.meltConfig!;
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; z: number } | null>(null);
  const dragPosRef = useRef<{ x: number; z: number } | null>(null);
  const lastEmitRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [pinnedName, setPinnedName] = useState(false);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  const clock = memberDisplayClock(member, now, selfLive);
  const progress = computeMeltProgress(
    clock.elapsedMs,
    member.meltAnimOffsetMs ?? 0,
    config.meltDurationMs,
    member.meltAnimSpeed ?? 1,
  );

  const auto = autoLayout(index, total);
  const placedX =
    typeof member.meltBoardX === "number" ? member.meltBoardX : null;
  const placedZ =
    typeof member.meltBoardZ === "number" ? member.meltBoardZ : null;
  const baseX = placedX ?? auto.x;
  const baseZ = placedZ ?? auto.z;
  const x = dragPos?.x ?? baseX;
  const z = dragPos?.z ?? baseZ;
  const { leftPct, scale, zIndex } = boardToStyle(x, z);
  const liveBottomPct = tabletopFromBottomPct + clamp01(z) * 3;

  // Drop local drag override once parent/members catch up.
  useEffect(() => {
    if (dragging || !dragPos) return;
    if (
      typeof member.meltBoardX === "number" &&
      typeof member.meltBoardZ === "number" &&
      Math.abs(member.meltBoardX - dragPos.x) < 0.02 &&
      Math.abs(member.meltBoardZ - dragPos.z) < 0.02
    ) {
      setDragPos(null);
      dragPosRef.current = null;
    }
  }, [dragging, dragPos, member.meltBoardX, member.meltBoardZ]);

  const pointerToBoard = useCallback(
    (clientX: number, clientY: number) => {
      const el = tableRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;
      const xNorm = (relX - BOARD_X_MIN) / (BOARD_X_MAX - BOARD_X_MIN);
      // Chrome box only: lower = front (z→0); upper toward top face = back.
      const zNorm = 1 - (relY - 0.2) / 0.45;
      return {
        x: clamp01(xNorm),
        z: clamp01(Math.min(BOARD_Z_MAX, Math.max(BOARD_Z_MIN, zNorm))),
      };
    },
    [tableRef],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pressOriginRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    if (!isSelf || !onBoardPosChange) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = pointerToBoard(e.clientX, e.clientY) ?? { x: baseX, z: baseZ };
    dragPosRef.current = next;
    setDragPos(next);
    setDragging(true);
    lastEmitRef.current = 0;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const origin = pressOriginRef.current;
    if (origin) {
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (dx * dx + dy * dy > 36) movedRef.current = true;
    }
    if (!dragging || !isSelf) return;
    const next = pointerToBoard(e.clientX, e.clientY);
    if (!next) return;
    dragPosRef.current = next;
    setDragPos(next);
    const nowTs = performance.now();
    if (nowTs - lastEmitRef.current >= 80) {
      lastEmitRef.current = nowTs;
      onBoardPosChange?.(next.x, next.z);
    }
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      const finalPos = dragPosRef.current ?? { x: baseX, z: baseZ };
      setDragging(false);
      onBoardPosChange?.(finalPos.x, finalPos.z);
    }
    // Tap toggles dessert name; ignore if the pointer moved (drag).
    if (!movedRef.current) {
      setPinnedName((v) => !v);
    }
    pressOriginRef.current = null;
    movedRef.current = false;
  };

  const showDessertName = hovered || pinnedName;
  const label = showDessertName ? config.displayName : member.username;
  const ariaLabel = `${member.username} — ${config.displayName}`;

  // Self always animated; others get FX when ≤2 desserts; larger LOD for room board.
  const sceneAnimated = isSelf || meltingCount <= 2;
  const sceneSize = meltingCount <= 2 ? "lg" : "md";

  return (
    <motion.div
      layout={!dragging}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale }}
      exit={{ opacity: 0, y: 8, scale: 0.88 }}
      transition={springSoft}
      className={cn(
        "absolute -translate-x-1/2",
        isSelf && onBoardPosChange ? "cursor-grab touch-none" : "cursor-pointer",
        dragging && "cursor-grabbing z-30",
      )}
      style={{
        left: `${leftPct}%`,
        bottom: `${liveBottomPct}%`,
        zIndex: dragging ? 30 : zIndex,
        width: dessertPx,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      aria-label={ariaLabel}
    >
      {/* Scoop sits on the slab; captions overlay the apron below the contact. */}
      <div className="relative flex w-full flex-col items-center">
        <div
          className="relative flex aspect-square w-full items-end justify-center overflow-visible"
          title={isSelf ? t("melt.room.dragHint") : config.displayName}
        >
          <MeltScene
            config={config}
            progress={progress}
            size={sceneSize}
            animated={sceneAnimated}
            className="!h-full !w-full !max-h-full !max-w-full pointer-events-none"
          />
        </div>
        <div
          className="pointer-events-none absolute top-full left-1/2 mt-0.5 -translate-x-1/2 text-center"
          style={{ width: Math.max(dessertPx, 72), maxWidth: dessertPx * 1.15 }}
        >
          <div className="relative h-[1.1em] overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={springSoft}
                className="truncate text-[10px] font-medium leading-tight text-zinc-800 dark:text-zinc-100 sm:text-[11px]"
              >
                {label}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="font-mono text-[10px] tabular-nums text-zinc-600 dark:text-zinc-300 sm:text-[11px]">
            {formatMs(clock.displayMs)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/** Shared dessert table inside the room timer outline — side profile, no empty seats. */
export function RoomMeltTable({
  members,
  selfUserId,
  selfLive = null,
  className,
  onBoardPosChange,
}: {
  members: RoomMeltMember[];
  selfUserId: string | null;
  /** Local session clock — bypasses presence lag for the current user. */
  selfLive?: SelfLiveClock | null;
  className?: string;
  /** Own dessert was placed; parent syncs presence + DB. */
  onBoardPosChange?: (x: number, z: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const now = useNow(50);
  const melting = sortMeltingMembers(members);
  const meltingCount = melting.length;
  // Chrome is the bottom slice of the stage; tabletop sits partway up that slice.
  const chromeHeightFrac = 1 / (1 + STAGE_HEADROOM_RATIO);
  const dessertPx = dessertWidthPx(stageSize.w, stageSize.h, meltingCount || 1);
  const chromeWidth = Math.min(
    stageSize.w > 0 ? stageSize.w : 320,
    tableChromeWidthPx(dessertPx, meltingCount || 1),
  );
  // Compact chrome height: short legs + headroom sized for scoops.
  const chromeHeightPx = Math.max(
    56,
    Math.min(
      stageSize.h > 0 ? stageSize.h * chromeHeightFrac : 120,
      dessertPx * 0.72 + 40,
    ),
  );
  /** Scoop hangs above the slab; wrapper includes caption room below contact. */
  const scoopOverhangPx = Math.round(dessertPx * 0.92);
  const captionPadPx = 36;
  const boardHeightPx = chromeHeightPx + scoopOverhangPx + captionPadPx;
  /** Contact line as % from bottom of the board wrapper (chrome sits at bottom). */
  const tabletopFromBottomPct =
    (chromeHeightPx / boardHeightPx) * TABLETOP_BOTTOM_PCT;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const w = box.width;
      const h = box.height;
      setStageSize((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5
          ? prev
          : { w, h },
      );
    });
    ro.observe(el);
    setStageSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        className,
      )}
    >
      {/* Compact table+scoops; intrinsic height so LOCK IN can scroll into view. */}
      <div
        ref={stageRef}
        className="relative mx-auto flex min-h-[10rem] w-full min-w-0 items-center justify-center overflow-visible sm:min-h-[12rem]"
      >
        <div
          className="relative"
          style={{
            width: chromeWidth > 0 ? chromeWidth : "100%",
            height: boardHeightPx,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <div
            ref={chromeRef}
            className="absolute inset-x-0 bottom-0 mx-auto w-full"
            style={{
              height: chromeHeightPx,
              maxWidth: "100%",
            }}
          >
            <SideTableChrome className="absolute inset-0" />
          </div>

          <AnimatePresence mode="popLayout">
            {melting.map((member, index) => (
              <DessertOnTable
                key={member.userId}
                member={member}
                selfUserId={selfUserId}
                selfLive={selfLive}
                now={now}
                meltingCount={meltingCount}
                index={index}
                total={meltingCount}
                tableRef={chromeRef}
                dessertPx={dessertPx}
                tabletopFromBottomPct={tabletopFromBottomPct}
                onBoardPosChange={
                  member.userId === selfUserId ? onBoardPosChange : undefined
                }
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
