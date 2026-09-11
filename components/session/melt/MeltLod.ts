import type { MeltSceneSize } from "@/components/session/melt/types";

export type MeltLodFlags = {
  size: MeltSceneSize;
  showCondensation: boolean;
  showDripLoops: boolean;
  maxIceCubes: number;
  showGrain: boolean;
  meltKeyframeCount: 2 | 5;
  showGlassSheen: boolean;
  maxSprinkleDots: number;
  showTinyToppings: boolean;
};

export function meltLodForSize(size: MeltSceneSize): MeltLodFlags {
  if (size === "sm") {
    return {
      size,
      showCondensation: false,
      showDripLoops: false,
      maxIceCubes: 8,
      showGrain: false,
      meltKeyframeCount: 2,
      showGlassSheen: false,
      maxSprinkleDots: 3,
      showTinyToppings: false,
    };
  }
  if (size === "md") {
    return {
      size,
      showCondensation: true,
      showDripLoops: true,
      maxIceCubes: 12,
      showGrain: false,
      meltKeyframeCount: 5,
      showGlassSheen: true,
      maxSprinkleDots: 5,
      showTinyToppings: true,
    };
  }
  // lg and xl share full detail; xl is only a larger CSS frame.
  return {
    size,
    showCondensation: true,
    showDripLoops: true,
    maxIceCubes: 20,
    showGrain: true,
    meltKeyframeCount: 5,
    showGlassSheen: true,
    maxSprinkleDots: 5,
    showTinyToppings: true,
  };
}

/** Quantize progress for visual crossfade — pages still use raw progress for completion. */
export function quantizeProgress(progress: number, steps = 40): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return Math.round(progress * steps) / steps;
}
