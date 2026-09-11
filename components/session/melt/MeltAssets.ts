/**
 * Melt It V2 asset catalog.
 * Naming: melt/v2/{category}/{id}__{role}__{state}@2x.{ext}
 * Placeholder SVGs ship now; drop-in WebP with the same basename works later.
 */

export const MELT_ASSET_BASE = "/melt/v2";

export type MeltBodyState =
  | "fresh"
  | "softening"
  | "dripping"
  | "pooled"
  | "fully_melted";

export const MELT_BODY_STATES: MeltBodyState[] = [
  "fresh",
  "softening",
  "dripping",
  "pooled",
  "fully_melted",
];

export function containerAsset(
  containerId: string,
  role: "back" | "front" | "shadow",
): string {
  return `${MELT_ASSET_BASE}/containers/${containerId}__${role}__static.svg`;
}

export function bodyAsset(
  kind: "scoop" | "ice_cube" | "ice_sphere" | "interior",
  state: MeltBodyState,
): string {
  return `${MELT_ASSET_BASE}/bodies/${kind}__base__${state}.svg`;
}

export function toppingAsset(toppingId: string): string {
  return `${MELT_ASSET_BASE}/toppings/${toppingId}__static.svg`;
}

export function fxAsset(name: "puddle" | "drip"): string {
  return `${MELT_ASSET_BASE}/fx/${name}__open.svg`;
}

/** Scene-unit anchors — containers sit in the shared SCENE_VIEWBOX. */
export type ContainerAnchor = {
  /** Outer bounds for image placement */
  x: number;
  y: number;
  w: number;
  h: number;
};

export const CONTAINER_IMAGE_BOUNDS: Record<string, ContainerAnchor> = {
  cone: { x: 56, y: 100, w: 88, h: 78 },
  cup: { x: 60, y: 100, w: 80, h: 78 },
  sundae_glass: { x: 72, y: 70, w: 56, h: 108 },
  glass_cup: { x: 66, y: 92, w: 68, h: 82 },
  ice_bucket: { x: 50, y: 88, w: 100, h: 88 },
  pitcher: { x: 58, y: 90, w: 84, h: 84 },
};
