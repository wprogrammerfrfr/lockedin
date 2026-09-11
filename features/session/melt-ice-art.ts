import type { IceShapeId } from "@/features/session/melt-catalog";

/** Frosted ice palette — punched enough to read on slate-50 hero cards */
export const ICE_FILL = "#C8ECFF";
export const ICE_SHADE = "#7BB8E0";
export const ICE_OUTLINE = "#4F8FB8";
export const ICE_HILITE = "#FFFFFF";

/** Shared vector stroke for containers and contents */
export const VECTOR_STROKE = 2;
export const VECTOR_STROKE_CREASE = 1.4;

/** A rounded square with a soft highlight — the whole cube. */
export type CubeGeometry = {
  halfW: number;
  halfH: number;
  rx: number;
  highlight: { x: number; y: number; w: number; h: number };
};

export function getCubeGeometry(halfW: number, halfH: number): CubeGeometry {
  const width = halfW * 2;
  const rx = Math.min(halfH, width * 0.35);
  return {
    halfW,
    halfH,
    rx,
    highlight: {
      x: -halfW * 0.58,
      y: -halfH * 0.57,
      w: halfW * 0.62,
      h: Math.max(1.8, halfH * 0.2),
    },
  };
}

/** Soft bottom-right contour which follows the rounded cube edge. */
export function cubeInnerContourPath(geo: CubeGeometry): string {
  const { halfW: w, halfH: h, rx } = geo;
  const inset = Math.max(1.2, Math.min(w, h) * 0.14);
  return [
    `M ${w - inset} ${-h * 0.05}`,
    `L ${w - inset} ${h - rx * 0.58}`,
    `Q ${w - inset} ${h - inset} ${w - rx * 0.55} ${h - inset}`,
    `L ${-w * 0.18} ${h - inset}`,
  ].join(" ");
}

/** Simple closed path for sphere ice, centred on the origin. */
export function alternateShapePath(shape: IceShapeId, r: number): string | null {
  if (shape !== "sphere") return null;
  return `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;
}
