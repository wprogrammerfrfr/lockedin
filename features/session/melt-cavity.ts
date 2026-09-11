import type { IceShapeId } from "@/features/session/melt-catalog";

export const WALL_INSET = 3.5;

export type ContainerCavity = {
  floorY: number;
  rimY: number;
  rimLeft: number;
  rimRight: number;
  floorLeft: number;
  floorRight: number;
  /** Cone / waffle bowl — melt drips outside, no interior reservoir */
  isOpen?: boolean;
  /** Show wall condensation when animated */
  hasGlass?: boolean;
  /** Rounded floor control point Y (SVG Q curve apex) */
  floorCurveY?: number;
  /** Friendly mid-wall outward bow in scene units. */
  barrel?: number;
  /** Lowest visible point used to anchor the ground shadow. */
  contactY: number;
};

export const CONTAINER_CAVITY: Record<string, ContainerCavity> = {
  cone: {
    floorY: 168,
    rimY: 112,
    rimLeft: 62,
    rimRight: 138,
    floorLeft: 98,
    floorRight: 102,
    isOpen: true,
    floorCurveY: 170,
    contactY: 171,
  },
  cup: {
    floorY: 168,
    rimY: 110,
    rimLeft: 68,
    rimRight: 132,
    floorLeft: 78,
    floorRight: 122,
    floorCurveY: 172,
    contactY: 173,
  },
  sundae_glass: {
    floorY: 140,
    rimY: 100,
    rimLeft: 68,
    rimRight: 132,
    floorLeft: 90,
    floorRight: 110,
    hasGlass: true,
    floorCurveY: 146,
    contactY: 171,
  },
  ice_bucket: {
    floorY: 166,
    rimY: 98,
    rimLeft: 58,
    rimRight: 142,
    floorLeft: 66,
    floorRight: 134,
    hasGlass: true,
    floorCurveY: 170,
    contactY: 176,
  },
  pitcher: {
    floorY: 162,
    rimY: 100,
    rimLeft: 72,
    rimRight: 128,
    floorLeft: 78,
    floorRight: 122,
    hasGlass: true,
    floorCurveY: 165,
    barrel: 1.5,
    contactY: 173,
  },
  glass_cup: {
    floorY: 164,
    rimY: 102,
    rimLeft: 74,
    rimRight: 126,
    floorLeft: 78,
    floorRight: 122,
    hasGlass: true,
    floorCurveY: 165,
    barrel: 1.8,
    contactY: 173,
  },
};

/** Mouth opening ellipse above rim (scene units). */
export const MOUTH_OPENING: Record<
  string,
  { rx: number; ry: number; lift: number }
> = {
  cone: { rx: 34, ry: 10, lift: 22 },
  cup: { rx: 28, ry: 9, lift: 20 },
  sundae_glass: { rx: 32, ry: 8, lift: 22 },
  ice_bucket: { rx: 38, ry: 10, lift: 16 },
  pitcher: { rx: 24, ry: 9, lift: 14 },
  glass_cup: { rx: 22, ry: 8, lift: 14 },
};

export function getCavity(containerId: string): ContainerCavity {
  return CONTAINER_CAVITY[containerId] ?? CONTAINER_CAVITY.glass_cup!;
}

/** Inset cavity matching wall thickness inside the outer silhouette. */
export function getInsetCavity(
  cavity: ContainerCavity,
  wall = WALL_INSET,
): ContainerCavity {
  return {
    ...cavity,
    rimLeft: cavity.rimLeft + wall,
    rimRight: cavity.rimRight - wall,
    floorLeft: cavity.floorLeft + wall,
    floorRight: cavity.floorRight - wall,
    rimY: cavity.rimY + wall * 0.35,
    floorY: cavity.floorY - wall * 0.45,
  };
}

