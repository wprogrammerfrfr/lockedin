export type BreakTypeId =
  | "hydration"
  | "doomscroll"
  | "touch_grass"
  | "bathroom"
  | "not_locked_in"
  | "snacking"
  | "stretching"
  | "zoning_out"
  | "petting_dog";

export type BreakTheme =
  | "sky"
  | "amber"
  | "emerald"
  | "slate"
  | "rose"
  | "orange"
  | "teal"
  | "violet"
  | "warm";

export type BreakTypeDef = {
  id: BreakTypeId;
  emoji: string;
  theme: BreakTheme;
  /** English live label (gerund). i18n via break.live.{id} */
  liveLabelEn: string;
  /** English receipt prefix. i18n via break.receipt.{id} */
  receiptLabelEn: string;
};

export const BREAK_TYPES: BreakTypeDef[] = [
  {
    id: "hydration",
    emoji: "💧",
    theme: "sky",
    liveLabelEn: "Hydrating",
    receiptLabelEn: "Break: hydrated for",
  },
  {
    id: "doomscroll",
    emoji: "📱",
    theme: "amber",
    liveLabelEn: "Doomscrolling",
    receiptLabelEn: "Break: doomscrolled for",
  },
  {
    id: "touch_grass",
    emoji: "🌿",
    theme: "emerald",
    liveLabelEn: "Touching grass",
    receiptLabelEn: "Break: touched grass for",
  },
  {
    id: "bathroom",
    emoji: "🚽",
    theme: "slate",
    liveLabelEn: "In the bathroom",
    receiptLabelEn: "Break: was in the bathroom for",
  },
  {
    id: "not_locked_in",
    emoji: "😶",
    theme: "rose",
    liveLabelEn: "Not locked in",
    receiptLabelEn: "Break: was not locked in for",
  },
  {
    id: "snacking",
    emoji: "🍿",
    theme: "orange",
    liveLabelEn: "Snacking",
    receiptLabelEn: "Break: snacked for",
  },
  {
    id: "stretching",
    emoji: "🧘",
    theme: "teal",
    liveLabelEn: "Stretching",
    receiptLabelEn: "Break: stretched for",
  },
  {
    id: "zoning_out",
    emoji: "💭",
    theme: "violet",
    liveLabelEn: "Zoning out",
    receiptLabelEn: "Break: zoned out for",
  },
  {
    id: "petting_dog",
    emoji: "🐕",
    theme: "warm",
    liveLabelEn: "Petting the dog",
    receiptLabelEn: "Break: petted the dog for",
  },
];

const BREAK_TYPE_MAP = new Map(BREAK_TYPES.map((t) => [t.id, t]));

export function getBreakType(id: BreakTypeId | string | null | undefined): BreakTypeDef | null {
  if (!id) return null;
  return BREAK_TYPE_MAP.get(id as BreakTypeId) ?? null;
}

export function pickRandomBreakType(exclude?: BreakTypeId): BreakTypeDef {
  const pool =
    exclude && BREAK_TYPES.length > 1
      ? BREAK_TYPES.filter((t) => t.id !== exclude)
      : BREAK_TYPES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Legacy stored ids plus new break type ids. */
export type BreakTypeStored = BreakTypeId | "dynamic" | "pomodoro" | "smart_alignment";

export type BreakSegment = {
  typeId: BreakTypeId;
  durationMs: number;
  openEnded: boolean;
};
