import type { BreakChoice, OutcomeKind, SessionState } from "./types";

export const HYDRATION_MS = 15 * 60 * 1000;
export const DOOMSCROLL_MS = 5 * 60 * 1000;
export const TOUCH_GRASS_MS = 8 * 60 * 1000;

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

/** Receipt footer total: always "X hours Y minutes" (floored to whole minutes). */
export function formatHoursMinutesWords(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const hourPart = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const minutePart = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  return `${hourPart} ${minutePart}`;
}

/** Summary card duration words; omits 0 hours / 0 minutes. */
export function formatHoursMinutesSecondsWords(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

/** Summary card line: "Locked in for …". */
export function lockedInForWords(ms: number) {
  return `Locked in for ${formatHoursMinutesSecondsWords(ms)}`;
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

export function minutesUntilNextHourMs(now = new Date()) {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const ms = next.getTime() - now.getTime();
  // At least 1 minute so a near-hour edge still starts a countdown
  return Math.max(60_000, ms);
}

export function buildBreakChoices(now = new Date()): BreakChoice[] {
  const smartMs = minutesUntilNextHourMs(now);
  const smartMins = Math.ceil(smartMs / 60_000);
  return [
    {
      id: "hydration",
      title: "15-minute Hydration Break",
      subtitle: "Water up. Reset the eyes.",
      emoji: "💧",
      group: "hydration",
      durationMs: HYDRATION_MS,
    },
    {
      id: "doomscroll",
      title: "Quick Doomscroll",
      subtitle: "Dynamic · 5 minutes",
      emoji: "📱",
      group: "dynamic",
      durationMs: DOOMSCROLL_MS,
    },
    {
      id: "touch_grass",
      title: "Touch Grass",
      subtitle: "Dynamic · 8 minutes",
      emoji: "🌿",
      group: "dynamic",
      durationMs: TOUCH_GRASS_MS,
    },
    {
      id: "smart_alignment",
      title: "Smart Alignment",
      subtitle: `${smartMins} min until top of the hour`,
      emoji: "⌛",
      group: "smart",
      durationMs: smartMs,
    },
  ];
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

type ShareEasterEgg = {
  id: "luck" | "sixtynine" | "sixtyseven" | "fourtwenty" | "fourohfour";
  test: (ms: number) => boolean;
  caption: string;
  chrome: ShareCardChrome;
};

/** Priority: luck → 69 → 67 → 420 → 404. First match wins. */
const SHARE_EASTER_EGGS: ShareEasterEgg[] = [
  {
    id: "luck",
    test: hasRepeatingClock,
    caption: "used up all the luck.",
    chrome: {
      headline: "used up all the luck",
      emoji: "🍀",
      gradient: "from-amber-200 via-yellow-100 to-lime-100",
      footerLabel: "luck",
    },
  },
  {
    id: "sixtynine",
    test: hasSixtyNine,
    caption: "nice. 👍",
    chrome: {
      headline: "nice.",
      emoji: "👍",
      gradient: LIME_GRADIENT,
      footerLabel: "LOCKED IN",
    },
  },
  {
    id: "sixtyseven",
    test: hasSixtySeven,
    caption: "six seven hehe. 😏",
    chrome: {
      headline: "six seven",
      emoji: "😏",
      gradient: LIME_GRADIENT,
      footerLabel: "LOCKED IN",
    },
  },
  {
    id: "fourtwenty",
    test: hasFourTwenty,
    caption: "blaze it.",
    chrome: {
      headline: "4:20",
      emoji: "🔥",
      gradient: LIME_GRADIENT,
      footerLabel: "LOCKED IN",
    },
  },
  {
    id: "fourohfour",
    test: hasFourOhFour,
    caption: "session not found.",
    chrome: {
      headline: "404",
      emoji: "📭",
      gradient: "from-slate-200 via-zinc-100 to-slate-100",
      footerLabel: "LOCKED IN",
    },
  },
];

export function findShareEasterEgg(ms: number): ShareEasterEgg | null {
  return SHARE_EASTER_EGGS.find((egg) => egg.test(ms)) ?? null;
}

const CAPTION_TIERS: { maxMs: number; lines: string[] }[] = [
  { maxMs: 60_000, lines: ["brev.", "great work buddy 😭", "wow."] },
  { maxMs: 5 * 60_000, lines: ["a start.", "warmup.", "we'll allow it."] },
  {
    maxMs: 15 * 60_000,
    lines: ["getting somewhere.", "not nothing.", "solid-ish."],
  },
  {
    maxMs: 30 * 60_000,
    lines: ["that's a session.", "phone lost.", "actually locked in."],
  },
  {
    maxMs: 60 * 60_000,
    lines: [
      "that's real work.",
      "the chair respects you.",
      "hour-adjacent. proud.",
    ],
  },
  {
    maxMs: 2 * 60 * 60_000,
    lines: ["one hour. unwell in a good way.", "goated.", "touch grass later."],
  },
  {
    maxMs: 4 * 60 * 60_000,
    lines: [
      "seek help (affectionate).",
      "this is a lifestyle.",
      "stand up. legend.",
    ],
  },
  {
    maxMs: Number.POSITIVE_INFINITY,
    lines: [
      "please eat.",
      "the session is dating you.",
      "historic. concerning. both.",
    ],
  },
];

function pickLine(lines: string[], rng: () => number) {
  const i = Math.min(lines.length - 1, Math.floor(rng() * lines.length));
  return lines[i] ?? lines[0]!;
}

/**
 * Duration-tiered share caption. Sub-second and easter eggs win.
 * `outcome` is unused (duration is the signal); kept for call-site compat.
 */
export function buildShareCaption(
  ms: number,
  _outcome?: OutcomeKind,
  rng: () => number = Math.random,
) {
  if (ms < 1000) return "DAWG 😭😭😭";
  const egg = findShareEasterEgg(ms);
  if (egg) return egg.caption;
  const clamped = Math.max(0, ms);
  const tier =
    CAPTION_TIERS.find((t) => clamped < t.maxMs) ??
    CAPTION_TIERS[CAPTION_TIERS.length - 1]!;
  return pickLine(tier.lines, rng);
}

function durationChrome(ms: number): ShareCardChrome {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 15 * 60) {
    return {
      headline: "LOCKED IN",
      emoji: "😏",
      gradient: LIME_GRADIENT,
      footerLabel: "LOCKED IN",
    };
  }
  if (totalSec < 60 * 60) {
    return {
      headline: "SOLID SESSION",
      emoji: "😏",
      gradient: LIME_GRADIENT,
      footerLabel: "SOLID SESSION",
    };
  }
  return {
    headline: "SOLID SESSION",
    emoji: "😏",
    gradient: "from-amber-200 via-yellow-100 to-orange-100",
    footerLabel: "SOLID SESSION",
  };
}

/** Headline / emoji / gradient from duration (and PR / easter egg overrides). */
export function shareCardChrome(
  ms: number,
  outcome: OutcomeKind,
): ShareCardChrome {
  const egg = findShareEasterEgg(ms);
  if (egg) return egg.chrome;
  if (outcome === "pr") {
    return {
      ...durationChrome(ms),
      headline: "NEW PR",
      emoji: "😎✌️",
      gradient: "from-lime-300 via-emerald-200 to-amber-200",
      footerLabel: "NEW PR",
    };
  }
  if (outcome === "tapout") {
    return {
      ...durationChrome(ms),
      headline: "TAP OUT",
      emoji: "😤",
      gradient: "from-rose-200 via-orange-100 to-slate-100",
      footerLabel: "TAP OUT",
    };
  }
  return durationChrome(ms);
}

const BREAK_TYPE_LABELS: Record<string, string> = {
  hydration: "Hydration",
  doomscroll: "Doomscroll",
  touch_grass: "Touch grass",
  dynamic: "Dynamic",
  smart_alignment: "Smart alignment",
  smart: "Smart alignment",
  pomodoro: "Pomodoro",
};

/** Human labels for stored break type ids. Prefer specific choices over group `dynamic`. */
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
  const hasSpecificDynamic =
    keys.includes("doomscroll") || keys.includes("touch_grass");
  const out: string[] = [];
  for (const key of keys) {
    if (key === "dynamic" && hasSpecificDynamic) continue;
    out.push(BREAK_TYPE_LABELS[key] ?? key.replace(/_/g, " "));
  }
  return out;
}

/** Prefer specific choice ids; used for receipt break duration labels. */
export function breakDurationLabel(raw: unknown): string {
  const keys = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const key = String(item ?? "").trim().toLowerCase();
      if (key) keys.add(key);
    }
  }
  if (keys.has("doomscroll")) return "Break: doomscrolled for";
  if (keys.has("touch_grass")) return "Break: touched grass for";
  return "Break: rested for";
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
    return "TAP OUT";
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