export function interiorEdgesAt(cavity: ContainerCavity, y: number) {
  if (y <= cavity.rimY) {
    return { left: cavity.rimLeft, right: cavity.rimRight };
  }
  if (y >= cavity.floorY) {
    return { left: cavity.floorLeft, right: cavity.floorRight };
  }
  const t = (y - cavity.rimY) / (cavity.floorY - cavity.rimY);
  const bulge = (cavity.barrel ?? 0) * 4 * t * (1 - t);
  return {
    left: cavity.rimLeft + (cavity.floorLeft - cavity.rimLeft) * t - bulge,
    right: cavity.rimRight + (cavity.floorRight - cavity.rimRight) * t + bulge,
  };
}

export function interiorWidthAt(cavity: ContainerCavity, y: number): number {
  const { left, right } = interiorEdgesAt(cavity, y);
  return Math.max(8, right - left);
}

export function interiorCenterX(cavity: ContainerCavity, y: number): number {
  const { left, right } = interiorEdgesAt(cavity, y);
  return (left + right) / 2;
}

/**
 * Inner-wall half-width at a scene y, including taper on cones/glasses.
 * Shared source of truth for ice-pile wall clamps and scoop-stack rim width.
 * Pass an inset cavity for packing; pass the outer cavity for the visual mouth.
 */
export function getInteriorHalfWidthAtY(cavity: ContainerCavity, y: number): number {
  return interiorWidthAt(cavity, y) / 2;
}

/** Midpoint of the rendered mouth ellipse — not the outer bounding-box center. */
export function mouthOpeningCenterX(cavity: ContainerCavity): number {
  return interiorCenterX(cavity, cavity.rimY);
}

/** Flaw 3 (sundae-hat-seam): scoop base wider than the rim opening, not equal to it. */
export const SCOOP_OVERHANG = 1.08;
/** Flaw 1 (ice-bucket-overflow): extra inset for cubes near the lip. */
export const RIM_CUBE_INSET = 2;

export function cavityDepth(cavity: ContainerCavity): number {
  return Math.max(12, cavity.floorY - cavity.rimY);
}

/** Curved bowl floor Y at horizontal position x. */
export function floorSurfaceY(cavity: ContainerCavity, x: number): number {
  const cx = interiorCenterX(cavity, cavity.floorY);
  const curveY = cavity.floorCurveY ?? cavity.floorY + 4;
  const halfW = Math.max(8, (cavity.floorRight - cavity.floorLeft) / 2);
  const t = Math.min(1, Math.abs(x - cx) / halfW);
  return cavity.floorY + (curveY - cavity.floorY) * (1 - t * t);
}

/**
 * Inset trapezoid for interior clipping.
 * Uses outer cavity.rimY so the mouth ellipse and bowl share one rim seam
 * (avoids a ~1.2px gap that can cancel under nonzero clip rules).
 */
/** Soft inset fill for opaque vessels — hides bleed without a second outline. */
export function innerWallShadePath(
  cavity: ContainerCavity,
  wall = WALL_INSET + 1.5,
): string {
  return innerClipPath(cavity, wall);
}

export function innerClipPath(cavity: ContainerCavity, wall = WALL_INSET): string {
  const inset = getInsetCavity(cavity, wall);
  const cx = interiorCenterX(inset, inset.floorY);
  const curveY = (cavity.floorCurveY ?? cavity.floorY + 4) - wall * 0.3;
  const midY = (cavity.rimY + inset.floorY) / 2;
  const mid = interiorEdgesAt(inset, midY);
  return [
    `M ${inset.rimLeft} ${cavity.rimY}`,
    `C ${inset.rimLeft - (inset.barrel ?? 0)} ${midY}, ${mid.left} ${midY}, ${inset.floorLeft} ${inset.floorY}`,
    `Q ${cx} ${curveY} ${inset.floorRight} ${inset.floorY}`,
    `C ${mid.right} ${midY}, ${inset.rimRight + (inset.barrel ?? 0)} ${midY}, ${inset.rimRight} ${cavity.rimY}`,
    "Z",
  ].join(" ");
}

/** Headroom above the rim so masonry peaks are not sliced by the clip. */
const ICE_CROWN_LIFT = 40;
const ICE_CROWN_ARCH_RY = 16;

