import type { IceCreamContainerId } from "@/features/session/melt-catalog";
import {
  getCavity,
  getInsetCavity,
  getInteriorHalfWidthAtY,
  mouthOpeningCenterX,
  pileHash,
  rotatedExtents,
  SCOOP_OVERHANG,
  type ContainerCavity,
} from "@/features/session/melt-cavity";

export type SoftServeAnchor = {
  tipX: number;
  tipY: number;
  rimWidth: number;
  baseX: number;
  baseY: number;
};

/**
 * One scoop: a half-circle dome sitting on `seatY`, closed by a scalloped
 * crease. Scoops offset slightly for a natural stack.
 */
export type Scoop = {
  cx: number;
  seatY: number;
  r: number;
  layer: number;
  tilt?: number;
};

export type SoftServeProfile = {
  containerId: string;
  scoops: Scoop[];
  interiorFill: boolean;
  layerCount: number;
  bodyPath: string;
  anchor: SoftServeAnchor;
  rimContactY: number;
};

type ScoopConfig = {
  interiorFill: boolean;
  count: number;
  radiusRatio: number;
  maxRadius: number;
  nest: number;
};

const SCOOP_CONFIG: Record<string, ScoopConfig> = {
  // nest = how far the bottom scoop sinks below the rim (sits on the lip).
  cone: { interiorFill: false, count: 2, radiusRatio: SCOOP_OVERHANG, maxRadius: 42, nest: 5 },
  cup: { interiorFill: false, count: 2, radiusRatio: SCOOP_OVERHANG, maxRadius: 38, nest: 8 },
  // Packed bowl + nested scoop — nest ≈ r*0.12 so soft equator meets the rim.
  sundae_glass: { interiorFill: true, count: 1, radiusRatio: SCOOP_OVERHANG, maxRadius: 36, nest: 5 },
};

const DEFAULT_SCOOP = SCOOP_CONFIG.cup!;
const SCENE_TOP = 34;
const CREASE_BUMPS = 5;

/** Half-circle dome closed by a soft irregular scalloped crease. */
export function scoopDomePath(
  cx: number,
  seatY: number,
  r: number,
  seed?: string,
  index = 0,
): string {
  const amp = Math.max(1.4, r * 0.1);
  const stepW = (r * 2) / CREASE_BUMPS;
  // Slight left/right asymmetry so scoops aren't perfect circles.
  const leftR = r * (seed ? 0.96 + pileHash(`${seed}-dome-l-${index}`, 1) * 0.08 : 1);
  const rightR = r * (seed ? 0.96 + pileHash(`${seed}-dome-r-${index}`, 2) * 0.08 : 1);
  const peakLift = seed ? pileHash(`${seed}-dome-p-${index}`, 3) * r * 0.04 : 0;
  let d = `M ${cx - leftR} ${seatY} A ${leftR} ${r * 0.98 + peakLift} 0 0 1 ${cx + rightR} ${seatY}`;
  for (let i = 0; i < CREASE_BUMPS; i++) {
    const from = cx + rightR - (i * (leftR + rightR)) / CREASE_BUMPS;
    const mid = from - stepW / 2;
    const to = from - stepW;
    // Soften first/last scallops so left/right crease ends don't form pointy corners.
    const edgeSoft =
      i === 0 || i === CREASE_BUMPS - 1 ? 0.5 : 1;
    const bump =
      amp *
      edgeSoft *
      (seed
        ? 0.75 + pileHash(`${seed}-scallop-${index}-${i}`, 4) * 0.5
        : 1);
    d += ` Q ${mid} ${seatY + bump} ${to} ${seatY}`;
  }
  return `${d} Z`;
}

/**
 * Bottom / nested scoop blob: widest point sits ABOVE the rim so the join
 * is rounded overhang, not a flat T-bar on the container lip.
 * `shallow` — open cones: tuck just under the rim, don't flood the waffle body.
 */
