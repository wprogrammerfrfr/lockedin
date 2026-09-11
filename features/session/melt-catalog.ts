/** Hardcoded v1 dessert / ice catalogs for MELT IT mode. */

export type MeltKind = "iceCream" | "ice";

export type MeltStage =
  | "fresh"
  | "softening"
  | "dripping"
  | "pooled"
  | "fully_melted";

export type MeltPostAction = "trash" | "refreeze" | "refreeze_restart";

export type IceCreamContainerId =
  | "cone"
  | "cup"
  | "sundae_glass";

export type IceContainerId =
  | "glass_cup"
  | "ice_bucket"
  | "pitcher";

export type IceShapeId =
  | "classic_cube"
  | "sphere";

export type IceCreamFlavorId =
  | "vanilla"
  | "chocolate"
  | "strawberry"
  | "matcha";

export type IceCreamToppingId =
  | "sprinkles"
  | "chocolate_sauce"
  | "cherry"
  | "whipped_cream"
  | "cookie_crumb";

export type CatalogOption = {
  id: string;
  label: string;
  emoji: string;
  color?: string;
};

export type MeltPresetId = "baskin_bucket_30m" | "ice_1L_60m";

export type MeltArtVersion = 1 | 2;

export type MeltConfig = {
  kind: MeltKind;
  presetId?: MeltPresetId | null;
  containerId: string;
  flavorId?: IceCreamFlavorId;
  iceShapeId?: IceShapeId;
  toppings?: IceCreamToppingId[];
  meltDurationMs: number;
  displayName: string;
  /** Deterministic variation seed for scoop tilt, toppings, drip slots. */
  visualSeed?: string;
  /** Missing => V1 procedural SVG. New sessions use DEFAULT_ART_VERSION. */
  artVersion?: MeltArtVersion;
};

export type MeltRecord = {
  config: MeltConfig;
  meltProgress: number;
  meltComplete: boolean;
  outcomeAction: MeltPostAction | null;
  completedAt?: string;
};

export type DessertMetadata = {
  active: MeltRecord | null;
  history: MeltRecord[];
  /** Missing => treat as V1 schema. */
  schemaVersion?: 1 | 2;
};

export const ICE_CREAM_CONTAINERS: CatalogOption[] = [
  { id: "cone", label: "Waffle Cone", emoji: "🍦" },
  { id: "cup", label: "Paper Cup", emoji: "🥤" },
  { id: "sundae_glass", label: "Sundae Glass", emoji: "🍨" },
];

export const ICE_CONTAINERS: CatalogOption[] = [
  { id: "glass_cup", label: "Glass Cup", emoji: "🥛" },
  { id: "ice_bucket", label: "Ice Bucket", emoji: "🪣" },
  { id: "pitcher", label: "Pitcher", emoji: "🫗" },
];

export const ICE_SHAPES: CatalogOption[] = [
  { id: "classic_cube", label: "Classic Cube", emoji: "🧊" },
  { id: "sphere", label: "Sphere", emoji: "⚪" },
];

export const ICE_CREAM_FLAVORS: (CatalogOption & {
  color: string;
  outline: string;
})[] = [
  { id: "vanilla", label: "Vanilla", emoji: "🍦", color: "#FFE7A3", outline: "#C4A04A" },
  { id: "chocolate", label: "Chocolate", emoji: "🍫", color: "#7A4328", outline: "#3F2112" },
  { id: "strawberry", label: "Strawberry", emoji: "🍓", color: "#F06B8A", outline: "#B03A58" },
  { id: "matcha", label: "Matcha", emoji: "🍵", color: "#6B9F45", outline: "#3E6424" },
];

export const ICE_CREAM_TOPPINGS: CatalogOption[] = [
  { id: "sprinkles", label: "Sprinkles", emoji: "✨" },
  { id: "chocolate_sauce", label: "Choco Sauce", emoji: "🍫" },
  { id: "cherry", label: "Cherry", emoji: "🍒" },
  { id: "whipped_cream", label: "Whipped Cream", emoji: "☁️" },
  { id: "cookie_crumb", label: "Cookie Crumbs", emoji: "🍪" },
];

