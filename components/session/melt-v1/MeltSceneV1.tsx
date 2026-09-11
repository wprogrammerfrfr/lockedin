"use client";

import type { ReactNode } from "react";
import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type {
  IceCreamToppingId,
  IceShapeId,
  MeltConfig,
} from "@/features/session/melt-catalog";
import { getFlavorOption } from "@/features/session/melt-catalog";
import {
  layerMeltLocal,
  meltStageEffects,
  meltStageFromProgress,
} from "@/features/session/melt-utils";
import {
  buildSoftServeProfile,
  scoopCreasePath,
  scoopDomeArc,
  scoopDomeArcTop,
  scoopDomePath,
  scoopDomePathSoft,
  scoopScallopSeamPath,
  type Scoop,
  type SoftServeProfile,
} from "@/features/session/melt-soft-serve";
import {
  buildIcePile,
  getCavity,
  getInsetCavity,
  getInteriorHalfWidthAtY,
  interiorCenterX,
  interiorEdgesAt,
  innerClipPath,
  innerWallShadePath,
  liquidLevelFromMass,
  mouthEllipseClipPath,
  mouthOpeningCenterX,
  packedFillPath,
  scoopContactShadePath,
  sortCubesForRender,
  type ContainerCavity,
  type IcePileCube,
} from "@/features/session/melt-cavity";
import {
  alternateShapePath,
  getCubeGeometry,
  ICE_FILL,
  ICE_HILITE,
  ICE_OUTLINE,
  ICE_SHADE,
  VECTOR_STROKE,
  VECTOR_STROKE_CREASE,
  type CubeGeometry,
} from "@/features/session/melt-ice-art";
import { springSoft } from "@/components/session/state-accent";
import { cn } from "@/lib/utils";

const SCENE_VIEWBOX = "4 30 192 176";

type MeltSceneSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<MeltSceneSize, string> = {
  sm: "h-24 w-24 sm:h-28 sm:w-28",
  md: "h-48 w-48 sm:h-56 sm:w-56 md:h-64 md:w-64",
  lg: "h-64 w-64 sm:h-72 sm:w-72 md:h-80 md:w-80",
};

const MELT_EASE = { duration: 0.85, ease: "easeOut" as const };
const PROGRESS_RING_CIRC = 289;

/* ── Shared visual tokens (Phase 3) ── */
const GLASS_FILL = "rgba(200,220,235,0.22)";
const GLASS_STROKE = "#8FA8BC";
const GLASS_SHEEN = "rgba(255,255,255,0.45)";
const RIM_FILL = "rgba(232,238,244,0.55)";
const RIM_STROKE = "#C8D4DE";
const PAPER_FILL = "#F6EFE4";
const PAPER_STROKE = "#D4C4A8";
const PAPER_BAND = "#E8DDD0";
const WAFFLE_LINE = "#C4956A";
const WAFFLE_EDGE = "#A9702F";
const WAFFLE_FILL = "#E8B86D";
const PAPER_SHADE = "rgba(120,100,72,0.16)";
/** Cooler glass tint for the ice bucket (still see-through). */
const BUCKET_GLASS_FILL = "rgba(210,228,238,0.14)";

type MeltSceneProps = {
  config: MeltConfig;
  progress: number;
  compact?: boolean;
  size?: MeltSceneSize;
  className?: string;
  ariaLabel?: string;
  popKey?: number;
  animated?: boolean;
};

function easeOutCubic(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return 1 - (1 - p) ** 3;
}

function lerpKeyframes(
  keys: [number, number, number, number],
  t: number,
): number {
  const seg = t * 3;
  const i = Math.min(2, Math.floor(seg));
  const f = seg - i;
  return keys[i]! + (keys[i + 1]! - keys[i]!) * f;
}

/** Rotate/scale around (x, originY), then sag vertically by (y - originY). */
function svgTransform(
  x: number,
  y: number,
  rotate: number,
  scaleX: number,
  scaleY: number,
  originY?: number,
): string {
  const oy = originY ?? y;
  // Last translate is sag-only — never re-apply x (that shoved scoops off-screen).
  return `translate(${x}, ${oy}) rotate(${rotate}) scale(${scaleX}, ${scaleY}) translate(${-x}, ${-oy}) translate(0, ${y - oy})`;
}