/**
 * Strict ice-vessel interior: inset bowl plus a tall crown above the rim.
 * Verticals stay on the rim left/right bounds (no side bleed); the crown
 * arcs up to rimY - ICE_CROWN_LIFT so mounded cubes keep their tops.
 */
export function iceInteriorClipPath(
  cavity: ContainerCavity,
  containerId: string,
): string {
  const inset = getInsetCavity(cavity);
  const spoutInset = containerId === "pitcher" ? 4 : 0;
  const mouthLeft = inset.rimLeft - spoutInset;
  const mouthRight = inset.rimRight;
  const mouthRx = (mouthRight - mouthLeft) / 2;
  const cx = interiorCenterX(inset, inset.floorY);
  const curveY =
    (cavity.floorCurveY ?? cavity.floorY + 4) - WALL_INSET * 0.3;
  const midY = (cavity.rimY + inset.floorY) / 2;
  const mid = interiorEdgesAt(inset, midY);
  const crownPeakY = cavity.rimY - ICE_CROWN_LIFT;
  const capY = crownPeakY + ICE_CROWN_ARCH_RY;

  return [
    `M ${mouthLeft} ${cavity.rimY}`,
    `C ${mouthLeft - (inset.barrel ?? 0)} ${midY}, ${mid.left} ${midY}, ${inset.floorLeft} ${inset.floorY}`,
    `Q ${cx} ${curveY} ${inset.floorRight} ${inset.floorY}`,
    `C ${mid.right} ${midY}, ${inset.rimRight + (inset.barrel ?? 0)} ${midY}, ${mouthRight} ${cavity.rimY}`,
    `L ${mouthRight} ${capY}`,
    `A ${mouthRx} ${ICE_CROWN_ARCH_RY} 0 0 0 ${mouthLeft} ${capY}`,
    `L ${mouthLeft} ${cavity.rimY}`,
    "Z",
  ].join(" ");
}

/** Mouth ellipse alone — pair with innerClipPath as separate clipPath children. */
export function mouthEllipseClipPath(
  cavity: ContainerCavity,
  containerId: string,
  wall = WALL_INSET,
  mouthScale = 1,
): string {
  const mouth = MOUTH_OPENING[containerId] ?? MOUTH_OPENING.glass_cup!;
  const inset = getInsetCavity(cavity, wall);
  const cx = mouthOpeningCenterX(cavity);
  const innerHalf = getInteriorHalfWidthAtY(inset, cavity.rimY);
  const outerHalf = getInteriorHalfWidthAtY(cavity, cavity.rimY);
  // Ice cream uses mouthScale > 1 so the clip does not shear the overhang
  // (Flaw 3); ice piles keep scale 1 so the clip is only a backstop (Flaw 1).
  const rx = (mouthScale > 1 ? outerHalf : innerHalf) * mouthScale;
  const { ry } = mouth;
  const lift = mouthScale > 1 ? Math.max(mouth.lift * 1.45, cavity.rimY - 32) : mouth.lift;
  const top = cavity.rimY - lift;
  const rimY = cavity.rimY;
  // Round the flat-rim corners so scoop overhang isn't sheared into right angles.
  // Still bulge UP only — a downward arc would cancel under nonzero clip-rule.
  const fillet = Math.min(6, rx * 0.12);
  return [
    `M ${cx - rx + fillet} ${rimY}`,
    `L ${cx + rx - fillet} ${rimY}`,
    `Q ${cx + rx} ${rimY} ${cx + rx} ${rimY - fillet}`,
    `L ${cx + rx} ${top + ry}`,
    `A ${rx} ${ry} 0 0 0 ${cx - rx} ${top + ry}`,
    `L ${cx - rx} ${rimY - fillet}`,
    `Q ${cx - rx} ${rimY} ${cx - rx + fillet} ${rimY}`,
    "Z",
  ].join(" ");
}

/**
 * Combined mouth clip as a single path string (tests / legacy).
 * Prefer rendering as two <path> children so overlapping subpaths union.
 */
