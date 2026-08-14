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

/** Two-digit centiseconds (`00`–`99`), not full milliseconds. */
export function formatCentiseconds(ms: number) {
  const cs = Math.floor((Math.max(0, ms) % 1000) / 10);
  return String(cs).padStart(2, "0");
}

/** Six-seven meme: 67 as a unit, or 6 sitting next to 7 on the clock. */
export function hasSixtySeven(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  return (
    totalSec === 67 ||
    totalMin === 67 ||
    hours === 67 ||
    (minutes === 6 && seconds === 7) ||
    (hours === 6 && minutes === 7) ||
    String(hours).includes("67")
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

const SIX_SEVEN_CAPTION = "six seven hehe. 😏";

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
 * Duration-tiered share caption. 67 easter egg always wins.
 * `outcome` is unused (duration is the signal); kept for call-site compat.
 */
export function buildShareCaption(
  ms: number,
  _outcome?: OutcomeKind,
  rng: () => number = Math.random,
) {
  if (hasSixtySeven(ms)) return SIX_SEVEN_CAPTION;
  const clamped = Math.max(0, ms);
  const tier =
    CAPTION_TIERS.find((t) => clamped < t.maxMs) ??
    CAPTION_TIERS[CAPTION_TIERS.length - 1]!;
  return pickLine(tier.lines, rng);
}

export type ShareCardChrome = {
  headline: string;
  emoji: string;
  gradient: string;
  footerLabel: string;
};

function durationChrome(ms: number): ShareCardChrome {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) {
    return {
      headline: "Took the L",
      emoji: "😭",
      gradient: "from-red-200 via-rose-100 to-slate-200",
      footerLabel: "L state",
    };
  }
  if (totalSec < 15 * 60) {
    return {
      headline: "Session card",
      emoji: "😏",
      gradient: "from-emerald-200 via-lime-100 to-slate-100",
      footerLabel: "Session card",
    };
  }
  if (totalSec < 60 * 60) {
    return {
      headline: "Solid session",
      emoji: "😏",
      gradient: "from-emerald-200 via-lime-100 to-slate-100",
      footerLabel: "Session card",
    };
  }
  return {
    headline: "Unwell (complimentary)",
    emoji: "😏",
    gradient: "from-amber-200 via-yellow-100 to-orange-100",
    footerLabel: "Session card",
  };
}

/** Headline / emoji / gradient from duration (and PR / 67 overrides). */
export function shareCardChrome(
  ms: number,
  outcome: OutcomeKind,
): ShareCardChrome {
  if (hasSixtySeven(ms)) {
    return {
      headline: "six seven",
      emoji: "😏",
      gradient: "from-emerald-200 via-lime-100 to-slate-100",
      footerLabel: "Session card",
    };
  }
  if (outcome === "pr") {
    return {
      ...durationChrome(ms),
      headline: "New PR unlocked",
      emoji: "😎✌️",
      gradient: "from-lime-300 via-emerald-200 to-amber-200",
      footerLabel: "Win state",
    };
  }
  return durationChrome(ms);
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
