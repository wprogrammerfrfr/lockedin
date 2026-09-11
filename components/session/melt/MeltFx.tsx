"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ContainerCavity } from "@/features/session/melt-cavity";
import {
  getInsetCavity,
  interiorCenterX,
  interiorEdgesAt,
  liquidLevelFromMass,
} from "@/features/session/melt-cavity";
import { seededRange } from "@/features/session/melt-seed";

export function MeltLiquidPool({
  cavity,
  color,
  meltedFraction,
  opacity = 0.7,
  animated,
}: {
  cavity: ContainerCavity;
  color: string;
  meltedFraction: number;
  opacity?: number;
  animated: boolean;
}) {
  if (meltedFraction <= 0.02) return null;
  const inset = getInsetCavity(cavity);
  const levelY = liquidLevelFromMass(inset, meltedFraction);
  const { left, right } = interiorEdgesAt(inset, levelY);
  const cx = (left + right) / 2;
  const rx = Math.max(4, (right - left) / 2 - 2);

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
      <ellipse
        cx={cx}
        cy={levelY}
        rx={rx}
        ry={4}
        fill={color}
        opacity={opacity + 0.08}
      >
        {animated ? (
          <>
            {/* ~0.3px continuous surface wobble — not a looping GIF bounce */}
            <animate
              attributeName="ry"
              values="3.85;4.15;3.85"
              dur="5.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cx"
              values={`${cx - 0.3};${cx + 0.3};${cx - 0.3}`}
              dur="7s"
              repeatCount="indefinite"
            />
          </>
        ) : null}
      </ellipse>
    </g>
  );
}

export function MeltExteriorPuddle({
  cavity,
  color,
  poolIntensity,
}: {
  cavity: ContainerCavity;
  color: string;
  poolIntensity: number;
}) {
  if (poolIntensity <= 0.05) return null;
  const p = 1 - (1 - poolIntensity) ** 3;
  const cx = interiorCenterX(cavity, cavity.floorY);
  return (
    <ellipse
      cx={cx}
      cy={cavity.floorY + 9}
      rx={8 + p * 28}
      ry={3 + p * 9}
      fill={color}
      opacity={0.35 + p * 0.4}
    />
  );
}

/** Point along a cone-wall drip trail at fraction t ∈ [0,1]. */
function coneWallPoint(
  rimX: number,
  rimY: number,
  tipX: number,
  tipY: number,
  t: number,
  bow: number,
): { x: number; y: number } {
  const midX = rimX + (tipX - rimX) * 0.5 + bow;
  const midY = rimY + (tipY - rimY) * 0.5;
  // Quadratic Bezier: (1-t)² P0 + 2(1-t)t P1 + t² P2
  const u = 1 - t;
  return {
    x: u * u * rimX + 2 * u * t * midX + t * t * tipX,
    y: u * u * rimY + 2 * u * t * midY + t * t * tipY,
  };
}

export function MeltDrips({
  cavity,
  color,
  dripIntensity,
  animated,
  seed,
  showLoops,
}: {
  cavity: ContainerCavity;
  color: string;
  dripIntensity: number;
  animated: boolean;
  seed: string;
  showLoops: boolean;
}) {
  if (dripIntensity <= 0.05) return null;
  const eased = 1 - (1 - dripIntensity) ** 3;
  const rimY = cavity.rimY + 6;
  const tipY = cavity.floorY;

  // Left / right trails follow the waffle walls down to the tip.
  const leftRimX = cavity.rimLeft + 10 + seededRange(seed, 200, -2, 2);
  const rightRimX = cavity.rimRight - 10 + seededRange(seed, 201, -2, 2);
  const leftTipX = cavity.floorLeft + seededRange(seed, 202, -1, 1);
  const rightTipX = cavity.floorRight + seededRange(seed, 203, -1, 1);

  const leftEnd = coneWallPoint(leftRimX, rimY, leftTipX, tipY, eased, -3);
  const leftMid = coneWallPoint(leftRimX, rimY, leftTipX, tipY, eased * 0.5, -3);
  const rightEnd = coneWallPoint(rightRimX, rimY, rightTipX, tipY, eased, 3);
  const rightMid = coneWallPoint(rightRimX, rimY, rightTipX, tipY, eased * 0.55, 3);

  // One-shot drop lands just past the tip once the trail arrives (~0.85).
  const dropStart = coneWallPoint(leftRimX, rimY, leftTipX, tipY, Math.min(1, eased), -3);

  return (
    <g>
      <path
        d={`M ${leftRimX} ${rimY} Q ${leftMid.x} ${leftMid.y} ${leftEnd.x} ${leftEnd.y}`}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.7}
      />
      <path
        d={`M ${rightRimX} ${rimY + 2} Q ${rightMid.x} ${rightMid.y} ${rightEnd.x} ${rightEnd.y}`}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.55}
      />
      {animated && showLoops ? (
        <MeltDripOneShot
          cx={dropStart.x}
          startY={dropStart.y}
          endY={cavity.floorY + 8}
          color={color}
          dripIntensity={dripIntensity}
        />
      ) : null}
    </g>
  );
}

