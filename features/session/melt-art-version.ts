import type { MeltArtVersion, MeltConfig } from "@/features/session/melt-catalog";

/**
 * Env-gated default for NEW melt configs.
 * Set NEXT_PUBLIC_MELT_ART_VERSION=1 to force V1 procedural fallback in prod.
 * Missing / anything other than "1" => V2 compositor.
 */
export function defaultArtVersion(): MeltArtVersion {
  const raw = process.env.NEXT_PUBLIC_MELT_ART_VERSION;
  if (raw === "1") return 1;
  return 2;
}

/** Resolve which renderer to use for a stored or live config. */
export function resolveArtVersion(config: MeltConfig): MeltArtVersion {
  if (config.artVersion === 1 || config.artVersion === 2) {
    return config.artVersion;
  }
  // Legacy records with no artVersion stay on V1 so history does not silently restyle.
  return 1;
}