export const MELT_PRESETS: {
  id: MeltPresetId;
  label: string;
  emoji: string;
  config: Omit<MeltConfig, "displayName"> & { displayName?: string };
  meltDurationMs: number;
}[] = [
  {
    id: "baskin_bucket_30m",
    label: "Vanilla Cone",
    emoji: "🍦",
    meltDurationMs: 30 * 60_000,
    config: {
      kind: "iceCream",
      presetId: "baskin_bucket_30m",
      containerId: "cone",
      flavorId: "vanilla",
      toppings: ["sprinkles", "cherry"],
      meltDurationMs: 30 * 60_000,
    },
  },
  {
    id: "ice_1L_60m",
    label: "1L Ice Cubes",
    emoji: "🧊",
    meltDurationMs: 60 * 60_000,
    config: {
      kind: "ice",
      presetId: "ice_1L_60m",
      containerId: "glass_cup",
      iceShapeId: "classic_cube",
      meltDurationMs: 60 * 60_000,
    },
  },
];

export const DEFAULT_MELT_DURATION_MS = {
  iceCream: 30 * 60_000,
  ice: 60 * 60_000,
} as const;

/** Per-container melt targets (ms). Presets keep their explicit durations. */
export const CONTAINER_MELT_DURATION_MS: Record<string, number> = {
  // ice cream
  cone: 20 * 60_000,
  cup: 30 * 60_000,
  sundae_glass: 40 * 60_000,
  // ice
  glass_cup: 45 * 60_000,
  ice_bucket: 75 * 60_000,
  pitcher: 60 * 60_000,
};

export function meltDurationForContainer(
  kind: MeltKind,
  containerId: string,
): number {
  return (
    CONTAINER_MELT_DURATION_MS[containerId] ??
    DEFAULT_MELT_DURATION_MS[kind]
  );
}

export function getContainerOption(
  kind: MeltKind,
  containerId: string,
): CatalogOption | undefined {
  const list = kind === "iceCream" ? ICE_CREAM_CONTAINERS : ICE_CONTAINERS;
  return list.find((c) => c.id === containerId);
}

export function getFlavorOption(flavorId: string) {
  return ICE_CREAM_FLAVORS.find((f) => f.id === flavorId);
}

export function getIceShapeOption(shapeId: string) {
  return ICE_SHAPES.find((s) => s.id === shapeId);
}

export function buildMeltDisplayName(config: MeltConfig): string {
  if (config.presetId) {
    const preset = MELT_PRESETS.find((p) => p.id === config.presetId);
    if (preset) return preset.label;
  }
  const container = getContainerOption(config.kind, config.containerId);
  if (config.kind === "iceCream") {
    const flavor = getFlavorOption(config.flavorId ?? "vanilla");
    return `${flavor?.label ?? "Ice Cream"} ${container?.label ?? "Cup"}`;
  }
  const shape = getIceShapeOption(config.iceShapeId ?? "classic_cube");
  return `${shape?.label ?? "Ice"} in ${container?.label ?? "Container"}`;
}