/** Falls once when dripIntensity crosses 0.85 (trail at tip) — never loops. */
function MeltDripOneShot({
  cx,
  startY,
  endY,
  color,
  dripIntensity,
}: {
  cx: number;
  startY: number;
  endY: number;
  color: string;
  dripIntensity: number;
}) {
  const prevRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = dripIntensity;
    if (prev === null) return;
    if (prev < 0.85 && dripIntensity >= 0.85) {
      setActive(true);
    }
  }, [dripIntensity]);

  if (!active) return null;
  return (
    <motion.circle
      cx={cx}
      r={2.5}
      fill={color}
      initial={{ cy: startY, opacity: 0.85 }}
      animate={{ cy: endY, opacity: 0 }}
      transition={{ duration: 1.6, ease: "easeIn" }}
      onAnimationComplete={() => setActive(false)}
    />
  );
}

const ICE_DRIP_THRESHOLDS = [0.3, 0.5, 0.7, 0.88] as const;

type SpawnedDrip = {
  id: number;
  x: number;
  startY: number;
  endY: number;
};

/** One-shot condensation drips for ice vessels when melt crosses thresholds. */
export function MeltIceThresholdDrips({
  cavity,
  progress,
  animated,
  seed,
}: {
  cavity: ContainerCavity;
  progress: number;
  animated: boolean;
  seed: string;
}) {
  const prevRef = useRef<number | null>(null);
  const [drips, setDrips] = useState<SpawnedDrip[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!animated || !cavity.hasGlass) {
      prevRef.current = progress;
      return;
    }
    const prev = prevRef.current;
    prevRef.current = progress;
    // Skip spawn burst on mid-session mount (no prior sample).
    if (prev === null) return;

    const inset = getInsetCavity(cavity);
    const wallY = inset.rimY + 10;
    const { left, right } = interiorEdgesAt(inset, wallY);
    const crossed = ICE_DRIP_THRESHOLDS.filter((t) => prev < t && progress >= t);
    if (crossed.length === 0) return;

    const spawned: SpawnedDrip[] = crossed.map((t, i) => {
      const slot = seededRange(seed, 300 + Math.round(t * 100), 0.15, 0.85);
      idRef.current += 1;
      return {
        id: idRef.current,
        x: left + (right - left) * slot + i * 0.5,
        startY: wallY + (i % 2) * 4,
        endY: inset.floorY - 2,
      };
    });
    setDrips((d) => [...d, ...spawned]);
  }, [progress, animated, cavity, seed]);

  if (!animated || drips.length === 0) return null;

  return (
    <g>
      {drips.map((d) => (
        <motion.circle
          key={d.id}
          cx={d.x}
          r={1.8}
          fill="#93C5FD"
          initial={{ cy: d.startY, opacity: 0.7 }}
          animate={{ cy: d.endY, opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeIn" }}
          onAnimationComplete={() => {
            setDrips((list) => list.filter((x) => x.id !== d.id));
          }}
        />
      ))}
    </g>
  );
}

export function MeltCondensation({
  cavity,
  intensity,
  animated,
}: {
  cavity: ContainerCavity;
  intensity: number;
  animated: boolean;
}) {
  if (!cavity.hasGlass || intensity < 0.05) return null;
  const inset = getInsetCavity(cavity);
  const wallY = inset.rimY + 6;
  const { left, right } = interiorEdgesAt(inset, wallY);
  const xs = [0.2, 0.4, 0.55, 0.7, 0.85].map((t) => left + (right - left) * t);
  // Progress-driven growth — no infinite bob loops.
  const grow = Math.min(1, Math.max(0, intensity));
  const groupOpacity = 0.1 + grow * 0.35;

  return (
    <g opacity={groupOpacity}>
      {xs.map((x, i) => {
        const phase = 0.55 + (i % 3) * 0.12;
        const localGrow = Math.min(1, grow / phase);
        const rx = 1.2 + localGrow * 1.6;
        const ry = 2 + localGrow * 2.4;
        const cy = wallY + (i % 2) * 5 + localGrow * 1.5;
        if (!animated) {
          return (
            <ellipse
              key={i}
              cx={x}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="#93C5FD"
            />
          );
        }
        return (
          <motion.ellipse
            key={i}
            cx={x}
            fill="#93C5FD"
            initial={false}
            animate={{ cy, rx, ry }}
            transition={{ type: "spring", stiffness: 40, damping: 24 }}
          />
        );
      })}
    </g>
  );
}