function Condensation({
  cavity,
  intensity,
  animated,
}: {
  cavity: ContainerCavity;
  intensity: number;
  animated: boolean;
}) {
  if (!cavity.hasGlass) return null;
  const inset = getInsetCavity(cavity);
  const wallY = inset.rimY + 6;
  const { left, right } = interiorEdgesAt(inset, wallY);
  const xs = [0.2, 0.4, 0.55, 0.7, 0.85].map((t) => left + (right - left) * t);

  return (
    <g opacity={0.15 + intensity * 0.3}>
      {xs.map((x, i) => (
        <motion.ellipse
          key={i}
          cx={x}
          cy={wallY + (i % 2) * 5}
          rx={2}
          ry={3.5}
          fill="#93C5FD"
          animate={
            animated
              ? {
                  cy: [
                    wallY + (i % 2) * 5,
                    wallY + (i % 2) * 5 + 5,
                    wallY + (i % 2) * 5,
                  ],
                }
              : undefined
          }
          transition={
            animated
              ? { duration: 2.4 + i * 0.25, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
        />
      ))}
    </g>
  );
}

function LiquidFill({
  cavity,
  progress,
  color,
  opacity = 0.55,
  animated,
  meltedFraction,
}: {
  cavity: ContainerCavity;
  progress: number;
  color: string;
  opacity?: number;
  animated: boolean;
  meltedFraction?: number;
}) {
  const fill = meltedFraction ?? progress;
  if (fill <= 0.02) return null;

  const inset = getInsetCavity(cavity);
  const levelY = liquidLevelFromMass(inset, fill);
  const { left, right } = interiorEdgesAt(inset, levelY);
  const cx = (left + right) / 2;
  const rx = (right - left) / 2 - 2;

  return (
    <g>
      <rect
        x={left + 1}
        y={levelY}
        width={right - left - 2}
        height={inset.floorY - levelY + 4}
        fill={color}
        opacity={opacity}
      />
      <motion.ellipse
        cx={cx}
        cy={levelY}
        rx={Math.max(4, rx)}
        ry={4}
        fill={color}
        opacity={opacity + 0.1}
        animate={
          animated ? { ry: [3.5, 5, 3.5], cx: [cx - 1, cx + 1, cx - 1] } : undefined
        }
        transition={
          animated
            ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
            : MELT_EASE
        }
      />
    </g>
  );
}

function ExteriorPuddle({
  progress,
  color,
  cavity,
  poolIntensity,
}: {
  progress: number;
  color: string;
  cavity: ContainerCavity;
  poolIntensity: number;
}) {
  if (poolIntensity <= 0.05) return null;
  const p = easeOutCubic(poolIntensity);
  const cx = interiorCenterX(cavity, cavity.floorY);
  const scaleX = (8 + p * 28) / 8;
  const scaleY = (3 + p * 10) / 3;

  return (
    <motion.ellipse
      cx={cx}
      cy={cavity.floorY + 8}
      rx={8}
      ry={3}
      fill={color}
      transform={`translate(${cx}, ${cavity.floorY + 8}) scale(${scaleX}, ${scaleY}) translate(${-cx}, ${-(cavity.floorY + 8)})`}
      initial={{ opacity: 0.3 }}
      animate={{ opacity: 0.3 + p * 0.45 }}
      transition={MELT_EASE}
    />
  );
}

function OpenContainerDrips({
  progress,
  color,
  cavity,
  animated,
  dripIntensity,
}: {
  progress: number;
  color: string;
  cavity: ContainerCavity;
  animated: boolean;
  dripIntensity: number;
}) {
  if (dripIntensity <= 0.05) return null;
  const dripLen = easeOutCubic(dripIntensity) * 42;
  const cx = interiorCenterX(cavity, cavity.rimY);

  return (
    <g>
      <path
        d={`M ${cx - 6} ${cavity.rimY + 4} Q ${cx - 8} ${cavity.rimY + dripLen * 0.5} ${cx - 4} ${cavity.rimY + dripLen}`}
        fill="none"
        stroke={color}
        strokeWidth={VECTOR_STROKE + 1}
        strokeLinecap="round"
        opacity={0.65}
      />
      <path
        d={`M ${cx + 6} ${cavity.rimY + 6} Q ${cx + 10} ${cavity.rimY + dripLen * 0.55} ${cx + 5} ${cavity.rimY + dripLen + 4}`}
        fill="none"
        stroke={color}
        strokeWidth={VECTOR_STROKE}
        strokeLinecap="round"
        opacity={0.5}
      />
      {cavity.isOpen && progress > 0.2 ? (
        <path
          d={`M ${cavity.rimLeft + 8} ${cavity.rimY + 2} L ${cavity.floorLeft + 2} ${cavity.floorY - 4}`}
          fill="none"
          stroke="#C4956A"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.12 + progress * 0.18}
        />
      ) : null}
      {animated && dripIntensity > 0.4 ? (
        <motion.circle
          cx={cx}
          cy={cavity.rimY + dripLen + 6}
          r={2.5}
          fill={color}
          animate={{ cy: [cavity.rimY + dripLen + 6, cavity.floorY + 4], opacity: [0.8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeIn" }}
        />
      ) : null}
    </g>
  );
}

function darken(hex: string, amount = 0.15) {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, parseInt(n.slice(0, 2), 16) * (1 - amount));
  const g = Math.max(0, parseInt(n.slice(2, 4), 16) * (1 - amount));
  const b = Math.max(0, parseInt(n.slice(4, 6), 16) * (1 - amount));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function lighten(hex: string, amount = 0.15) {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.min(255, parseInt(n.slice(0, 2), 16) * (1 + amount));
  const g = Math.min(255, parseInt(n.slice(2, 4), 16) * (1 + amount));
  const b = Math.min(255, parseInt(n.slice(4, 6), 16) * (1 + amount));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function layerMelt(layer: number, total: number, progress: number, _sheen: number) {
  const local = layerMeltLocal(layer, total, progress);
  const scaleY = 1 - local * 0.95;
  const scaleX = 1 - local * 0.35;
  // Stay fully opaque until the layer melts — sheen is for highlights only.
  return {
    scaleX,
    scaleY,
    opacity: local >= 1 ? 0 : 1 - local,
    local,
  };
}

/** Shared cream grain — soft-light overlay clipped by path fill. */
function ScoopGrainFilter({ id }: { id: string }) {
  return (
    <filter
      id={id}
      x="-15%"
      y="-15%"
      width="130%"
      height="130%"
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="1.05"
        numOctaves={3}
        seed={4}
        stitchTiles="stitch"
        result="noise"
      />
      <feColorMatrix
        in="noise"
        type="matrix"
        values="0 0 0 0 0.12  0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0.7 0"
        result="grain"
      />
      <feComposite in="grain" in2="SourceGraphic" operator="in" />
    </filter>
  );
}

/**
 * Volume gradient + grain + soft seam + highlight for every scoop.
 * Bottom scoops keep a rounded overhang blob (no flat rim T-bar).
 */
function ScoopSurface({
  scoop,
  color,
  outline,
  sheen,
  isTop,
  isBottom,
  hasInteriorFill,
  shallowBelly,
  grainFilterId,
  gradientId,
}: {
  scoop: Scoop;
  color: string;
  outline: string;
  sheen: number;
  isTop: boolean;
  isBottom: boolean;
  hasInteriorFill: boolean;
  shallowBelly: boolean;
  grainFilterId: string;
  gradientId: string;
}) {
  const useScallop = isTop && !isBottom;
  const dome = useScallop
    ? scoopDomePath(scoop.cx, scoop.seatY, scoop.r)
    : scoopDomePathSoft(scoop.cx, scoop.seatY, scoop.r, shallowBelly && isBottom);
  // Outline only the upper dome — never stroke the seated belly / scallop cut.
  const strokePath = useScallop
    ? scoopDomeArcTop(scoop.cx, scoop.seatY, scoop.r)
    : scoopDomeArc(scoop.cx, scoop.seatY, scoop.r);
  const hiX = scoop.cx - scoop.r * 0.38;
  const hiY = scoop.seatY - scoop.r * 0.48;
  // Single scoop over packed fill: skip the hard crease seam.
  const showCrease = isTop && !(isBottom && hasInteriorFill);
  const creaseOpacity = useScallop ? 0.22 : 0.16;

  return (
    <g>
      <defs>
        <radialGradient
          id={gradientId}
          cx={scoop.cx - scoop.r * 0.28}
          cy={scoop.seatY - scoop.r * 0.42}
          r={scoop.r * 1.35}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={lighten(color, 0.28)} />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor={darken(color, 0.2)} />
        </radialGradient>
      </defs>
      <path d={dome} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={dome}
        fill={darken(color, 0.35)}
        filter={`url(#${grainFilterId})`}
        opacity={0.45}
        style={{ mixBlendMode: "multiply" }}
      />
      <path
        d={strokePath}
        fill="none"
        stroke={outline}
        strokeWidth={VECTOR_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
      {useScallop ? (
        <path
          d={scoopScallopSeamPath(scoop.cx, scoop.seatY, scoop.r)}
          fill="none"
          stroke={outline}
          strokeWidth={VECTOR_STROKE_CREASE}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.2}
        />
      ) : null}
      {showCrease ? (
        <path
          d={scoopCreasePath(scoop.cx, scoop.seatY, scoop.r)}
          fill="none"
          stroke={outline}
          strokeWidth={VECTOR_STROKE_CREASE}
          strokeLinecap="round"
          opacity={creaseOpacity}
        />
      ) : null}
      <ellipse
        cx={hiX}
        cy={hiY}
        rx={scoop.r * 0.26}
        ry={scoop.r * 0.15}
        fill="#FFFFFF"
        opacity={(isTop ? 0.55 : 0.38) * sheen}
        transform={`rotate(-28 ${hiX} ${hiY})`}
      />
    </g>
  );
}

function ScoopStack({
  profile,
  color,
  outline,
  progress,
  sheen,
  toppings,
  cavity,
  grainFilterId,
  idPrefix,
}: {
  profile: SoftServeProfile;
  color: string;
  outline: string;
  progress: number;
  sheen: number;
  toppings: IceCreamToppingId[];
  cavity: ContainerCavity;
  grainFilterId: string;
  idPrefix: string;
}) {
  const topLayer = profile.scoops[profile.scoops.length - 1]?.layer;
  const bottomScoop = profile.scoops[0];
  const bottomLocal = bottomScoop
    ? layerMelt(bottomScoop.layer, profile.layerCount, progress, sheen).local
    : 1;

  return (
    <g>
      {/* Soft merge shade where the bottom scoop tucks into the rim. */}
      {bottomScoop && bottomLocal < 1 ? (
        <ScoopContactShade
          scoop={bottomScoop}
          rimY={cavity.rimY}
          color={color}
          cavity={cavity}
        />
      ) : null}
      {profile.scoops.map((scoop, i) => {
        const { scaleX, scaleY, opacity, local } = layerMelt(
          scoop.layer,
          profile.layerCount,
          progress,
          sheen,
        );
        const tilt = scoop.tilt ?? 0;
        const sagY = scoop.seatY + local * scoop.r * 0.12;
        const isTop = scoop.layer === topLayer;
        const isBottom = scoop.layer === bottomScoop?.layer;
        const below = i > 0 ? profile.scoops[i - 1] : null;
        const belowLocal = below
          ? layerMelt(below.layer, profile.layerCount, progress, sheen).local
          : 1;

        if (local >= 1) return null;

        return (
          <motion.g
            key={scoop.layer}
            opacity={opacity}
            transform={svgTransform(scoop.cx, sagY, tilt, scaleX, scaleY, scoop.seatY)}
          >
            {/* Soft nest shade where an upper scoop sinks into the one below. */}
            {below && belowLocal < 1 ? (
              <path
                d={scoopContactShadePath(
                  scoop.cx,
                  scoop.seatY + scoop.r * 0.04,
                  scoop.r * 0.78,
                  Math.max(3, scoop.r * 0.14),
                )}
                fill={darken(color, 0.35)}
                opacity={0.22}
              />
            ) : null}
            <ScoopSurface
              scoop={scoop}
              color={color}
              outline={outline}
              sheen={sheen}
              isTop={!!isTop}
              isBottom={!!isBottom}
              hasInteriorFill={profile.interiorFill}
              shallowBelly={!!cavity.isOpen}
              grainFilterId={grainFilterId}
              gradientId={`${idPrefix}-scoop-grad-${scoop.layer}`}
            />
            {isTop && toppings.length > 0 ? (
              <ToppingsLayer toppings={toppings} scoop={scoop} />
            ) : null}
          </motion.g>
        );
      })}
    </g>
  );
}

function InteriorFill({
  cavity,
  color,
  profile,
  progress,
  sheen,
  grainFilterId,
  gradientId,
}: {
  cavity: ContainerCavity;
  color: string;
  profile: SoftServeProfile;
  progress: number;
  sheen: number;
  grainFilterId: string;
  gradientId: string;
}) {
  const { scaleY, opacity } = layerMelt(0, profile.layerCount, progress, sheen);
  const inset = getInsetCavity(cavity, 1.15);
  const cx = interiorCenterX(inset, inset.rimY);
  const fillPath = packedFillPath(cavity);
  const scoop = profile.scoops[0];

  return (
    <g
      opacity={opacity}
      transform={`translate(${cx}, ${inset.floorY}) scale(1, ${scaleY}) translate(${-cx}, ${-inset.floorY})`}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1={cx}
          y1={cavity.rimY}
          x2={cx}
          y2={inset.floorY}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={darken(color, 0.22)} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <path
        d={fillPath}
        fill={darken(color, 0.35)}
        filter={`url(#${grainFilterId})`}
        opacity={0.4}
        style={{ mixBlendMode: "multiply" }}
      />
      {/* Soft blend where packed fill meets the nested scoop belly. */}
      {scoop ? (
        <path
          d={scoopContactShadePath(
            scoop.cx,
            Math.min(scoop.seatY, cavity.rimY + 2),
            scoop.r * 0.85,
            Math.max(3.5, scoop.r * 0.16),
          )}
          fill={darken(color, 0.28)}
          opacity={0.2}
        />
      ) : null}
    </g>
  );
}

function ToppingsLayer({
  toppings,
  scoop,
}: {
  toppings: IceCreamToppingId[];
  scoop: Scoop;
}) {
  // Flaw 5: live apex from the same scoop that owns this transform group.
  const cx = scoop.cx;
  const cy = scoop.seatY - scoop.r;
  const halfW = Math.max(10, scoop.r);

  return (
    <g>
      {toppings.includes("cherry") && (
        <g>
          <circle cx={cx + 14} cy={cy - 10} r={7} fill="#DC2626" />
          <circle cx={cx + 11} cy={cy - 13} r={2.5} fill="#FCA5A5" opacity={0.7} />
          <path
            d={`M ${cx + 14} ${cy - 17} Q ${cx + 18} ${cy - 24} ${cx + 22} ${cy - 22}`}
            stroke="#166534"
            strokeWidth={VECTOR_STROKE}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {toppings.includes("whipped_cream") && (
        <path
          d={`M ${cx - halfW * 0.7} ${cy + 2} Q ${cx - halfW * 0.35} ${cy - 10} ${cx} ${cy - 12} Q ${cx + halfW * 0.35} ${cy - 10} ${cx + halfW * 0.7} ${cy + 2} Q ${cx + halfW * 0.35} ${cy + 6} ${cx} ${cy + 7} Q ${cx - halfW * 0.35} ${cy + 6} ${cx - halfW * 0.7} ${cy + 2}`}
          fill="#FAFAFA"
          stroke="#E2E8F0"
          strokeWidth={VECTOR_STROKE}
          strokeLinecap="round"
        />
      )}
      {toppings.includes("chocolate_sauce") && (
        <path
          d={`M ${cx - halfW * 0.85} ${cy + 4} Q ${cx} ${cy + 12} ${cx + halfW * 0.85} ${cy + 4}`}
          fill="none"
          stroke="#5C4033"
          strokeWidth={4}
          strokeLinecap="round"
        />
      )}
      {toppings.includes("sprinkles") &&
        [
          { x: -12, y: 2, c: "#F472B6", rot: -20 },
          { x: -2, y: -2, c: "#60A5FA", rot: 15 },
          { x: 8, y: 4, c: "#FBBF24", rot: -8 },
          { x: 14, y: -4, c: "#34D399", rot: 22 },
          { x: 0, y: 10, c: "#FB7185", rot: 30 },
        ].map((s, i) => (
          <rect
            key={i}
            x={cx + s.x}
            y={cy + s.y}
            width={5}
            height={2}
            rx={0.5}
            fill={s.c}
            transform={`rotate(${s.rot} ${cx + s.x + 2.5} ${cy + s.y + 1})`}
          />
        ))}
      {toppings.includes("cookie_crumb") &&
        [
          { x: -10, y: 12, w: 8, h: 5 },
          { x: 8, y: 10, w: 7, h: 4 },
        ].map((c, i) => (
          <rect
            key={i}
            x={cx + c.x}
            y={cy + c.y}
            width={c.w}
            height={c.h}
            rx={1}
            fill="#92400E"
            transform={`rotate(${i * 18 - 10} ${cx + c.x + c.w / 2} ${cy + c.y + c.h / 2})`}
          />
        ))}
    </g>
  );
}

function ScoopContactShade({
  scoop,
  rimY,
  color,
  cavity,
}: {
  scoop: Scoop;
  rimY: number;
  color: string;
  cavity: ContainerCavity;
}) {
  const dy = scoop.seatY - rimY;
  const chord = Math.sqrt(Math.max(4, scoop.r * scoop.r - dy * dy));
  const rimHalf = getInteriorHalfWidthAtY(cavity, rimY);
  const rx = Math.min(chord * 1.08, rimHalf * 1.2, scoop.r * 0.95);
  return (
    <path
      d={scoopContactShadePath(
        mouthOpeningCenterX(cavity),
        rimY + 1.5,
        rx,
        Math.max(3.5, scoop.r * 0.14),
      )}
      fill={darken(color, 0.4)}
      opacity={0.26}
    />
  );
}

type ContainerParts = {
  back: ReactNode;
  front: ReactNode;
  clipId: string;
  innerClipPath: string;
  mouthInnerClipPath: string;
  mouthEllipseClipPath: string;
};

/**
 * Left/right rim hints that tuck under the scoop sides —
 * never a full bar or chunky tabs cutting through the ice cream.
 */
function RimLips({
  cavity,
  stroke,
}: {
  cavity: ContainerCavity;
  fill?: string;
  stroke: string;
  style?: "rect" | "glass" | "metal";
}) {
  const rimCy = cavity.rimY;
  const rx = (cavity.rimRight - cavity.rimLeft) / 2 + 2;
  const ry = 3.2;
  const cx = mouthOpeningCenterX(cavity);
  const gap = rx * 0.42;

  return (
    <g fill="none" stroke={stroke} strokeWidth={VECTOR_STROKE} strokeLinecap="round" opacity={0.9}>
      <path
        d={`M ${cavity.rimLeft - 1} ${rimCy + 1} A ${rx} ${ry} 0 0 1 ${cx - gap} ${rimCy - 0.5}`}
      />
      <path
        d={`M ${cx + gap} ${rimCy - 0.5} A ${rx} ${ry} 0 0 1 ${cavity.rimRight + 1} ${rimCy + 1}`}
      />
    </g>
  );
}

/** Back-of-mouth ellipse — sits behind contents so it never cuts the scoop/ice. */
function BackRim({
  cavity,
  fill,
  stroke,
}: {
  cavity: ContainerCavity;
  fill: string;
  stroke: string;
}) {
  const cx = mouthOpeningCenterX(cavity);
  const rx = (cavity.rimRight - cavity.rimLeft) / 2 + 1;
  return (
    <ellipse
      cx={cx}
      cy={cavity.rimY}
      rx={rx}
      ry={5}
      fill={fill}
      stroke={stroke}
      strokeWidth={VECTOR_STROKE}
    />
  );
}

function InnerWallShade({
  cavity,
  fill,
}: {
  cavity: ContainerCavity;
  fill: string;
}) {
  return <path d={innerWallShadePath(cavity)} fill={fill} />;
}

function WaffleHatch({
  uid,
  shape,
  top,
  bottom,
  left,
  right,
}: {
  uid: string;
  shape: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
}) {
  const step = 9;
  const height = bottom - top;
  const diagA: ReactNode[] = [];
  const diagB: ReactNode[] = [];
  let i = 0;
  for (let x = left - height; x <= right + height; x += step) {
    diagA.push(<line key={`a${i}`} x1={x} y1={top} x2={x + height} y2={bottom} />);
    diagB.push(<line key={`b${i}`} x1={x + height} y1={top} x2={x} y2={bottom} />);
    i++;
  }
  return (
    <>
      <defs>
        <clipPath id={uid}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid})`} stroke={WAFFLE_LINE} strokeWidth="1.2" opacity={0.65}>
        {diagA}
        {diagB}
      </g>
    </>
  );
}

function getContainerParts(
  containerId: string,
  kind: "iceCream" | "ice",
  uid: string,
  cavity: ContainerCavity,
): ContainerParts {
  const inner = innerClipPath(cavity);
  // Flaw 3: ice cream mouth clip is scaled so the scoop overhang is not sheared.
  const mouthScale = kind === "iceCream" ? 1.14 : 1;
  const mouthInner = innerClipPath(cavity);
  const mouthEllipse = mouthEllipseClipPath(
    cavity,
    containerId,
    undefined,
    mouthScale,
  );

  if (kind === "iceCream" && containerId === "cone") {
    const cone = "M 64 114 L 96 162 Q 100 170 104 162 L 136 114 Q 100 108 64 114 Z";
    // Hatch only the lower cone body — leave the rim zone clear for the scoop tuck.
    const waffleBody = "M 70 128 L 96 162 Q 100 170 104 162 L 130 128 Z";
    return {
      clipId: "cone-clip",
      innerClipPath: inner,
      mouthInnerClipPath: mouthInner,
      mouthEllipseClipPath: mouthEllipse,
      back: (
        <path
          d={cone}
          fill={WAFFLE_FILL}
          stroke={WAFFLE_EDGE}
          strokeWidth={VECTOR_STROKE}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ),
      front: (
        <>
          <WaffleHatch
            uid={`cone-waffle-${uid}`}
            shape={waffleBody}
            top={128}
            bottom={170}
            left={70}
            right={130}
          />
          {/* Rim lips tuck the scoop into the cone mouth. */}
          <RimLips cavity={cavity} stroke={WAFFLE_EDGE} style="rect" />
        </>
      ),
    };
  }

  if (kind === "iceCream" && containerId === "cup") {
    const cup = "M 68 110 L 78 164 Q 100 172 122 164 L 132 110 Z";
    return {
      clipId: "paper-cup-clip",
      innerClipPath: inner,
      mouthInnerClipPath: mouthInner,
      mouthEllipseClipPath: mouthEllipse,
      back: (
        <>
          <path d={cup} fill={PAPER_FILL} stroke={PAPER_STROKE} strokeWidth={VECTOR_STROKE} strokeLinejoin="round" strokeLinecap="round" />
          <InnerWallShade cavity={cavity} fill={PAPER_SHADE} />
          <path d="M 82 132 Q 100 138 118 132" fill="none" stroke={PAPER_BAND} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
        </>
      ),
      front: (
        <RimLips cavity={cavity} stroke={PAPER_STROKE} style="rect" />
      ),
    };
  }

  if (kind === "iceCream" && containerId === "sundae_glass") {
    const bowl = "M 80 110 L 86 150 Q 100 158 114 150 L 120 110 Z";
    // Loose inner clip so packed fill can hug the glass (not a white wall gap).
    const fillClip = innerClipPath(cavity, 1.0);
    return {
      clipId: "sundae-clip",
      innerClipPath: fillClip,
      mouthInnerClipPath: mouthInner,
      mouthEllipseClipPath: mouthEllipse,
      back: (
        <>
          <path d={bowl} fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth={VECTOR_STROKE} strokeLinejoin="round" strokeLinecap="round" />
          <path d="M 96.4 148 L 94 170 Q 100 174 106 170 L 103.6 148" fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth={VECTOR_STROKE} />
          <ellipse cx={100} cy={170} rx={14} ry={4.5} fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth={VECTOR_STROKE} />
          <BackRim cavity={cavity} fill={RIM_FILL} stroke={RIM_STROKE} />
          <path
            d={fillClip}
            fill="none"
            stroke={GLASS_STROKE}
            strokeWidth={1}
            opacity={0.35}
          />
        </>
      ),
      // Glass: no opaque side bands; rim as side lips so the scoop sits in the bowl.
      front: (
        <>
          <RimLips cavity={cavity} stroke={GLASS_STROKE} style="glass" />
          <path d="M 86 122 L 88 142" stroke={GLASS_SHEEN} strokeWidth={VECTOR_STROKE} opacity={0.45} strokeLinecap="round" />
        </>
      ),
    };
  }

  if (containerId === "ice_bucket") {
    const tub = "M 58 98 L 66 160 Q 100 170 134 160 L 142 98 Z";
    return {
      clipId: "bucket-clip",
      innerClipPath: inner,
      mouthInnerClipPath: mouthInner,
      mouthEllipseClipPath: mouthEllipse,
      back: (
        <>
          <path
            d={tub}
            fill={BUCKET_GLASS_FILL}
            stroke={GLASS_STROKE}
            strokeWidth={VECTOR_STROKE}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <BackRim cavity={cavity} fill={RIM_FILL} stroke={RIM_STROKE} />
          {/* Inner opening stroke so the mouth reads as a hole, not a wireframe. */}
          <path
            d={inner}
            fill="none"
            stroke={GLASS_STROKE}
            strokeWidth={1}
            opacity={0.4}
          />
        </>
      ),
      // See-through: rim + sheen only — no opaque bodyCover hiding the cube pile.
      front: (
        <>
          <RimLips cavity={cavity} stroke={GLASS_STROKE} style="glass" />
          <path
            d="M 70 118 L 72 148"
            stroke={GLASS_SHEEN}
            strokeWidth={VECTOR_STROKE}
            opacity={0.5}
            strokeLinecap="round"
          />
        </>
      ),
    };
  }

  if (containerId === "pitcher") {
    const jug = "M 72 100 L 78 158 Q 100 165 122 158 L 128 100 Z";
    return {
      clipId: "pitcher-clip",
      innerClipPath: inner,
      mouthInnerClipPath: mouthInner,
      mouthEllipseClipPath: mouthEllipse,
      back: (
        <>
          <path d="M 128 104 L 143 98 L 144 111 L 128 116 Z" fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth={VECTOR_STROKE} strokeLinejoin="round" />
          <path d="M 72 114 Q 54 118 54 132 Q 54 146 72 148" fill="none" stroke={GLASS_STROKE} strokeWidth={VECTOR_STROKE + 1} strokeLinecap="round" />
          <path d={jug} fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth={VECTOR_STROKE} strokeLinejoin="round" strokeLinecap="round" />
          <BackRim cavity={cavity} fill={RIM_FILL} stroke={RIM_STROKE} />
        </>
      ),
      front: (
        <>
          <RimLips cavity={cavity} stroke={GLASS_STROKE} style="glass" />
          <path d="M 82 118 L 84 146" stroke={GLASS_SHEEN} strokeWidth={VECTOR_STROKE} opacity={0.4} strokeLinecap="round" />
        </>
      ),
    };
  }

  // Default: glass_cup
  const tumbler = "M 74 102 L 78 158 Q 100 165 122 158 L 126 102 Z";
  return {
    clipId: "cup-clip",
    innerClipPath: inner,
    mouthInnerClipPath: mouthInner,
    mouthEllipseClipPath: mouthEllipse,
    back: (
      <>
        <path d={tumbler} fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth={VECTOR_STROKE} strokeLinejoin="round" strokeLinecap="round" />
        <BackRim cavity={cavity} fill={RIM_FILL} stroke={RIM_STROKE} />
      </>
    ),
    front: (
      <>
        <path d="M 82 116 L 84 146" stroke={GLASS_SHEEN} strokeWidth={VECTOR_STROKE + 1} opacity={0.4} strokeLinecap="round" />
        <RimLips cavity={cavity} stroke={GLASS_STROKE} style="glass" />
      </>
    ),
  };
}

function RoundedCube({ geo, sheen }: { geo: CubeGeometry; sheen: number }) {
  return (
    <>
      <rect
        x={-geo.halfW}
        y={-geo.halfH}
        width={geo.halfW * 2}
        height={geo.halfH * 2}
        rx={geo.rx}
        fill={ICE_FILL}
        stroke={ICE_OUTLINE}
        strokeWidth={VECTOR_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={`M ${geo.halfW - geo.rx} ${geo.halfH} L ${-geo.halfW + geo.rx} ${geo.halfH} Q ${-geo.halfW} ${geo.halfH} ${-geo.halfW} ${geo.halfH - geo.rx} L ${-geo.halfW} ${geo.halfH * 0.3} L ${geo.halfW} ${geo.halfH * 0.3} L ${geo.halfW} ${geo.halfH - geo.rx} Q ${geo.halfW} ${geo.halfH} ${geo.halfW - geo.rx} ${geo.halfH} Z`}
        fill={ICE_SHADE}
        opacity={0.45}
      />
      <rect
        x={geo.highlight.x}
        y={geo.highlight.y}
        width={geo.highlight.w}
        height={geo.highlight.h}
        rx={geo.highlight.h / 2}
        fill={ICE_HILITE}
        opacity={0.55 * sheen}
      />
    </>
  );
}

function IceCube({
  cube,
  shape,
  progress,
  sheen,
  pileFloorY,
}: {
  cube: IcePileCube;
  shape: IceShapeId;
  progress: number;
  sheen: number;
  /** Shared scale origin so the whole pile shrinks as one mass. */
  pileFloorY: number;
}) {
  // Whole pile melts together — shared local, not staggered per row.
  const local = Math.min(1, Math.max(0, progress));
  const scaleY = 1 - local * 0.92;
  const scaleX = 1 - local * 0.28;
  const opacity = local >= 1 ? 0 : (1 - local) * (0.5 + sheen * 0.5);
  const { x, rotate = 0 } = cube;
  const halfW = cube.halfW ?? 8;
  const halfH = cube.halfH ?? 8;

  const settleOffset =
    cube.settleY && local > 0 && local < 1
      ? lerpKeyframes(cube.settleY, local) - cube.y
      : 0;
  const cy = cube.y + settleOffset;

  if (local >= 1) return null;

  const altPath = alternateShapePath(shape, Math.min(halfW, halfH));

  return (
    <g
      opacity={opacity}
      transform={`translate(${x}, ${pileFloorY}) scale(${scaleX}, ${scaleY}) translate(${-x}, ${-pileFloorY})`}
    >
      <g transform={`translate(${x}, ${cy}) rotate(${rotate})`}>
        {altPath ? (
          <>
            <path d={altPath} fill={ICE_FILL} stroke={ICE_OUTLINE} strokeWidth={VECTOR_STROKE} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={-halfW * 0.35} cy={-halfH * 0.35} r={halfW * 0.16} fill={ICE_HILITE} opacity={0.55 * sheen} />
          </>
        ) : (
          <RoundedCube geo={getCubeGeometry(halfW, halfH)} sheen={sheen} />
        )}
      </g>
    </g>
  );
}

function countMeltedScoopLayers(profile: SoftServeProfile, progress: number): number {
  return profile.scoops.filter(
    (s) => layerMeltLocal(s.layer, profile.layerCount, progress) >= 1,
  ).length;
}

function IceCreamScene({
  config,
  progress,
  size,
  clipSuffix,
  animated,
}: {
  config: MeltConfig;
  progress: number;
  size: MeltSceneSize;
  clipSuffix: string;
  animated: boolean;
}) {
  const flavor = getFlavorOption(config.flavorId ?? "vanilla");
  const toppings = config.toppings ?? [];
  const cavity = getCavity(config.containerId);
  const parts = getContainerParts(config.containerId, "iceCream", clipSuffix, cavity);
  const innerClipId = `${parts.clipId}-inner-${clipSuffix}`;
  const mouthClipId = `${parts.clipId}-mouth-${clipSuffix}`;
  const profile = useMemo(
    () => buildSoftServeProfile(cavity, config.containerId),
    [cavity, config.containerId],
  );
  const color = flavor?.color ?? "#FFE7A3";
  const outline = flavor?.outline ?? darken(color, 0.38);
  const effects = meltStageEffects(progress);
  const meltedLayers = countMeltedScoopLayers(profile, progress);
  const meltedFraction = profile.layerCount > 0 ? meltedLayers / profile.layerCount : progress;
  const showInteriorLiquid =
    !cavity.isOpen && !profile.interiorFill && effects.drip > 0.15;
  const grainFilterId = `scoop-grain-${clipSuffix}`;
  const fillGradId = `interior-grad-${clipSuffix}`;

  return (
    <svg viewBox={SCENE_VIEWBOX} className={cn("mx-auto", SIZE_CLASSES[size])} role="img">
      <defs>
        <clipPath id={innerClipId}>
          <path d={parts.innerClipPath} />
        </clipPath>
        <clipPath id={mouthClipId}>
          <path d={parts.mouthInnerClipPath} />
          <path d={parts.mouthEllipseClipPath} />
        </clipPath>
        <ScoopGrainFilter id={grainFilterId} />
      </defs>

      {/* Scene graph (IceCreamScene)
          1. Exterior puddle (open containers)
          2. Container back
          3. Condensation
          4. Inner clip: interior fill / liquid
          5. Mouth clip: contact shade + scoop stack + toppings
          6. Container front (side lips / waffle hatch) — after scoops */}

      {cavity.isOpen ? (
        <ExteriorPuddle progress={progress} color={color} cavity={cavity} poolIntensity={effects.pool} />
      ) : null}
      <g>{parts.back}</g>
      <Condensation cavity={cavity} intensity={progress} animated={animated} />

      <g clipPath={`url(#${innerClipId})`}>
        {profile.interiorFill ? (
          <InteriorFill
            cavity={cavity}
            color={color}
            profile={profile}
            progress={progress}
            sheen={effects.sheen}
            grainFilterId={grainFilterId}
            gradientId={fillGradId}
          />
        ) : null}
        {showInteriorLiquid ? (
          <LiquidFill
            cavity={cavity}
            progress={progress}
            color={color}
            opacity={0.78}
            animated={animated}
            meltedFraction={meltedFraction}
          />
        ) : null}
      </g>

      <g clipPath={`url(#${mouthClipId})`}>
        <ScoopStack
          profile={profile}
          color={color}
          outline={outline}
          progress={progress}
          sheen={effects.sheen}
          toppings={toppings}
          cavity={cavity}
          grainFilterId={grainFilterId}
          idPrefix={clipSuffix}
        />
      </g>

      <g>{parts.front}</g>

      {cavity.isOpen ? (
        <OpenContainerDrips
          progress={progress}
          color={color}
          cavity={cavity}
          animated={animated}
          dripIntensity={effects.drip}
        />
      ) : null}
    </svg>
  );
}

function IceScene({
  config,
  progress,
  size,
  clipSuffix,
  animated,
}: {
  config: MeltConfig;
  progress: number;
  size: MeltSceneSize;
  clipSuffix: string;
  animated: boolean;
}) {
  const shape = config.iceShapeId ?? "classic_cube";
  const cavity = getCavity(config.containerId);
  const parts = getContainerParts(config.containerId, "ice", clipSuffix, cavity);
  const mouthClipId = `${parts.clipId}-mouth-${clipSuffix}`;
  const cubes = useMemo(
    () => buildIcePile(cavity, shape, config.containerId),
    [cavity, shape, config.containerId],
  );
  const sortedCubes = useMemo(() => sortCubesForRender(cubes), [cubes]);
  const pileFloorY = useMemo(() => {
    if (cubes.length === 0) return cavity.floorY;
    return Math.max(...cubes.map((c) => c.y + (c.halfH ?? 8)));
  }, [cubes, cavity.floorY]);
  const effects = meltStageEffects(progress);

  return (
    <svg viewBox={SCENE_VIEWBOX} className={cn("mx-auto", SIZE_CLASSES[size])} role="img">
      <defs>
        <clipPath id={mouthClipId}>
          <path d={parts.mouthInnerClipPath} />
          <path d={parts.mouthEllipseClipPath} />
        </clipPath>
      </defs>

      {/* Scene graph (IceScene)
          1. Container back
          2. Condensation
          3. Mouth clip: liquid + ice pile (wall-clamped; clip is a backstop)
          4. Container front (rim / lip / occluders) — after mouth contents so
             cubes near the lip cannot paint over the rim (Flaw 1). */}
      <g>{parts.back}</g>
      <Condensation cavity={cavity} intensity={progress} animated={animated} />

      <g clipPath={`url(#${mouthClipId})`}>
        <LiquidFill
          cavity={cavity}
          progress={progress}
          color={ICE_SHADE}
          opacity={0.48}
          animated={animated}
          meltedFraction={progress}
        />
        {sortedCubes.map((cube) => (
          <IceCube
            key={cube.index}
            cube={cube}
            shape={shape}
            progress={progress}
            sheen={effects.sheen}
            pileFloorY={pileFloorY}
          />
        ))}
      </g>

      <g>{parts.front}</g>
    </svg>
  );
}

function resolveSize(compact?: boolean, size?: MeltSceneSize): MeltSceneSize {
  if (size) return size;
  if (compact) return "sm";
  return "md";
}

export function MeltSceneV1({
  config,
  progress,
  compact,
  size,
  className,
  ariaLabel,
  popKey,
  animated: animatedProp,
}: MeltSceneProps) {
  const stage = meltStageFromProgress(progress);
  const clipSuffix = useId().replace(/:/g, "");
  const resolvedSize = resolveSize(compact, size);
  const reducedMotion = useReducedMotion();
  const animated = animatedProp ?? (resolvedSize !== "sm" && !reducedMotion);
  const label =
    ariaLabel ??
    `${config.displayName}, ${Math.round(progress * 100)}% melted, stage ${stage}`;

  return (
    <motion.div
      key={popKey}
      className={cn("relative flex items-center justify-center", className)}
      initial={popKey ? { scale: 0.92 } : false}
      animate={{ scale: 1 }}
      transition={springSoft}
    >
      {config.kind === "iceCream" ? (
        <IceCreamScene
          config={config}
          progress={progress}
          size={resolvedSize}
          clipSuffix={clipSuffix}
          animated={animated}
        />
      ) : (
        <IceScene
          config={config}
          progress={progress}
          size={resolvedSize}
          clipSuffix={clipSuffix}
          animated={animated}
        />
      )}
      <span className="sr-only">{label}</span>
    </motion.div>
  );
}

function MeltPreviewIconV1({ config }: { config: MeltConfig }) {
  return (
    <MeltSceneV1
      config={config}
      progress={0}
      size="sm"
      animated={false}
      className="pointer-events-none"
    />
  );
}

export type { MeltSceneSize };
export { PROGRESS_RING_CIRC };