export function scoopDomePathSoft(
  cx: number,
  seatY: number,
  r: number,
  shallow = false,
  seed?: string,
  index = 0,
): string {
  const wobble = seed ? (pileHash(`${seed}-soft-${index}`, 5) - 0.5) * r * 0.06 : 0;
  const eqY = seatY - r * 0.12 + wobble * 0.3;
  // Shallow cone: tuck belly inside the waffle; keep sides from spilling past the rim.
  const side = shallow ? 0.62 : 0.85;
  const sideDrop = shallow ? 0.42 : 0.62;
  const leftR =
    r *
    (shallow ? 0.88 : 1) *
    (seed ? 0.95 + pileHash(`${seed}-soft-l-${index}`, 6) * 0.1 : 1);
  const rightR =
    r *
    (shallow ? 0.88 : 1) *
    (seed ? 0.95 + pileHash(`${seed}-soft-r-${index}`, 7) * 0.1 : 1);
  const belly =
    seatY +
    Math.max(shallow ? 2.4 : 5.5, r * (shallow ? 0.1 : 0.36)) +
    wobble;
  return [
    `M ${cx - leftR} ${eqY}`,
    `A ${(leftR + rightR) / 2} ${r * 0.94} 0 0 1 ${cx + rightR} ${eqY}`,
    `C ${cx + rightR * side} ${eqY + r * sideDrop}, ${cx + r * 0.42} ${belly}, ${cx + wobble} ${belly}`,
    `C ${cx - r * 0.42} ${belly}, ${cx - leftR * side} ${eqY + r * sideDrop}, ${cx - leftR} ${eqY}`,
    "Z",
  ].join(" ");
}

/**
 * Simple horizontal scoop-mark squiggles for the dome face.
 * Returns 2–3 open stroke paths (not closed shapes).
 */
export function scoopSquigglePaths(
  cx: number,
  seatY: number,
  r: number,
  count = 3,
): string[] {
  const n = Math.min(3, Math.max(2, Math.round(count)));
  const fracs = n === 2 ? [0.4, 0.62] : [0.35, 0.55, 0.72];
  const amp = Math.max(0.9, r * 0.04);
  const bumps = 4;
  const halfW = r * 0.76;

  return fracs.map((frac, line) => {
    const y = seatY - r * frac;
    // Slight stagger so stacked lines don't look like a grid.
    const inset = halfW * (0.92 + (line % 2) * 0.04);
    const stepW = (inset * 2) / bumps;
    let d = `M ${cx - inset} ${y}`;
    for (let i = 0; i < bumps; i++) {
      const from = cx - inset + i * stepW;
      const mid = from + stepW / 2;
      const to = from + stepW;
      const sign = i % 2 === 0 ? 1 : -1;
      d += ` Q ${mid} ${y + sign * amp} ${to} ${y}`;
    }
    return d;
  });
}

/** Upper dome arc only — stroke this so the belly is not a sticker outline. */
export function scoopDomeArc(cx: number, seatY: number, r: number): string {
  const eqY = seatY - r * 0.12;
  return `M ${cx - r} ${eqY} A ${r} ${r * 0.96} 0 0 1 ${cx + r} ${eqY}`;
}

/** Upper arc for a full scalloped top scoop (equator at seatY). */
export function scoopDomeArcTop(cx: number, seatY: number, r: number): string {
  return `M ${cx - r} ${seatY} A ${r} ${r} 0 0 1 ${cx + r} ${seatY}`;
}

/** Soft scallop seam only — fill/stroke lightly so scoops blend. */
export function scoopScallopSeamPath(cx: number, seatY: number, r: number): string {
  const amp = Math.max(1.6, r * 0.11);
  const stepW = (r * 2) / CREASE_BUMPS;
  let d = `M ${cx + r} ${seatY}`;
  for (let i = 0; i < CREASE_BUMPS; i++) {
    const from = cx + r - i * stepW;
    const mid = from - stepW / 2;
    const to = from - stepW;
    d += ` Q ${mid} ${seatY + amp} ${to} ${seatY}`;
  }
  return d;
}

/** A second, shorter wave just above the crease for scooped texture. */
export function scoopCreasePath(cx: number, seatY: number, r: number): string {
  const amp = Math.max(1.2, r * 0.08);
  const inner = r * 0.72;
  const stepW = (inner * 2) / CREASE_BUMPS;
  const y = seatY - amp * 1.4;
  let d = `M ${cx - inner} ${y}`;
  for (let i = 0; i < CREASE_BUMPS; i++) {
    const from = cx - inner + i * stepW;
    const mid = from + stepW / 2;
    const to = from + stepW;
    d += ` Q ${mid} ${y + amp} ${to} ${y}`;
  }
  return d;
}

