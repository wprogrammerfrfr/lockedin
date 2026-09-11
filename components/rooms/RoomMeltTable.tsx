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
/** Tabletop contact as % from bottom of the chrome box (front lip y=48 → ~60%). */
const TABLETOP_BOTTOM_PCT = 58;
/** Extra stage height above the chrome for scoop/topping headroom. */
const STAGE_HEADROOM_RATIO = 0.22;

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

/** Dessert footprint as % of table width — never viewport units. */
function dessertWidthPx(tableWidth: number): number {
  if (tableWidth <= 0) return 56;
  const pct = tableWidth * 0.2;
  return Math.min(104, Math.max(52, pct));
}

/** Flat 2D table slab (top face + apron + legs) — no perspective polygons. */
function SideTableChrome({ className }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none h-full w-full", className)}
      viewBox="0 0 320 120"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Legs under slab so joins stay clean */}
      <rect x="28" y="62" width="10" height="50" fill="#9CA3AF" />
      <rect x="282" y="62" width="10" height="50" fill="#9CA3AF" />
      {/* Front lip */}
      <rect x="12" y="48" width="296" height="14" fill="#D1D5DB" />
      {/* Top surface */}
      <rect x="12" y="32" width="296" height="18" rx="6" fill="#E5E7EB" />
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
  tableWidth,
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
  tableWidth: number;
  onBoardPosChange?: (x: number, z: number) => void;
}) {
  const { t } = useTranslation();
  const isSelf = member.userId === selfUserId;
  const config = member.meltConfig!;
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; z: number } | null>(null);
  const dragPosRef = useRef<{ x: number; z: number } | null>(null);
  const lastEmitRef = useRef(0);

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
  const widthPx = dessertWidthPx(tableWidth);
  const chromeHeightFrac = 1 / (1 + STAGE_HEADROOM_RATIO);
  const liveBottomPct =
    chromeHeightFrac * (TABLETOP_BOTTOM_PCT + clamp01(z) * 4);

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
    if (!dragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const finalPos = dragPosRef.current ?? { x: baseX, z: baseZ };
    setDragging(false);
    onBoardPosChange?.(finalPos.x, finalPos.z);
  };

  const caption = t("melt.room.placeCaption", {
    username: member.username,
    dessert: config.displayName,
  });

  // Self always animated; others get FX when ≤2 desserts; md LOD for 1–2.
  const sceneAnimated = isSelf || meltingCount <= 2;
  const sceneSize = meltingCount <= 2 ? "md" : "sm";

  return (
    <motion.div
      layout={!dragging}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale }}
      exit={{ opacity: 0, y: 8, scale: 0.88 }}
      transition={springSoft}
      className={cn(
        "absolute -translate-x-1/2",
        isSelf && onBoardPosChange && "cursor-grab touch-none",
        dragging && "cursor-grabbing z-30",
      )}
      style={{
        left: `${leftPct}%`,
        bottom: `${liveBottomPct}%`,
        zIndex: dragging ? 30 : zIndex,
        width: widthPx,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Scoop sits on the slab; captions overlay the apron below the contact. */}
      <div className="relative flex w-full flex-col items-center">
        <div
          className="relative flex aspect-square w-full items-end justify-center overflow-visible"
          title={isSelf ? t("melt.room.dragHint") : undefined}
        >
          <MeltScene
            config={config}
            progress={progress}
            size={sceneSize}
            animated={sceneAnimated}
            className="!h-full !w-full !max-h-full !max-w-full pointer-events-none"
          />
        </div>
        <div className="pointer-events-none absolute top-full left-1/2 mt-0.5 w-[max(100%,7rem)] -translate-x-1/2 text-center">
          <p className="truncate text-[9px] font-medium leading-tight text-foreground sm:text-[10px]">
            {caption}
          </p>
          <p className="font-mono text-[9px] tabular-nums text-muted-foreground">
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
  const { t } = useTranslation();
  const stageRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const now = useNow(50);
  const melting = sortMeltingMembers(members);
  const meltingCount = melting.length;
  // Chrome is the bottom slice of the stage; tabletop sits partway up that slice.
  const chromeHeightFrac = 1 / (1 + STAGE_HEADROOM_RATIO);

  useEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setTableWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    });
    ro.observe(el);
    setTableWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col",
        className,
      )}
    >
      <p className="mb-1 shrink-0 text-center text-[9px] tracking-[0.14em] text-muted-foreground uppercase sm:text-[10px]">
        {t("melt.room.boardTitle")}
      </p>

      {/* Stage includes scoop headroom above the chrome so tops stay inside the box. */}
      <div
        ref={stageRef}
        className="relative mx-auto min-h-[10rem] w-full min-w-0 flex-1 overflow-visible sm:min-h-[12rem]"
      >
        <div
          ref={chromeRef}
          className="absolute inset-x-0 bottom-0 mx-auto w-full"
          style={{
            height: `${chromeHeightFrac * 100}%`,
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
              tableWidth={tableWidth}
              onBoardPosChange={
                member.userId === selfUserId ? onBoardPosChange : undefined
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
