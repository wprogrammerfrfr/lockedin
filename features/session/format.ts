import {
  getBreakType,
  type BreakSegment,
  type BreakTypeId,
} from "./break-types";
import type { OutcomeKind, SessionState } from "./types";

export function formatMs(ms: number, forceHours = false) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (forceHours || h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Share / summary copy: "Locked in for HH:MM:SS". */
export function lockedInForLabel(ms: number) {
  return `Locked in for ${formatMs(ms, true)}`;
}

/** Day-card copy: "You locked in for 1 hour 12 minutes". */
export function youLockedInForLabel(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const hourPart =
    hours <= 0
      ? null
      : `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const minutePart = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  if (hourPart) {
    return `You locked in for ${hourPart} ${minutePart}`;
  }
  return `You locked in for ${minutePart}`;
}

/**
 * Receipt footer total: hours + minutes (floored), or seconds-only when under 1 minute.
 */
export function formatHoursMinutesWords(ms: number, t?: TranslateFn) {
  const clamped = Math.max(0, ms);
  if (clamped < 60_000) {
    const seconds = Math.floor(clamped / 1000);
    return tr(t, "duration.memeFlatSeconds", "{seconds} seconds", {
      seconds,
    });
  }
  const totalMin = Math.floor(clamped / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const hourPart = `${hours} ${tr(
    t,
    hours === 1 ? "duration.unit.hour" : "duration.unit.hours",
    hours === 1 ? "hour" : "hours",
  )}`;
  const minutePart = `${minutes} ${tr(
    t,
    minutes === 1 ? "duration.unit.minute" : "duration.unit.minutes",
    minutes === 1 ? "minute" : "minutes",
  )}`;
  return `${hourPart} ${minutePart}`;
}

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function tr(
  t: TranslateFn | undefined,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  if (!t) {
    if (!params) return fallback;
    let out = fallback;
    for (const [k, value] of Object.entries(params)) {
      out = out.replaceAll(`{${k}}`, String(value));
    }
    return out;
  }
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

/** Exactly 67s or 69s — show flat seconds instead of 1m7s / 1m9s. */
export function isMemeFlatSecondDuration(ms: number): 67 | 69 | null {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec === 67) return 67;
  if (totalSec === 69) return 69;
  return null;
}

/** Summary card duration words; omits 0 hours / 0 minutes. */
export function formatHoursMinutesSecondsWords(
  ms: number,
  t?: TranslateFn,
) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(
      `${hours} ${tr(
        t,
        hours === 1 ? "duration.unit.hour" : "duration.unit.hours",
        hours === 1 ? "hour" : "hours",
      )}`,
    );
  }
  if (minutes > 0) {
    parts.push(
      `${minutes} ${tr(
        t,
        minutes === 1 ? "duration.unit.minute" : "duration.unit.minutes",
        minutes === 1 ? "minute" : "minutes",
      )}`,
    );
  }
  parts.push(
    `${seconds} ${tr(
      t,
      seconds === 1 ? "duration.unit.second" : "duration.unit.seconds",
      seconds === 1 ? "second" : "seconds",
    )}`,
  );
  return parts.join(" ");
}

/** Flat "67 seconds" / "69 seconds" for receipt rows when meme duration applies. */
export function formatMemeFlatSeconds(ms: number, t?: TranslateFn) {
  const flat = isMemeFlatSecondDuration(ms);
  if (!flat) return null;
  return tr(t, "duration.memeFlatSeconds", "{seconds} seconds", {
    seconds: flat,
  });
}

/** Summary card line: "Locked in for …" (flat seconds at 67s / 69s). */
export function lockedInForWords(ms: number, t?: TranslateFn) {
  const flat = isMemeFlatSecondDuration(ms);
  if (flat != null) {
    return tr(
      t,
      "duration.lockedInForMemeFlat",
      "Locked in for {seconds} seconds",
      { seconds: flat },
    );
  }
  const duration = formatHoursMinutesSecondsWords(ms, t);
  return tr(t, "duration.lockedInFor", "Locked in for {duration}", {
    duration,
  });
}

/**
 * Receipt locked-in / total value: flat meme seconds when 67/69,
 * otherwise fall back to the provided normal formatter result.
 */
export function formatReceiptDurationValue(
  ms: number,
  normal: string,
  t?: TranslateFn,
) {
  return formatMemeFlatSeconds(ms, t) ?? normal;
}

/** Two-digit centiseconds (`00`–`99`), not full milliseconds. */
export function formatCentiseconds(ms: number) {
  const cs = Math.floor((Math.max(0, ms) % 1000) / 10);
  return String(cs).padStart(2, "0");
}

type ClockParts = {
  hours: number;
  minutes: number;
  seconds: number;
  totalSec: number;
  totalMin: number;
};

function clockParts(ms: number): ClockParts {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalSec,
    totalMin: Math.floor(totalSec / 60),
  };
}

/** HH:MM:SS all equal and ≥ 1 (01:01:01 … 11:11:11). Ignores centiseconds. */
export function hasRepeatingClock(ms: number) {
  const { hours, minutes, seconds } = clockParts(ms);
  return hours >= 1 && hours === minutes && minutes === seconds;
}

/** Six-seven meme: 67 as a unit, or 6 sitting next to 7 on the clock. */
export function hasSixtySeven(ms: number) {
  const { hours, minutes, seconds, totalSec, totalMin } = clockParts(ms);
  return (
    totalSec === 67 ||
    totalMin === 67 ||
    hours === 67 ||
    (minutes === 6 && seconds === 7) ||
    (hours === 6 && minutes === 7) ||
    String(hours).includes("67")
  );
}

/** Nice: 69 as a unit, or 6 sitting next to 9 on the clock. */
export function hasSixtyNine(ms: number) {
  const { hours, minutes, seconds, totalSec, totalMin } = clockParts(ms);
  return (
    totalSec === 69 ||
    totalMin === 69 ||
    (minutes === 6 && seconds === 9) ||
    (hours === 6 && minutes === 9)
  );
}

/** 420: unit match or 4 sitting next to 20 on the clock. */
export function hasFourTwenty(ms: number) {
  const { hours, minutes, seconds, totalSec, totalMin } = clockParts(ms);
  return (
    totalSec === 420 ||
    totalMin === 420 ||
    (minutes === 4 && seconds === 20) ||
    (hours === 4 && minutes === 20)
  );
}

/** 404: unit match or 4:04 on the clock. */
export function hasFourOhFour(ms: number) {
  const { hours, minutes, seconds, totalSec, totalMin } = clockParts(ms);
  return (
    totalSec === 404 ||
    totalMin === 404 ||
    (minutes === 4 && seconds === 4) ||
    (hours === 4 && minutes === 4)
  );
}

export function outcomeEmoji(outcome: OutcomeKind) {
  switch (outcome) {
    case "pr":
      return "😎✌️";
    case "solid":
      return "😏";
    case "break":
      return "😑";
    case "tapout":
      return "😭";
    default:
      return "🙂";
  }
}

function unitLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

/** Human-readable duration, omitting zero units. */
export function formatDurationNatural(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(unitLabel(hours, "hour"));
  if (minutes > 0) parts.push(unitLabel(minutes, "minute"));
  if (seconds > 0 || parts.length === 0)
    parts.push(unitLabel(seconds, "second"));

  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
}

const LIME_GRADIENT = "from-emerald-200 via-lime-100 to-slate-100";

export type ShareCardChrome = {
  headline: string;
  emoji: string;
  gradient: string;
  footerLabel: string;
};

type ShareEasterEggDef = {
  id: "luck" | "sixtynine" | "sixtyseven" | "fourtwenty" | "fourohfour";
  test: (ms: number) => boolean;
  captionKey: string;
  captionFallback: string;
  headlineKey: string;
  headlineFallback: string;
  footerKey: string;
  footerFallback: string;
  emoji: string;
  gradient: string;
};

export type ShareEasterEgg = {
  id: ShareEasterEggDef["id"];
  test: (ms: number) => boolean;
  caption: string;
  chrome: ShareCardChrome;
};

/** Priority: luck → 69 → 67 → 420 → 404. First match wins. */
const SHARE_EASTER_EGGS: ShareEasterEggDef[] = [
  {
    id: "luck",
    test: hasRepeatingClock,
    captionKey: "caption.egg.luck",
    captionFallback: "used up all the luck.",
    headlineKey: "caption.egg.luck.headline",
    headlineFallback: "used up all the luck",
    footerKey: "chrome.footer.luck",
    footerFallback: "luck",
    emoji: "🍀",
    gradient: "from-amber-200 via-yellow-100 to-lime-100",
  },
  {
    id: "sixtynine",
    test: hasSixtyNine,
    captionKey: "caption.egg.sixtynine",
    captionFallback: "nice. 👍",
    headlineKey: "caption.egg.sixtynine.headline",
    headlineFallback: "nice.",
    footerKey: "chrome.footer.lockedIn",
    footerFallback: "LOCKED IN",
    emoji: "👍",
    gradient: LIME_GRADIENT,
  },
  {
    id: "sixtyseven",
    test: hasSixtySeven,
    captionKey: "caption.egg.sixtyseven",
    captionFallback: "six seven hehe. 😏",
    headlineKey: "caption.egg.sixtyseven.headline",
    headlineFallback: "six seven",
    footerKey: "chrome.footer.lockedIn",
    footerFallback: "LOCKED IN",
    emoji: "😏",
    gradient: LIME_GRADIENT,
  },
  {
    id: "fourtwenty",
    test: hasFourTwenty,
    captionKey: "caption.egg.fourtwenty",
    captionFallback: "blaze it.",
    headlineKey: "caption.egg.fourtwenty.headline",
    headlineFallback: "4:20",
    footerKey: "chrome.footer.lockedIn",
    footerFallback: "LOCKED IN",
    emoji: "🔥",
    gradient: LIME_GRADIENT,
  },
  {
    id: "fourohfour",
    test: hasFourOhFour,
    captionKey: "caption.egg.fourohfour",
    captionFallback: "session not found.",
    headlineKey: "caption.egg.fourohfour.headline",
    headlineFallback: "404",
    footerKey: "chrome.footer.lockedIn",
    footerFallback: "LOCKED IN",
    emoji: "📭",
    gradient: "from-slate-200 via-zinc-100 to-slate-100",
  },
];

function resolveEasterEgg(
  def: ShareEasterEggDef,
  t?: TranslateFn,
): ShareEasterEgg {
  return {
    id: def.id,
    test: def.test,
    caption: tr(t, def.captionKey, def.captionFallback),
    chrome: {
      headline: tr(t, def.headlineKey, def.headlineFallback),
      emoji: def.emoji,
      gradient: def.gradient,
      footerLabel: tr(t, def.footerKey, def.footerFallback),
    },
  };
}

export function findShareEasterEgg(
  ms: number,
  t?: TranslateFn,
): ShareEasterEgg | null {
  const def = SHARE_EASTER_EGGS.find((egg) => egg.test(ms));
  return def ? resolveEasterEgg(def, t) : null;
}

const CAPTION_TIERS: { maxMs: number; keys: string[]; fallbacks: string[] }[] =
  [
    {
      maxMs: 60_000,
      keys: [
        "caption.tier.lt1m.0",
        "caption.tier.lt1m.1",
        "caption.tier.lt1m.2",
      ],
      fallbacks: ["brev.", "great work buddy 😭", "wow."],
    },
    {
      maxMs: 5 * 60_000,
      keys: [
        "caption.tier.lt5m.0",
        "caption.tier.lt5m.1",
        "caption.tier.lt5m.2",
      ],
      fallbacks: ["a start.", "warmup.", "we'll allow it."],
    },
    {
      maxMs: 15 * 60_000,
      keys: [
        "caption.tier.lt15m.0",
        "caption.tier.lt15m.1",
        "caption.tier.lt15m.2",
      ],
      fallbacks: ["getting somewhere.", "not nothing.", "solid-ish."],
    },
    {
      maxMs: 30 * 60_000,
      keys: [
        "caption.tier.lt30m.0",
        "caption.tier.lt30m.1",
        "caption.tier.lt30m.2",
      ],
      fallbacks: ["that's a session.", "phone lost.", "actually locked in."],
    },
    {
      maxMs: 60 * 60_000,
      keys: [
        "caption.tier.lt1h.0",
        "caption.tier.lt1h.1",
        "caption.tier.lt1h.2",
      ],
      fallbacks: [
        "that's real work.",
        "the chair respects you.",
        "hour-adjacent. proud.",
      ],
    },
    {
      maxMs: 2 * 60 * 60_000,
      keys: [
        "caption.tier.lt2h.0",
        "caption.tier.lt2h.1",
        "caption.tier.lt2h.2",
      ],
      fallbacks: [
        "one hour. unwell in a good way.",
        "goated.",
        "touch grass later.",
      ],
    },
    {
      maxMs: 4 * 60 * 60_000,
      keys: [
        "caption.tier.lt4h.0",
        "caption.tier.lt4h.1",
        "caption.tier.lt4h.2",
      ],
      fallbacks: [
        "seek help (affectionate).",
        "this is a lifestyle.",
        "stand up. legend.",
      ],
    },
    {
      maxMs: Number.POSITIVE_INFINITY,
      keys: [
        "caption.tier.gte4h.0",
        "caption.tier.gte4h.1",
        "caption.tier.gte4h.2",
      ],
      fallbacks: [
        "please eat.",
        "the session is dating you.",
        "historic. concerning. both.",
      ],
    },
  ];

function pickIndex(length: number, rng: () => number) {
  return Math.min(length - 1, Math.floor(rng() * length));
}

/**
 * Duration-tiered share caption. Sub-second and easter eggs win.
 * `outcome` is unused (duration is the signal); kept for call-site compat.
 */
export function buildShareCaption(
  ms: number,
  _outcome?: OutcomeKind,
  rng: () => number = Math.random,
  t?: TranslateFn,
) {
  if (ms < 1000) return tr(t, "caption.instant", "DAWG 😭😭😭");
  const egg = findShareEasterEgg(ms, t);
  if (egg) return egg.caption;
  const clamped = Math.max(0, ms);
  const tier =
    CAPTION_TIERS.find((entry) => clamped < entry.maxMs) ??
    CAPTION_TIERS[CAPTION_TIERS.length - 1]!;
  const i = pickIndex(tier.keys.length, rng);
  return tr(t, tier.keys[i]!, tier.fallbacks[i]!);
}

function durationChrome(ms: number, t?: TranslateFn): ShareCardChrome {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const lockedIn = tr(t, "chrome.footer.lockedIn", "LOCKED IN");
  const solid = tr(t, "chrome.footer.solidSession", "SOLID SESSION");
  if (totalSec < 15 * 60) {
    return {
      headline: lockedIn,
      emoji: "😏",
      gradient: LIME_GRADIENT,
      footerLabel: lockedIn,
    };
  }
  if (totalSec < 60 * 60) {
    return {
      headline: solid,
      emoji: "😏",
      gradient: LIME_GRADIENT,
      footerLabel: solid,
    };
  }
  return {
    headline: solid,
    emoji: "😏",
    gradient: "from-amber-200 via-yellow-100 to-orange-100",
    footerLabel: solid,
  };
}

/** Headline / emoji / gradient from duration (and PR / easter egg overrides). */
export function shareCardChrome(
  ms: number,
  outcome: OutcomeKind,
  t?: TranslateFn,
): ShareCardChrome {
  const egg = findShareEasterEgg(ms, t);
  if (egg) return egg.chrome;
  if (outcome === "pr") {
    const label = tr(t, "chrome.footer.newPr", "NEW PR");
    return {
      ...durationChrome(ms, t),
      headline: label,
      emoji: "😎✌️",
      gradient: "from-lime-300 via-emerald-200 to-amber-200",
      footerLabel: label,
    };
  }
  if (outcome === "tapout") {
    const label = tr(t, "chrome.footer.tapOut", "TAP OUT");
    return {
      ...durationChrome(ms, t),
      headline: label,
      emoji: "😤",
      gradient: "from-rose-200 via-orange-100 to-slate-100",
      footerLabel: label,
    };
  }
  return durationChrome(ms, t);
}

const BREAK_TYPE_LABELS: Record<string, string> = {
  hydration: "Hydration",
  doomscroll: "Doomscroll",
  touch_grass: "Touch grass",
  bathroom: "Bathroom",
  not_locked_in: "Not locked in",
  snacking: "Snacking",
  stretching: "Stretching",
  zoning_out: "Zoning out",
  petting_dog: "Petting the dog",
  dynamic: "Dynamic",
  pomodoro: "Pomodoro",
};

/** Human labels for stored break type ids. */
export function formatBreakTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = String(item ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  const out: string[] = [];
  for (const key of keys) {
    if (key === "dynamic") continue;
    out.push(BREAK_TYPE_LABELS[key] ?? key.replace(/_/g, " "));
  }
  return out;
}

export function breakReceiptLabel(
  typeId: BreakTypeId | string,
  liveLabel?: (key: string) => string,
): string {
  const key = `break.receipt.${typeId}`;
  if (liveLabel) {
    const translated = liveLabel(key);
    if (translated !== key) return translated;
  }
  const def = getBreakType(typeId);
  return def?.receiptLabelEn ?? "Break: rested for";
}

/** Live break status label only (e.g. "Snacking" / "Atıştırıyor"). Timer shows duration. */
export function buildBreakLiveLabel(
  typeId: BreakTypeId,
  _elapsedMs: number,
  liveLabel?: (key: string, params?: Record<string, string | number>) => string,
): string {
  const key = `break.live.${typeId}`;
  if (liveLabel && liveLabel(key) !== key) return liveLabel(key);
  return getBreakType(typeId)?.liveLabelEn ?? "On break";
}

/** Legacy fallback for sessions without break_history. */
export function breakDurationLabel(
  raw: unknown,
  liveLabel?: TranslateFn,
): string {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const key = String(item ?? "").trim().toLowerCase();
      const def = getBreakType(key);
      if (def) return breakReceiptLabel(def.id, liveLabel);
    }
  }
  return breakReceiptLabel("fallback", liveLabel);
}

export function breakHistoryFromLegacy(
  breakTypesUsed: unknown,
  breakMs: number,
): BreakSegment[] {
  if (!Array.isArray(breakTypesUsed) || breakMs <= 0) return [];
  for (let i = breakTypesUsed.length - 1; i >= 0; i--) {
    const key = String(breakTypesUsed[i] ?? "").trim().toLowerCase();
    const def = getBreakType(key);
    if (def) {
      return [{ typeId: def.id, durationMs: breakMs, openEnded: true }];
    }
  }
  return [];
}

/** Total hours label for lifetime stats (e.g. "12.5h"). */
export function formatTotalHours(ms: number): string {
  const hours = Math.max(0, ms) / 3_600_000;
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

/** Outcome label for receipt footers. */
export function receiptOutcomeLabel(
  outcome: OutcomeKind | string | null | undefined,
  prBroken?: boolean,
): string {
  if (prBroken || outcome === "pr") return "NEW PR";
  if (outcome === "tapout" || outcome === "tapped_out" || outcome === "left_early") {
    return "Finish";
  }
  if (outcome === "break") return "BREAK";
  return "LOCKED IN";
}

export function resolveOutcome(
  session: SessionState,
  lastOutcome: OutcomeKind,
  didBreakPR: boolean,
): OutcomeKind {
  if (
    session === "ON_BREAK" ||
    session === "CHOOSING_BREAK" ||
    session === "BREAK_DONE"
  ) {
    return "break";
  }
  if (session === "TAPPED_OUT") return "tapout";
  if (didBreakPR || lastOutcome === "pr") return "pr";
  if (session === "LOCKED_IN") return "solid";
  if (session === "ENDED") return lastOutcome === "idle" ? "solid" : lastOutcome;
  return lastOutcome === "idle" ? "idle" : lastOutcome;
}