function scoopFits(
  inset: ContainerCavity,
  cx: number,
  seatY: number,
  r: number,
  allowOverhang: boolean,
): boolean {
  const topY = seatY - r;
  const rimHalf = getInteriorHalfWidthAtY(inset, inset.rimY);
  const center = mouthOpeningCenterX(inset);
  const slop = allowOverhang
    ? rimHalf * (SCOOP_OVERHANG - 1) + 1
    : rimHalf * 0.18;
  return (
    cx - r >= center - rimHalf - slop &&
    cx + r <= center + rimHalf + slop &&
    topY >= SCENE_TOP - 2 &&
    seatY <= inset.floorY + 4
  );
}

function clampScoopCx(
  inset: ContainerCavity,
  tryCx: number,
  r: number,
  allowOverhang: boolean,
): number {
  const rimHalf = getInteriorHalfWidthAtY(inset, inset.rimY);
  const center = mouthOpeningCenterX(inset);
  const slop = allowOverhang
    ? rimHalf * (SCOOP_OVERHANG - 1) + 1
    : rimHalf * 0.18;
  const minCx = center - rimHalf - slop + r;
  const maxCx = center + rimHalf + slop - r;
  if (minCx > maxCx) return center;
  return Math.min(maxCx, Math.max(minCx, tryCx));
}

function buildScoops(
  cavity: ContainerCavity,
  cfg: ScoopConfig,
  containerId: string,
): Scoop[] {
  const inset = getInsetCavity(cavity);
  // Flaw 4 (cup-scoop-gap): center on the rendered mouth ellipse, not the
  // inset bounding-box midpoint (they can disagree on tapered silhouettes).
  const baseCx = mouthOpeningCenterX(cavity);
  // Flaw 3 + 4: one shared rim width (same helper the ice pile clamps to).
  const rimHalf = getInteriorHalfWidthAtY(cavity, cavity.rimY);
  const firstLayer = cfg.interiorFill ? 1 : 0;
  const scoops: Scoop[] = [];

  let r = Math.min(rimHalf * cfg.radiusRatio, cfg.maxRadius);
  const maxNest = Math.max(0, inset.floorY - cavity.rimY - 4);
  // Seat on the outer rim so the scoop rests on the lip, not a second layer.
  let seatY = cavity.rimY + Math.min(cfg.nest, maxNest);
  let cx = baseCx;
  let tiltSign = 1;

  for (let i = 0; i < cfg.count; i++) {
    const seed = `${containerId}-scoop-${i}`;
    const isBottom = i === 0;
    // Upper scoops lean off-center so the stack is not a centered tower.
    const offsetX = isBottom ? 0 : tiltSign * (0.22 + pileHash(seed, 1) * 0.16) * r;
    const tilt = isBottom
      ? tiltSign * (1.2 + pileHash(seed, 2) * 1.4)
      : tiltSign * (7 + pileHash(seed, 2) * 6);
    const tryCx = clampScoopCx(inset, cx + offsetX, r, isBottom || i > 0);

    scoops.push({
      cx: scoopFits(inset, tryCx, seatY, r, isBottom || i > 0) ? tryCx : baseCx,
      seatY,
      r,
      layer: firstLayer + i,
      tilt,
    });

    const placed = scoops[scoops.length - 1]!;
    // Nest ~0.48–0.55 so the upper scoop sinks into the lower one.
    const nestDepth = 0.48 + pileHash(seed, 3) * 0.07;
    seatY = placed.seatY - placed.r + placed.r * nestDepth;
    r *= 0.8;
    cx = placed.cx;
    tiltSign *= -1;
  }

  return scoops;
}

export function buildSoftServeProfile(
  cavity: ContainerCavity,
  containerId: string,
): SoftServeProfile {
  const cfg = SCOOP_CONFIG[containerId] ?? DEFAULT_SCOOP;
  const scoops = buildScoops(cavity, cfg, containerId);
  const bottom = scoops[0]!;
  const top = scoops[scoops.length - 1]!;

  return {
    containerId,
    scoops,
    interiorFill: cfg.interiorFill,
    layerCount: scoops.length + (cfg.interiorFill ? 1 : 0),
    bodyPath: scoops.map((s) => scoopDomePath(s.cx, s.seatY, s.r)).join(" "),
    anchor: {
      tipX: top.cx,
      tipY: top.seatY - top.r,
      rimWidth: top.r * 2,
      baseX: bottom.cx,
      baseY: bottom.seatY,
    },
    rimContactY: cavity.rimY,
  };
}

