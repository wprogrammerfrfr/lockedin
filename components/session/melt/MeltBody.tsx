"use client";

import type { ReactNode } from "react";
import type { Scoop } from "@/features/session/melt-soft-serve";
import {
  scoopDomePath,
  scoopDomePathSoft,
  scoopSquigglePaths,
} from "@/features/session/melt-soft-serve";
import type { IcePileCube } from "@/features/session/melt-cavity";
import type { IceShapeId } from "@/features/session/melt-catalog";
import {
  iceUnitPose,
  layerPose,
  type MeltPose,
} from "@/components/session/melt/MeltInterpolation";
import { seededRange } from "@/features/session/melt-seed";
import {
  cubeInnerContourPath,
  getCubeGeometry,
  ICE_FILL,
  ICE_HILITE,
  ICE_OUTLINE,
  ICE_SHADE,
  VECTOR_STROKE_CREASE,
} from "@/features/session/melt-ice-art";

function darken(hex: string, amount = 0.15) {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, parseInt(n.slice(0, 2), 16) * (1 - amount));
  const g = Math.max(0, parseInt(n.slice(2, 4), 16) * (1 - amount));
  const b = Math.max(0, parseInt(n.slice(4, 6), 16) * (1 - amount));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function lighten(hex: string, amount = 0.15) {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.min(255, parseInt(n.slice(0, 2), 16) * (1 + amount));
  const g = Math.min(255, parseInt(n.slice(2, 4), 16) * (1 + amount));
  const b = Math.min(255, parseInt(n.slice(4, 6), 16) * (1 + amount));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function PaintedScoop({
  scoop,
  color,
  outline,
  isBottom,
  shallow,
  seed,
  index,
  flavorId,
}: {
  scoop: Scoop;
  color: string;
  outline: string;
  isBottom: boolean;
  shallow: boolean;
  /** @deprecated Gloss highlights removed — kept for call-site compat. */
  sheen?: number;
  seed: string;
  index: number;
  flavorId?: string;
}) {
  const r = scoop.r * seededRange(seed, 50 + index, 0.94, 1.05);
  const dome = isBottom
    ? scoopDomePathSoft(scoop.cx, scoop.seatY, r, shallow, seed, index)
    : scoopDomePath(scoop.cx, scoop.seatY, r, seed, index);
  const gradId = `scoop-paint-${index}-${Math.round(scoop.cx)}`;
  const flavorBoost =
    flavorId === "chocolate"
      ? 0.08
      : flavorId === "vanilla"
        ? -0.04
        : 0;

  return (
    <g>
      <defs>
        <radialGradient
          id={gradId}
          cx={scoop.cx - r * 0.32}
          cy={scoop.seatY - r * 0.42}
          r={r * 1.35}
          gradientUnits="userSpaceOnUse"
        >
          {/* Matte fill — no hot glossy center */}
          <stop offset="0%" stopColor={lighten(color, 0.08 - flavorBoost)} />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor={darken(color, 0.18 + flavorBoost)} />
        </radialGradient>
        <clipPath id={`${gradId}-clip`}>
          <path d={dome} />
        </clipPath>
      </defs>
      <path d={dome} fill={`url(#${gradId})`} stroke="none" />
      {/* Soft painted edge — not a sticker outline */}
      <path
        d={dome}
        fill="none"
        stroke={outline}
        strokeWidth={1.1}
        strokeLinejoin="round"
        opacity={0.22}
      />
      {/* Simple horizontal scoop-mark squiggles */}
      <g
        clipPath={`url(#${gradId}-clip)`}
        stroke={outline}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {scoopSquigglePaths(scoop.cx, scoop.seatY, r, 3).map((d, i) => (
          <path key={i} d={d} strokeWidth={0.9} opacity={0.22} />
        ))}
      </g>
    </g>
  );
}

export function MeltScoopStack({
  scoops,
  layerCount,
  progress,
  color,
  outline,
  shallowBelly,
  sheen,
  seed,
  flavorId,
  mouthClipId,
  children,
}: {
  scoops: Scoop[];
  layerCount: number;
  progress: number;
  color: string;
  outline: string;
  shallowBelly: boolean;
  sheen: number;
  seed: string;
  flavorId?: string;
  /** Clip only the bottom scoop (belly in vessel); upper scoops stay unclipped so domes aren't sheared. */
  mouthClipId?: string;
  children?: ReactNode;
}) {
  const topLayer = scoops[scoops.length - 1]?.layer;

  return (
    <g>
      {scoops.map((scoop, i) => {
        const pose = layerPose(scoop.layer, layerCount, progress);
        if (pose.opacity <= 0) return null;
        const tilt = (scoop.tilt ?? 0) + seededRange(seed, 60 + i, -1.8, 1.8);
        const oy = scoop.seatY;
        const sagY = scoop.seatY + pose.sagY;
        const isTop = scoop.layer === topLayer;
        const isBottom = i === 0;
        const scoopEl = (
          <g
            opacity={pose.opacity}
            transform={`translate(${scoop.cx}, ${oy}) rotate(${tilt}) scale(${pose.scaleX}, ${pose.scaleY}) translate(${-scoop.cx}, ${-oy}) translate(0, ${sagY - oy})`}
          >
            <PaintedScoop
              scoop={scoop}
              color={color}
              outline={outline}
              isBottom={isBottom}
              shallow={shallowBelly}
              sheen={sheen}
              seed={seed}
              index={i}
              flavorId={flavorId}
            />
            {isTop ? children : null}
          </g>
        );
        // Bottom scoop belly must stay inside waffle/cup; upper domes must not hit vertical clip walls.
        if (isBottom && mouthClipId) {
          return (
            <g key={scoop.layer} clipPath={`url(#${mouthClipId})`}>
              {scoopEl}
            </g>
          );
        }
        return (
          <g key={scoop.layer}>
            {scoopEl}
          </g>
        );
      })}
    </g>
  );
}

export function MeltInteriorFill({
  fillPath,
  color,
  cavityFloorY,
  cx,
  progress,
  layerCount,
}: {
  fillPath: string;
  color: string;
  cavityFloorY: number;
  cx: number;
  progress: number;
  layerCount: number;
  /** @deprecated Gloss highlights removed — kept for call-site compat. */
  sheen?: number;
}) {
  const pose = layerPose(0, layerCount, progress);
  if (pose.opacity <= 0) return null;
  const gradId = `interior-paint-${Math.round(cx)}`;
  return (
    <g
      opacity={pose.opacity}
      transform={`translate(${cx}, ${cavityFloorY}) scale(1, ${pose.scaleY}) translate(${-cx}, ${-cavityFloorY})`}
    >
      <defs>
        <linearGradient id={gradId} x1={cx} y1={cavityFloorY - 50} x2={cx} y2={cavityFloorY} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={lighten(color, 0.1)} />
          <stop offset="100%" stopColor={darken(color, 0.25)} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
    </g>
  );
}

const ICE_V2 = {
  fill: ICE_FILL,
  shade: ICE_SHADE,
  edge: ICE_OUTLINE,
} as const;

function IceUnit({
  cube,
  shape,
  progress,
  pileFloorY,
  sheen,
  phaseJitter,
  detail,
}: {
  cube: IcePileCube;
  shape: IceShapeId;
  progress: number;
  pileFloorY: number;
  sheen: number;
  phaseJitter: number;
  detail: boolean;
}) {
  const local = Math.min(1, Math.max(0, progress + phaseJitter));
  const depth = cube.depth ?? 1;
  const depthOpacity = depth === 0 ? 0.95 : depth === 1 ? 0.98 : 1;
  // Packer already applies depth size — only a tiny residual here.
  const depthScale = depth === 0 ? 0.98 : depth === 2 ? 1.02 : 1;
  const pose = iceUnitPose({
    local,
    settleY: cube.settleY,
    y: cube.y,
    depthScale,
    sheen,
    depthOpacity,
    globalProgress: progress,
  });

  // Fully melted: unmount only at exact end (thumbnails / complete).
  if (pose.melt >= 1 && pose.opacity <= 0) return null;

  const halfW = cube.halfW ?? 8;
  const halfH = cube.halfH ?? 8;
  const { x, rotate = 0 } = cube;
  const fill = ICE_V2.fill;
  const edgeOpacity = depth === 0 ? 0.9 : depth === 2 ? 1 : 0.95;
  const hiOpacity = 0.75 * (0.72 + sheen * 0.28);
  const geometryCube = getCubeGeometry(halfW, halfH);

  // Always use a real SVG transform attribute. Framer motion.g scale/y
  // escapes SVG user space and cubes miss iceInteriorClipPath in the hero.
  return (
    <g
      opacity={pose.opacity}
      transform={`translate(${x}, ${pileFloorY}) scale(${pose.scaleX}, ${pose.scaleY}) translate(${-x}, ${-pileFloorY}) translate(${x}, ${pose.y}) rotate(${rotate})`}
    >
      {shape === "sphere" ? (
        <>
          <ellipse cx={0} cy={0} rx={halfW} ry={halfH} fill={fill} />
          <ellipse
            cx={0}
            cy={0}
            rx={halfW * 0.92}
            ry={halfH * 0.92}
            fill="none"
            stroke={ICE_V2.edge}
            strokeWidth={1.3}
            opacity={edgeOpacity}
          />
          <ellipse
            cx={-halfW * 0.32}
            cy={-halfH * 0.36}
            rx={halfW * 0.26}
            ry={halfH * 0.16}
            fill="#FFFFFF"
            opacity={hiOpacity}
          />
          {detail && depth !== 0 ? (
            <ellipse
              cx={halfW * 0.2}
              cy={halfH * 0.22}
              rx={halfW * 0.35}
              ry={halfH * 0.22}
              fill={ICE_V2.shade}
              opacity={0.36}
            />
          ) : null}
        </>
      ) : (
        <>
          <rect
            x={-halfW}
            y={-halfH}
            width={halfW * 2}
            height={halfH * 2}
            rx={geometryCube.rx}
            fill={fill}
          />
          <rect
            x={-halfW}
            y={-halfH}
            width={halfW * 2}
            height={halfH * 2}
            rx={geometryCube.rx}
            fill="none"
            stroke={ICE_V2.edge}
            strokeWidth={VECTOR_STROKE_CREASE}
            opacity={edgeOpacity}
          />
          <path
            d={cubeInnerContourPath(geometryCube)}
            fill="none"
            stroke={ICE_V2.shade}
            strokeWidth={Math.max(1.2, halfW * 0.17)}
            strokeLinecap="round"
            opacity={0.58}
          />
          <rect
            x={geometryCube.highlight.x}
            y={geometryCube.highlight.y}
            width={geometryCube.highlight.w}
            height={geometryCube.highlight.h}
            rx={geometryCube.highlight.h / 2}
            fill={ICE_HILITE}
            opacity={hiOpacity}
            transform={`rotate(-18 ${geometryCube.highlight.x + geometryCube.highlight.w / 2} ${geometryCube.highlight.y + geometryCube.highlight.h / 2})`}
          />
        </>
      )}
    </g>
  );
}

export function MeltIcePile({
  cubes,
  shape,
  progress,
  sheen,
  seed,
  maxCubes,
  detail = true,
}: {
  cubes: IcePileCube[];
  shape: IceShapeId;
  progress: number;
  sheen: number;
  seed: string;
  maxCubes: number;
  detail?: boolean;
  /** @deprecated Progress ticks drive melt; kept for call-site compat. */
  animated?: boolean;
}) {
  // Packer already respects maxCubes — slice is a safety backstop only.
  const visible = cubes.length <= maxCubes ? cubes : cubes.slice(0, maxCubes);
  const pileFloorY =
    visible.length === 0
      ? 164
      : Math.max(...visible.map((c) => c.y + (c.halfH ?? 8)));

  return (
    <g>
      {visible.map((cube, i) => (
        <IceUnit
          key={cube.index}
          cube={cube}
          shape={shape}
          progress={progress}
          pileFloorY={pileFloorY}
          sheen={sheen}
          phaseJitter={seededRange(seed, 100 + i, -0.07, 0.07)}
          detail={detail}
        />
      ))}
    </g>
  );
}

export type { MeltPose };
