import type { MeltStage } from "@/features/session/melt-catalog";
import { meltStageFromProgress } from "@/features/session/melt-utils";
import type { MeltBodyState } from "@/components/session/melt/MeltAssets";
import { MELT_BODY_STATES } from "@/components/session/melt/MeltAssets";

export type MeltPose = {
  stage: MeltStage;
  bodyState: MeltBodyState;
  /** Mix toward next body state [0,1] */
  mix: number;
  nextBodyState: MeltBodyState;
  /** Extra horizontal spread */
  scaleX: number;
  /** Vertical squash / sag */
  scaleY: number;
  /** Downward translate in scene units */
  sagY: number;
  /** Body opacity (fully melted → 0) */
  bodyOpacity: number;
  pool: number;
  drip: number;
  soften: number;
  sheen: number;
};

const STAGE_CENTERS: { state: MeltBodyState; at: number }[] = [
  { state: "fresh", at: 0 },
  { state: "softening", at: 0.35 },
  { state: "dripping", at: 0.62 },
  { state: "pooled", at: 0.85 },
  { state: "fully_melted", at: 1 },
];

function bodyStatesForProgress(progress: number): {
  a: MeltBodyState;
  b: MeltBodyState;
  mix: number;
} {
  const p = Math.min(1, Math.max(0, progress));
  for (let i = 0; i < STAGE_CENTERS.length - 1; i++) {
    const cur = STAGE_CENTERS[i]!;
    const next = STAGE_CENTERS[i + 1]!;
    if (p <= next.at) {
      const span = Math.max(0.001, next.at - cur.at);
      return {
        a: cur.state,
        b: next.state,
        mix: (p - cur.at) / span,
      };
    }
  }
  return { a: "fully_melted", b: "fully_melted", mix: 1 };
}

/** Pure visual pose from authoritative progress (0–1). */
export function meltPoseFromProgress(progress: number): MeltPose {
  const p = Math.min(1, Math.max(0, progress));
  const stage = meltStageFromProgress(p);
  const { a, b, mix } = bodyStatesForProgress(p);
  const soften = Math.min(1, Math.max(0, (p - 0.15) / 0.35));
  const drip = Math.min(1, Math.max(0, (p - 0.45) / 0.35));
  const pool = Math.min(1, Math.max(0, (p - 0.7) / 0.25));
  const sheen = Math.max(0, 1 - p * 1.1);

  const scaleX = 1 + p * 0.2;
  const scaleY = Math.max(0.2, 1 - p * 0.8);
  const sagY = soften * 2 + drip * 6 + pool * 10;
  const bodyOpacity =
    p >= 1 ? 0 : p >= 0.8 ? Math.max(0, 1 - (p - 0.8) / 0.2) : 1;

  return {
    stage,
    bodyState: a,
    nextBodyState: b,
    mix,
    scaleX,
    scaleY,
    sagY,
    bodyOpacity: Math.max(0, bodyOpacity),
    pool,
    drip,
    soften,
    sheen,
  };
}

/** Per-layer ice-cream melt visual (top melts first). */
export function layerPose(
  layer: number,
  total: number,
  progress: number,
): {
  local: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  sagY: number;
} {
  if (total <= 0) {
    return { local: 0, scaleX: 1, scaleY: 1, opacity: 1, sagY: 0 };
  }
  const span = 1 / total;
  const start = (total - 1 - layer) * span;
  let local = 0;
  if (progress > start) {
    local = Math.min(1, (progress - start) / Math.max(0.04, span));
  }
  const dissolve = Math.min(1, Math.max(0, (local - 0.8) / 0.2));
  return {
    local,
    scaleX: 1 + local * 0.2,
    scaleY: Math.max(0.2, 1 - local * 0.8),
    opacity: 1 - dissolve,
    sagY: local * 8,
  };
}

export function nearestBodyState(
  progress: number,
  keyframeCount: 2 | 5,
): MeltBodyState {
  if (keyframeCount === 2) {
    return progress >= 0.5 ? "pooled" : "fresh";
  }
  const { a, b, mix } = bodyStatesForProgress(progress);
  return mix < 0.5 ? a : b;
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** Smoothstep from edge0→edge1, clamped to [0,1]. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(0.001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Exterior cone puddle only after drip trails reach the tip.
 * Keeps pool growth start-at-zero while preventing early floor blobs.
 */
export function exteriorPoolIntensity(drip: number, pool: number): number {
  return clamp01(pool) * smoothstep(0.8, 1, clamp01(drip));
}

/** Continuous lerp across four settleY keyframes (avoids discrete bucket hops). */
export function lerpKeyframes(
  keys: [number, number, number, number],
  t: number,
): number {
  const p = clamp01(t);
  const seg = p * 3;
  const i = Math.min(2, Math.floor(seg));
  const f = seg - i;
  return keys[i]! + (keys[i + 1]! - keys[i]!) * f;
}

/**
 * Ease-in cubic — holds structural shape early, accelerates sink/pool late.
 * Prefer this over ease-out (1-(1-t)³) which collapses first.
 */
export function easeInCubic(t: number): number {
  const p = clamp01(t);
  return p * p * p;
}

export type IceUnitPose = {
  melt: number;
  y: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
};

export const MELT_SCALE_Y_FLOOR = 0.2;

/** Convert a parked solid's vertical squash into normalized lost volume. */
export function solidMeltedFraction(
  scaleY: number,
  freshScale = 1,
): number {
  const floor = freshScale * MELT_SCALE_Y_FLOOR;
  const span = Math.max(0.001, freshScale - floor);
  return clamp01((freshScale - scaleY) / span);
}

/**
 * Pure per-cube ice pose from raw local progress (before spring smoothing).
 * Keeps a flattened blob through the final 10% for pool crossfade.
 */
export function iceUnitPose({
  local,
  settleY,
  y,
  depthScale,
  sheen,
  depthOpacity,
  globalProgress,
}: {
  local: number;
  settleY?: [number, number, number, number];
  y: number;
  depthScale: number;
  sheen: number;
  depthOpacity: number;
  /** Authoritative session progress — used so jitter cannot unmount early. */
  globalProgress: number;
}): IceUnitPose {
  let melt = easeInCubic(clamp01(local));
  // Jitter must not finish a cube before the global handoff window.
  if (globalProgress < 1) {
    melt = Math.min(melt, 0.995);
  }

  const settleYPos = settleY ? lerpKeyframes(settleY, melt) : y;
  const squash = Math.min(1, melt * 1.15);
  const scaleY =
    Math.max(MELT_SCALE_Y_FLOOR, 1 - squash * 0.8) * depthScale;
  const scaleX = (1 + melt * 0.2) * depthScale;

  // Keep the solid opaque while it squashes, then dissolve the parked puddle.
  const baseOpacity = (0.78 + sheen * 0.2) * depthOpacity;
  const lifecycle =
    globalProgress < 1 ? Math.min(clamp01(local), 0.995) : clamp01(local);
  const dissolve = clamp01((lifecycle - 0.8) / 0.2);
  const opacity = lifecycle >= 1 ? 0 : baseOpacity * (1 - dissolve);

  return {
    melt,
    y: settleYPos,
    scaleX,
    scaleY,
    opacity: Math.max(0, opacity),
  };
}

export { MELT_BODY_STATES };