export function getSoftServeProfile(containerId: string): SoftServeProfile {
  return buildSoftServeProfile(getCavity(containerId), containerId);
}

export const ICE_CREAM_CONTAINER_IDS: IceCreamContainerId[] = [
  "cone",
  "cup",
  "sundae_glass",
];

export function profileOverlapsRim(
  profile: SoftServeProfile,
  cavity: ContainerCavity,
): boolean {
  const base = profile.scoops[0]!;
  return base.seatY >= cavity.rimY && base.seatY - base.r < cavity.rimY;
}

export function profileWithinBounds(
  profile: SoftServeProfile,
  cavity: ContainerCavity,
): boolean {
  const rimHalf = getInteriorHalfWidthAtY(cavity, cavity.rimY);
  const cx = mouthOpeningCenterX(cavity);

  return profile.scoops.every((s, i) => {
    const ext = rotatedExtents(s.r, s.r, s.tilt ?? 0);
      const slop = i === 0 ? rimHalf * (SCOOP_OVERHANG - 1) + 1.5 : rimHalf * 0.22;
    return (
      ext.halfW <= rimHalf + slop &&
      s.cx - ext.halfW >= cx - rimHalf - slop &&
      s.cx + ext.halfW <= cx + rimHalf + slop &&
      s.seatY - s.r >= SCENE_TOP - 4
    );
  });
}

/** Visible dessert surface for topping placement. */
export type ToppingSurface = {
  cx: number;
  seatY: number;
  r: number;
  yMin: number;
  yMax: number;
  containerId: string;
  rimY: number;
};

export function toppingSurfaceFromScoop(
  scoop: Scoop,
  containerId: string,
  rimY: number,
): ToppingSurface {
  const peak = scoop.seatY - scoop.r;
  // Cone has no rim wall; vessels clamp toppings to the mouth lip.
  const yMax =
    containerId === "cone"
      ? scoop.seatY - scoop.r * 0.08
      : Math.min(scoop.seatY - scoop.r * 0.08, rimY + 2);
  return {
    cx: scoop.cx,
    seatY: scoop.seatY,
    r: scoop.r,
    yMin: peak,
    yMax,
    containerId,
    rimY,
  };
}

export function pointOnScoopCap(
  surface: ToppingSurface,
  seed: string,
  salt: number,
  opts?: { maxFrac?: number; embed?: number },
): { x: number; y: number } {
  const maxFrac = opts?.maxFrac ?? 0.72;
  const embed = opts?.embed ?? 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = salt + attempt * 17;
    const angle = (pileHash(seed, s) - 0.5) * Math.PI; // upper hemisphere bias
    const frac = Math.sqrt(pileHash(seed, s + 1)) * maxFrac;
    const dx = Math.cos(angle) * surface.r * frac;
    const dy = Math.sin(Math.abs(angle)) * surface.r * frac;
    // Project onto the dome: y rises toward the peak as |dx| shrinks.
    const height = Math.sqrt(
      Math.max(0, surface.r * surface.r - dx * dx),
    );
    const x = surface.cx + dx;
    let y = surface.seatY - height * (0.55 + 0.4 * (1 - frac)) + embed;
    // Prefer samples that stay on the visible cap.
    if (dy < 0) y = surface.seatY - height * 0.85 + embed;
    if (
      y >= surface.yMin - 2 &&
      y <= surface.yMax + 3 &&
      Math.abs(x - surface.cx) <= surface.r * maxFrac + 1
    ) {
      return { x, y };
    }
  }
  // Deterministic fallback near the peak.
  return {
    x: surface.cx + (pileHash(seed, salt) - 0.5) * surface.r * 0.25,
    y: surface.yMin + surface.r * 0.22 + embed,
  };
}

/** Soft equator Y for a nested scoop — used by geometry tests. */
export function scoopEquatorY(seatY: number, r: number): number {
  return seatY - r * 0.12;
}
