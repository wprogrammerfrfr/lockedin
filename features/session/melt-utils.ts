import type { MeltStage, MeltConfig } from "@/features/session/melt-catalog";

/** Visual melt progress (0–1). Timer elapsed is unchanged; speed only affects animation mapping. */
export function computeMeltProgress(
  elapsedMs: number,
  meltAnimOffsetMs: number,
  meltDurationMs: number,
  animSpeedMultiplier = 1,
): number {
  if (meltDurationMs <= 0) return 0;
  const effective = Math.max(0, elapsedMs - meltAnimOffsetMs) * animSpeedMultiplier;
  return Math.min(1, effective / meltDurationMs);
}

export function meltStageFromProgress(progress: number): MeltStage {
  if (progress >= 0.95) return "fully_melted";
  if (progress >= 0.75) return "pooled";
  if (progress >= 0.5) return "dripping";
  if (progress >= 0.2) return "softening";
  return "fresh";
}

export function isMeltComplete(progress: number): boolean {
  return progress >= 1;
}

/** Stage-aware effect intensities for visuals (0–1). */
export function meltStageEffects(progress: number): {
  stage: MeltStage;
  soften: number;
  drip: number;
  pool: number;
  sheen: number;
} {
  const stage = meltStageFromProgress(progress);
  const soften = Math.min(1, Math.max(0, (progress - 0.15) / 0.35));
  const drip = Math.min(1, Math.max(0, (progress - 0.45) / 0.35));
  const pool = Math.min(1, Math.max(0, (progress - 0.7) / 0.25));
  const sheen = Math.max(0, 1 - progress * 1.1);
  return { stage, soften, drip, pool, sheen };
}

/** Per-layer melt window — no dead zone between layers. */
export function layerMeltLocal(
  layer: number,
  total: number,
  progress: number,
): number {
  if (total <= 0) return 0;
  const span = 1 / total;
  const start = (total - 1 - layer) * span;
  if (progress <= start) return 0;
  return Math.min(1, (progress - start) / Math.max(0.04, span));
}

/** Receipt / summary line e.g. "Studied until ice cream melted" */
export function meltSummaryLine(
  config: MeltConfig,
  complete: boolean,
  t?: (key: string, params?: Record<string, string | number>) => string,
): string {
  const name = config.displayName;
  if (t) {
    if (complete) {
      if (config.kind === "ice") {
        return t("melt.summary.iceMelted", { name });
      }
      return t("melt.summary.iceCreamMelted", { name });
    }
    if (config.kind === "ice") {
      return t("melt.summary.studyingIce", { name });
    }
    return t("melt.summary.studyingIceCream", { name });
  }
  if (complete) {
    return config.kind === "ice"
      ? `Studied until ${name} melted`
      : `Studied until ${name} melted`;
  }
  return config.kind === "ice"
    ? `Studying until ${name} melts`
    : `Studying until ${name} melts`;
}

export function meltRoomStatusLabel(
  customizing: boolean,
  config: MeltConfig | null,
  t?: (key: string) => string,
): string | null {
  if (customizing && config) {
    if (config.kind === "iceCream") {
      return t?.("melt.room.customizingIceCream") ?? "Customizing ice cream";
    }
    return t?.("melt.room.fillingIce") ?? "Filling up ice";
  }
  if (customizing) {
    return t?.("melt.room.customizing") ?? "Customizing dessert";
  }
  return null;
}