export function mouthClipPath(
  cavity: ContainerCavity,
  containerId: string,
  wall = WALL_INSET,
  mouthScale = 1,
): string {
  return `${innerClipPath(cavity, wall)} ${mouthEllipseClipPath(cavity, containerId, wall, mouthScale)}`;
}

/**
 * Cone scoop clip: waffle silhouette + rounded mouth dome above the rim.
 * Mouth half-width uses cavity rim + SCOOP_OVERHANG so the bottom scoop belly
 * is not sheared by a hardcoded vertical wall (old left=63).
 */
export function coneScoopClipPath(cavity: ContainerCavity): string {
  const waffleLeft = cavity.rimLeft + 1;
  const waffleRight = cavity.rimRight - 1;
  const rimY = cavity.rimY + 1.5;
  const cx = mouthOpeningCenterX(cavity);
  const rimHalf = getInteriorHalfWidthAtY(cavity, cavity.rimY);
  // Overhang slack + mouthScale-like pad so soft belly isn't flat-cut at the rim.
  const rx = rimHalf * SCOOP_OVERHANG * 1.14;
  const mouthLeft = cx - rx;
  const mouthRight = cx + rx;
  const mouth = MOUTH_OPENING.cone!;
  const lift = Math.max(mouth.lift * 1.45, cavity.rimY - 32);
  const top = cavity.rimY - lift;
  const archY = top + mouth.ry;
  const fillet = Math.min(8, rx * 0.14);
  return [
    `M ${waffleLeft} ${rimY}`,
    `L 91.5 157.5`,
    `Q 100 171 109.5 157`,
    `L ${waffleRight} ${rimY}`,
    // Flare out to overhang mouth with filleted corners (no vertical L walls).
    `Q ${mouthRight} ${rimY} ${mouthRight} ${rimY - fillet}`,
    `L ${mouthRight} ${archY}`,
    `A ${rx} ${mouth.ry} 0 0 0 ${mouthLeft} ${archY}`,
    `L ${mouthLeft} ${rimY - fillet}`,
    `Q ${mouthLeft} ${rimY} ${waffleLeft} ${rimY}`,
    "Z",
  ].join(" ");
}

export function liquidFillFraction(progress: number, lag = 0.06): number {
  const p = Math.min(1, Math.max(0, progress));
  const adjusted = Math.max(0, (p - lag) / (1 - lag));
  return adjusted * adjusted * (3 - 2 * adjusted);
}

export function liquidLevelY(cavity: ContainerCavity, progress: number): number {
  const depth = cavityDepth(cavity);
  const fill = liquidFillFraction(progress);
  return cavity.floorY - depth * fill;
}

/** Liquid level driven by melted solid mass (0–1). */
export function liquidLevelFromMass(
  cavity: ContainerCavity,
  meltedFraction: number,
): number {
  const depth = cavityDepth(cavity);
  const fill = Math.min(1, Math.max(0, meltedFraction));
  const eased = fill * fill * (3 - 2 * fill);
  return cavity.floorY - depth * eased;
}

export function meltedMassFraction(
  progress: number,
  totalItems: number,
  meltedCount: number,
): number {
  if (totalItems <= 0) return progress;
  const fromItems = meltedCount / totalItems;
  return Math.min(1, Math.max(fromItems, progress * 0.85));
}

export type IcePileCube = {
  x: number;
  /** Centre Y */
  y: number;
  bottomY: number;
  row: number;
  col: number;
  index: number;
  meltStart: number;
  totalRows: number;
  rotate?: number;
  scale?: number;
  halfW?: number;
  halfH?: number;
  variant?: number;
  z?: number;
  /** 0 = back, 1 = middle, 2 = front */
  depth?: 0 | 1 | 2;
  /** Top extends above rim (still clipped to mouth) */
  aboveRim?: boolean;
  /** Precomputed settle keyframes for melt animation */
  settleY?: [number, number, number, number];
};

