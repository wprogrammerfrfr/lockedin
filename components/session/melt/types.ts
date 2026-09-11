export type MeltSceneSize = "sm" | "md" | "lg" | "xl";

/**
 * Camera crop for melt SVG. Must include SCENE_TOP (~34) so scoop caps /
 * toppings are not flattened by the viewBox. Geometry itself is unchanged.
 */
export const SCENE_VIEWBOX = "18 28 164 160";
export const PROGRESS_RING_CIRC = 289;

/** Size tokens: fixed defaults for standalone use; max-* lets parents contain via h-full/w-full. */
export const SIZE_CLASSES: Record<MeltSceneSize, string> = {
  sm: "mx-auto aspect-square h-24 w-24 max-h-full max-w-full sm:h-28 sm:w-28",
  md: "mx-auto aspect-square h-48 w-48 max-h-full max-w-full sm:h-56 sm:w-56 md:h-64 md:w-64",
  lg: "mx-auto aspect-square h-64 w-64 max-h-full max-w-full sm:h-72 sm:w-72 md:h-80 md:w-80",
  /** Making-board preview — prefers dvh-capped size; fill parent when overridden */
  xl: "mx-auto aspect-square h-[min(16rem,40dvh)] w-[min(16rem,40dvh)] max-h-full max-w-full sm:h-[min(20rem,45dvh)] sm:w-[min(20rem,45dvh)] lg:h-[min(26rem,50dvh)] lg:w-[min(26rem,50dvh)]",
};