export function createMeltConfig(partial: {
  kind: MeltKind;
  presetId?: MeltPresetId | null;
  containerId?: string;
  flavorId?: IceCreamFlavorId;
  iceShapeId?: IceShapeId;
  toppings?: IceCreamToppingId[];
  displayName?: string;
  visualSeed?: string;
  artVersion?: MeltArtVersion;
}): MeltConfig {
  const artVersion = partial.artVersion ?? resolveDefaultArtVersion();
  const visualSeed =
    partial.visualSeed ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `melt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  const preset = partial.presetId
    ? MELT_PRESETS.find((p) => p.id === partial.presetId)
    : null;

  if (preset) {
    return {
      ...preset.config,
      displayName: partial.displayName?.trim() || preset.label,
      meltDurationMs: preset.meltDurationMs,
      visualSeed,
      artVersion,
    };
  }

  const kind = partial.kind;
  const containerId =
    partial.containerId ??
    (kind === "iceCream" ? "cone" : "glass_cup");
  const meltDurationMs = meltDurationForContainer(kind, containerId);

  const config: MeltConfig = {
    kind,
    containerId,
    meltDurationMs,
    displayName: "",
    flavorId: kind === "iceCream" ? (partial.flavorId ?? "vanilla") : undefined,
    iceShapeId: kind === "ice" ? (partial.iceShapeId ?? "classic_cube") : undefined,
    toppings: kind === "iceCream" ? (partial.toppings ?? []) : undefined,
    visualSeed,
    artVersion,
  };
  config.displayName =
    partial.displayName?.trim() || buildMeltDisplayName(config);
  return config;
}

function resolveDefaultArtVersion(): MeltArtVersion {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MELT_ART_VERSION === "1") {
    return 1;
  }
  return 2;
}

export function emptyDessertMetadata(): DessertMetadata {
  return { active: null, history: [], schemaVersion: 2 };
}

export function dessertMetadataFromState(
  meltConfig: MeltConfig | null,
  meltAnimOffsetMs: number,
  elapsedMs: number,
  meltComplete: boolean,
  meltOutcomeAction: MeltPostAction | null,
  meltHistory: MeltRecord[],
): DessertMetadata | null {
  if (!meltConfig && meltHistory.length === 0) return null;

  const progress = meltConfig
    ? Math.min(1, Math.max(0, (elapsedMs - meltAnimOffsetMs) / meltConfig.meltDurationMs))
    : 0;

  const active: MeltRecord | null = meltConfig
    ? {
        config: meltConfig,
        meltProgress: progress,
        meltComplete,
        outcomeAction: meltOutcomeAction,
        completedAt: new Date().toISOString(),
      }
    : null;

  return { active, history: meltHistory, schemaVersion: 2 };
}

/** Fields to restore into the session reducer when resuming a remote melt session. */
export type MeltHydrateFields = {
  meltConfig: MeltConfig | null;
  meltAnimOffsetMs: number;
  meltComplete: boolean;
  meltOutcomeAction: MeltPostAction | null;
  meltHistory: MeltRecord[];
};

/**
 * Parse dessert_metadata from a SessionRow into reducer hydrate fields.
 * Progress continues from elapsedMs; offset stays 0 unless stored progress implies one.
 */
export function meltFieldsFromDessertMetadata(
  raw: unknown,
  elapsedMs: number,
): MeltHydrateFields | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as Partial<DessertMetadata>;
  const history = Array.isArray(meta.history)
    ? (meta.history.filter(
        (h) => h && typeof h === "object" && h.config,
      ) as MeltRecord[])
    : [];
  const active = meta.active;
  if (!active?.config || typeof active.config !== "object") {
    if (history.length === 0) return null;
    return {
      meltConfig: null,
      meltAnimOffsetMs: 0,
      meltComplete: false,
      meltOutcomeAction: null,
      meltHistory: history,
    };
  }

  const config = active.config as MeltConfig;
  if (!config.kind || !config.containerId || !config.meltDurationMs) {
    return history.length
      ? {
          meltConfig: null,
          meltAnimOffsetMs: 0,
          meltComplete: false,
          meltOutcomeAction: null,
          meltHistory: history,
        }
      : null;
  }

  const duration = Math.max(1, Number(config.meltDurationMs) || 1);
  const storedProgress =
    typeof active.meltProgress === "number"
      ? Math.min(1, Math.max(0, active.meltProgress))
      : 0;
  // Prefer live elapsed when the stored snapshot is stale (start writes progress 0).
  const liveProgress = Math.min(1, Math.max(0, elapsedMs / duration));
  const useStoredOffset =
    storedProgress > 0.02 && Math.abs(storedProgress - liveProgress) > 0.05;
  const meltAnimOffsetMs = useStoredOffset
    ? Math.max(0, elapsedMs - storedProgress * duration)
    : 0;
  const meltComplete = Boolean(
    active.meltComplete || (elapsedMs - meltAnimOffsetMs) / duration >= 1,
  );

  return {
    meltConfig: config,
    meltAnimOffsetMs,
    meltComplete,
    meltOutcomeAction: active.outcomeAction ?? null,
    meltHistory: history,
  };
}