/** Deterministic pseudo-random in [0, 1) from a seed string */
export function pileHash(seed: string, salt: number): number {
  let h = (salt * 0x9e3779b1) | 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const MIN_CONTACT = 1.2;

/** Axis-aligned bounding half-extents after rotation. */
export function rotatedExtents(
  halfW: number,
  halfH: number,
  rotateDeg: number,
): { halfW: number; halfH: number } {
  const rad = (rotateDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    halfW: halfW * cos + halfH * sin,
    halfH: halfW * sin + halfH * cos,
  };
}

/** True when two cubes' boxes overlap (not merely share a corner). */
export function cubesTouch(
  a: IcePileCube,
  b: IcePileCube,
  minOverlap = MIN_CONTACT,
): boolean {
  const ahw = a.halfW ?? 8;
  const ahh = a.halfH ?? 8;
  const bhw = b.halfW ?? 8;
  const bhh = b.halfH ?? 8;
  const aExt = rotatedExtents(ahw, ahh, a.rotate ?? 0);
  const bExt = rotatedExtents(bhw, bhh, b.rotate ?? 0);
  return (
    Math.abs(a.x - b.x) <= aExt.halfW + bExt.halfW - minOverlap &&
    Math.abs(a.y - b.y) <= aExt.halfH + bExt.halfH - minOverlap
  );
}

type StaticCubeDraft = {
  x: number;
  /** Omit to rest on the curved floor at x. */
  y?: number;
  halfW: number;
  halfH: number;
  rotate: number;
  row: number;
  col: number;
  depth: 0 | 1 | 2;
  variant: number;
};

/**
 * Hand-crafted dense fills — floor → peak order so LOD can prefix-slice.
 * Tumbled rotations and mixed sizes; coordinates sit inside the inset cavity.
 */
const STATIC_ICE_LAYOUTS: Record<string, StaticCubeDraft[]> = {
  glass_cup: [
    // Row 0 floor — omit y; edges against inset walls (mild wall rot for AABB)
    { x: 88.0, halfW: 5.8, halfH: 6.0, rotate: 5, row: 0, col: 0, depth: 0, variant: 0 },
    { x: 100.0, halfW: 6.8, halfH: 6.4, rotate: -30, row: 0, col: 1, depth: 1, variant: 1 },
    { x: 112.0, halfW: 5.8, halfH: 6.0, rotate: -5, row: 0, col: 2, depth: 2, variant: 2 },
    // Row 1 saddles of 88/100 and 100/112
    { x: 94.0, y: 145.0, halfW: 6.5, halfH: 6.3, rotate: 75, row: 1, col: 0, depth: 0, variant: 3 },
    { x: 106.0, y: 145.0, halfW: 6.4, halfH: 6.5, rotate: -45, row: 1, col: 1, depth: 2, variant: 0 },
    // Row 2 walls — blueprint 85 / 100 / 115
    { x: 85.5, y: 132.0, halfW: 5.8, halfH: 5.8, rotate: 12, row: 2, col: 0, depth: 1, variant: 1 },
    { x: 100.0, y: 130.5, halfW: 6.8, halfH: 6.5, rotate: -60, row: 2, col: 1, depth: 0, variant: 2 },
    { x: 114.5, y: 132.0, halfW: 5.8, halfH: 5.8, rotate: 18, row: 2, col: 2, depth: 2, variant: 3 },
    // Row 3 saddles — blueprint 93 / 107
    { x: 93.0, y: 118.0, halfW: 6.4, halfH: 6.2, rotate: -75, row: 3, col: 0, depth: 0, variant: 0 },
    { x: 107.0, y: 118.0, halfW: 6.5, halfH: 6.3, rotate: 35, row: 3, col: 1, depth: 1, variant: 1 },
    // Row 4 extra 3-cube tier to keep count 15
    { x: 86.5, y: 106.0, halfW: 5.8, halfH: 5.8, rotate: -15, row: 4, col: 0, depth: 2, variant: 2 },
    { x: 100.0, y: 104.5, halfW: 6.5, halfH: 6.2, rotate: 80, row: 4, col: 1, depth: 1, variant: 3 },
    { x: 113.5, y: 106.0, halfW: 5.8, halfH: 5.8, rotate: 25, row: 4, col: 2, depth: 0, variant: 0 },
    // Row 5 peak near rim
    { x: 93.0, y: 94.0, halfW: 6.2, halfH: 6.0, rotate: 55, row: 5, col: 0, depth: 2, variant: 1 },
    { x: 107.0, y: 94.0, halfW: 6.0, halfH: 6.2, rotate: -40, row: 5, col: 1, depth: 1, variant: 2 },
  ],
  pitcher: [
    // Row 0 floor
    { x: 88.0, halfW: 5.8, halfH: 6.0, rotate: 5, row: 0, col: 0, depth: 0, variant: 0 },
    { x: 100.0, halfW: 6.8, halfH: 6.4, rotate: -35, row: 0, col: 1, depth: 1, variant: 1 },
    { x: 112.0, halfW: 5.8, halfH: 6.0, rotate: -5, row: 0, col: 2, depth: 2, variant: 2 },
    // Row 1 saddles
    { x: 94.0, y: 144.0, halfW: 6.5, halfH: 6.3, rotate: 70, row: 1, col: 0, depth: 0, variant: 3 },
    { x: 106.0, y: 144.0, halfW: 6.4, halfH: 6.5, rotate: -50, row: 1, col: 1, depth: 2, variant: 0 },
    // Row 2 walls
    { x: 85.5, y: 134.0, halfW: 5.8, halfH: 5.8, rotate: 12, row: 2, col: 0, depth: 1, variant: 1 },
    { x: 100.0, y: 132.5, halfW: 6.8, halfH: 6.5, rotate: -65, row: 2, col: 1, depth: 0, variant: 2 },
    { x: 114.5, y: 134.0, halfW: 5.8, halfH: 5.8, rotate: 12, row: 2, col: 2, depth: 2, variant: 3 },
    // Row 3 saddles
    { x: 93.0, y: 124.0, halfW: 6.4, halfH: 6.2, rotate: -75, row: 3, col: 0, depth: 0, variant: 0 },
    { x: 107.0, y: 124.0, halfW: 6.5, halfH: 6.3, rotate: 30, row: 3, col: 1, depth: 1, variant: 1 },
    // Row 4 walls
    { x: 86.5, y: 114.0, halfW: 5.8, halfH: 5.8, rotate: -15, row: 4, col: 0, depth: 2, variant: 2 },
    { x: 100.0, y: 112.5, halfW: 6.5, halfH: 6.2, rotate: 80, row: 4, col: 1, depth: 1, variant: 3 },
    { x: 113.5, y: 114.0, halfW: 5.8, halfH: 5.8, rotate: 20, row: 4, col: 2, depth: 0, variant: 0 },
    // Row 5 saddles
    { x: 93.0, y: 104.0, halfW: 6.2, halfH: 6.0, rotate: 55, row: 5, col: 0, depth: 2, variant: 1 },
    { x: 107.0, y: 104.0, halfW: 6.0, halfH: 6.2, rotate: -40, row: 5, col: 1, depth: 1, variant: 2 },
    // Row 6 extra peak tier (taller vessel)
    { x: 90.0, y: 94.0, halfW: 5.8, halfH: 5.8, rotate: -15, row: 6, col: 0, depth: 0, variant: 3 },
    { x: 100.0, y: 93.0, halfW: 6.4, halfH: 6.2, rotate: 60, row: 6, col: 1, depth: 1, variant: 0 },
    { x: 110.0, y: 94.0, halfW: 5.8, halfH: 5.8, rotate: -55, row: 6, col: 2, depth: 2, variant: 1 },
  ],
  ice_bucket: [
    // Row 0 floor — 5 cubes spanning ~70–130 extents
    { x: 76.5, halfW: 6.0, halfH: 6.2, rotate: 5, row: 0, col: 0, depth: 0, variant: 0 },
    { x: 88.0, halfW: 7.0, halfH: 6.8, rotate: -30, row: 0, col: 1, depth: 1, variant: 1 },
    { x: 100.0, halfW: 7.5, halfH: 7.2, rotate: 60, row: 0, col: 2, depth: 2, variant: 2 },
    { x: 112.0, halfW: 7.0, halfH: 6.8, rotate: -40, row: 0, col: 3, depth: 1, variant: 3 },
    { x: 123.5, halfW: 6.0, halfH: 6.2, rotate: -5, row: 0, col: 4, depth: 0, variant: 0 },
    // Row 1 saddles
    { x: 82.0, y: 150.0, halfW: 6.8, halfH: 6.5, rotate: 45, row: 1, col: 0, depth: 2, variant: 1 },
    { x: 94.0, y: 148.5, halfW: 7.2, halfH: 7.0, rotate: -25, row: 1, col: 1, depth: 0, variant: 2 },
    { x: 106.0, y: 148.5, halfW: 7.2, halfH: 7.0, rotate: 75, row: 1, col: 2, depth: 1, variant: 3 },
    { x: 118.0, y: 150.0, halfW: 6.8, halfH: 6.5, rotate: -50, row: 1, col: 3, depth: 2, variant: 0 },
    // Row 2 walls
    { x: 77.5, y: 137.0, halfW: 6.2, halfH: 6.2, rotate: 12, row: 2, col: 0, depth: 1, variant: 1 },
    { x: 89.0, y: 135.5, halfW: 7.0, halfH: 6.8, rotate: -65, row: 2, col: 1, depth: 2, variant: 2 },
    { x: 101.0, y: 134.5, halfW: 7.5, halfH: 7.0, rotate: 35, row: 2, col: 2, depth: 0, variant: 3 },
    { x: 113.0, y: 135.5, halfW: 7.0, halfH: 6.8, rotate: -45, row: 2, col: 3, depth: 1, variant: 0 },
    { x: 124.5, y: 137.0, halfW: 6.2, halfH: 6.2, rotate: 18, row: 2, col: 4, depth: 2, variant: 1 },
    // Row 3 saddles
    { x: 83.0, y: 124.0, halfW: 6.8, halfH: 6.5, rotate: -20, row: 3, col: 0, depth: 0, variant: 2 },
    { x: 95.0, y: 122.5, halfW: 7.2, halfH: 6.8, rotate: 55, row: 3, col: 1, depth: 1, variant: 3 },
    { x: 107.0, y: 122.5, halfW: 7.2, halfH: 6.8, rotate: -70, row: 3, col: 2, depth: 2, variant: 0 },
    { x: 119.0, y: 124.0, halfW: 6.8, halfH: 6.5, rotate: 30, row: 3, col: 3, depth: 0, variant: 1 },
    // Row 4
    { x: 84.0, y: 112.0, halfW: 6.5, halfH: 6.3, rotate: 40, row: 4, col: 0, depth: 2, variant: 2 },
    { x: 96.0, y: 110.5, halfW: 7.0, halfH: 6.5, rotate: -35, row: 4, col: 1, depth: 1, variant: 3 },
    { x: 108.0, y: 110.5, halfW: 7.0, halfH: 6.5, rotate: 65, row: 4, col: 2, depth: 0, variant: 0 },
    { x: 120.0, y: 112.0, halfW: 6.5, halfH: 6.3, rotate: -25, row: 4, col: 3, depth: 2, variant: 1 },
    // Row 5 peak
    { x: 92.0, y: 102.0, halfW: 6.5, halfH: 6.2, rotate: 80, row: 5, col: 0, depth: 1, variant: 2 },
    { x: 108.0, y: 102.0, halfW: 6.5, halfH: 6.2, rotate: -55, row: 5, col: 1, depth: 2, variant: 3 },
  ],
};

function finalizeStaticPile(
  drafts: StaticCubeDraft[],
  cavity: ContainerCavity,
): IcePileCube[] {
  const inset = getInsetCavity(cavity);
  const totalRows = Math.max(1, ...drafts.map((d) => d.row + 1));

  return drafts.map((draft, index) => {
    const halfW = draft.halfW;
    const halfH = draft.halfH;
    const y =
      draft.y ?? floorSurfaceY(inset, draft.x) - halfH;
    const depth = draft.depth;
    return {
      x: draft.x,
      y,
      bottomY: y + halfH,
      row: draft.row,
      col: draft.col,
      index,
      meltStart: 0,
      totalRows,
      rotate: draft.rotate,
      scale: 1,
      halfW,
      halfH,
      variant: draft.variant,
      depth,
      z: depth * 1000 + Math.round(y * 10) + index,
      aboveRim: y - halfH < inset.rimY,
      settleY: [
        y,
        y + halfH * 0.06,
        y + halfH * 0.12,
        y + halfH * 0.18,
      ] as [number, number, number, number],
    };
  });
}

/**
 * Hand-placed ice pile for a vessel. Layouts are static pyramids ordered
 * floor → peak; maxCubes prefix-slices for LOD. visualSeed is ignored for
 * placement (melt phase jitter still uses seed at render time).
 */
export function buildIcePile(
  cavity: ContainerCavity,
  _shape: IceShapeId,
  containerId?: string,
  maxCubes?: number,
  _visualSeed?: string,
): IcePileCube[] {
  const id = containerId ?? "glass_cup";
  const layout = STATIC_ICE_LAYOUTS[id] ?? STATIC_ICE_LAYOUTS.glass_cup!;
  const limit = maxCubes ?? layout.length;
  const sliced = layout.slice(0, Math.max(0, Math.min(limit, layout.length)));
  return finalizeStaticPile(sliced, cavity);
}

/**
 * Flaw 3 (sundae-hat-seam): thin crescent where the bottom scoop meets the
 * rim front edge. Companion primitive — does not change scoopDomePath.
 */
export function scoopContactShadePath(
  cx: number,
  rimY: number,
  rx: number,
  height = 3.2,
): string {
  const h = Math.max(2, Math.min(5.5, height));
  return [
    `M ${cx - rx} ${rimY}`,
    `Q ${cx} ${rimY + h} ${cx + rx} ${rimY}`,
    `Q ${cx} ${rimY + h * 0.28} ${cx - rx} ${rimY}`,
    "Z",
  ].join(" ");
}

/**
 * Packed ice-cream body that hugs the glass walls and cups softly under
 * the nested scoop (no flat top bar / white wall gap).
 */
export function packedFillPath(
  cavity: ContainerCavity,
  wall = 1.0,
  softTop = 5.5,
): string {
  const inset = getInsetCavity(cavity, wall);
  const cx = interiorCenterX(inset, inset.floorY);
  const curveY = (cavity.floorCurveY ?? cavity.floorY + 4) - wall * 0.2;
  const topY = cavity.rimY + 1.2;
  const topL = inset.rimLeft;
  const topR = inset.rimRight;
  const midY = (topY + inset.floorY) * 0.55;
  const midL = interiorEdgesAt(inset, midY).left;
  const midR = interiorEdgesAt(inset, midY).right;
  // Soft side curves follow the bowl — no hard trapezoid corners.
  return [
    `M ${topL} ${topY}`,
    `Q ${cx} ${topY - softTop} ${topR} ${topY}`,
    `C ${topR + 0.5} ${topY + 8}, ${midR + 0.4} ${midY}, ${inset.floorRight} ${inset.floorY}`,
    `Q ${cx} ${curveY} ${inset.floorLeft} ${inset.floorY}`,
    `C ${midL - 0.4} ${midY}, ${topL - 0.5} ${topY + 8}, ${topL} ${topY}`,
    "Z",
  ].join(" ");
}

/** Sort cubes back-to-front for painter's order inside the clip. */
export function sortCubesForRender(cubes: IcePileCube[]): IcePileCube[] {
  return [...cubes].sort((a, b) => {
    const ad = a.depth ?? (a.z != null ? Math.floor(a.z / 1000) : 1);
    const bd = b.depth ?? (b.z != null ? Math.floor(b.z / 1000) : 1);
    if (ad !== bd) return ad - bd;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}
