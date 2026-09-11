import { pileHash } from "@/features/session/melt-cavity";
import type { MeltConfig } from "@/features/session/melt-catalog";

/** Stable seed for V1 records that never stored visualSeed. */
export function deriveVisualSeed(config: MeltConfig): string {
  if (config.visualSeed) return config.visualSeed;
  const toppings = (config.toppings ?? []).slice().sort().join(",");
  return [
    config.kind,
    config.containerId,
    config.flavorId ?? "",
    config.iceShapeId ?? "",
    toppings,
  ].join("-");
}

export function createVisualSeed(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `melt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Deterministic [0,1) from seed + salt — wraps pileHash. */
export function seededUnit(seed: string, salt: number): number {
  return pileHash(seed, salt);
}

/** Inclusive range. */
export function seededRange(
  seed: string,
  salt: number,
  min: number,
  max: number,
): number {
  return min + seededUnit(seed, salt) * (max - min);
}

export function seededInt(
  seed: string,
  salt: number,
  min: number,
  max: number,
): number {
  return Math.floor(seededRange(seed, salt, min, max + 1 - 1e-9));
}

export function seededSign(seed: string, salt: number): 1 | -1 {
  return seededUnit(seed, salt) < 0.5 ? -1 : 1;
}
