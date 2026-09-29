import { SESSION_GAP_MS } from "@/features/dev-mode/commit-time";
import { billingMonths } from "@/features/dev-mode/cost";

const DAY_MS = 86_400_000;

export type ActivityCommit = {
  committed_at: string;
  message?: string;
};

export type DayActivity = {
  key: string;
  commits: number;
  codingMs: number;
};

export type Chronotype = "morning" | "night" | "split";

export type LateNightSession = {
  start: number;
  end: number;
  commits: number;
};

export type ActivityStats = {
  commitCount: number;
  codingMs: number;
  months: number;
  days: number;
  avgHoursPerMonth: number;
  avgHoursPerDay: number;
  avgCommitsPerMonth: number;
  bestCommitDay: DayActivity | null;
  bestTimeDay: DayActivity | null;
  morningCommits: number;
  nightCommits: number;
  chronotype: Chronotype | null;
  fixCommits: number;
  lateNightCommits: number;
  /** Local days that include a commit from midnight up to 05:00. */
  lateNightDayKeys: string[];
  /** Local days that include a commit message containing "fix". */
  fixDayKeys: string[];
  /** Newest first. A run is included when any commit falls from midnight up to 05:00. */
  lateNightSessions: LateNightSession[];
};

const HOUR_MS = 3_600_000;

/** Under an hour in minutes. One hour or more stays in decimal hours. */
export function formatCodingDuration(hours: number): string {
  if (!(hours > 0)) return "0m";
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${Math.max(1, minutes)}m`;
  }
  return `${hours.toFixed(1)}h`;
}

/** Count-up tick that keeps the unit of the final duration. */
export function formatCodingDurationTick(finalHours: number, hours: number): string {
  if (finalHours >= 1) return `${Math.max(0, hours).toFixed(1)}h`;
  return formatCodingDuration(hours);
}

function localDayKey(time: number): string {
  const d = new Date(time);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Inclusive calendar days from the first commit through `now`, at least 1. */
function inclusiveDays(startIso: string, now: Date): number {
  const diff = startOfLocalDay(now) - startOfLocalDay(new Date(startIso));
  return Math.max(1, Math.round(diff / DAY_MS) + 1);
}

function isMorningHour(hour: number): boolean {
  return hour >= 5 && hour < 12;
}

function isNightHour(hour: number): boolean {
  return hour >= 18 || hour < 5;
}

function isLateNightHour(hour: number): boolean {
  return hour >= 0 && hour < 5;
}

function pickBest(
  days: DayActivity[],
  primary: (d: DayActivity) => number,
  secondary: (d: DayActivity) => number,
): DayActivity | null {
  if (days.length === 0) return null;
  return days.reduce((best, day) => {
    const primaryDiff = primary(day) - primary(best);
    if (primaryDiff > 0) return day;
    if (primaryDiff < 0) return best;
    const secondaryDiff = secondary(day) - secondary(best);
    if (secondaryDiff > 0) return day;
    if (secondaryDiff < 0) return best;
    return day.key > best.key ? day : best;
  });
}

const EMPTY: ActivityStats = {
  commitCount: 0,
  codingMs: 0,
  months: 0,
  days: 0,
  avgHoursPerMonth: 0,
  avgHoursPerDay: 0,
  avgCommitsPerMonth: 0,
  bestCommitDay: null,
  bestTimeDay: null,
  morningCommits: 0,
  nightCommits: 0,
  chronotype: null,
  fixCommits: 0,
  lateNightCommits: 0,
  lateNightDayKeys: [],
  fixDayKeys: [],
  lateNightSessions: [],
};

/**
 * Averages, best days, and commit-habit counts for one project.
 * Coding time uses the same 2-hour gap rule as the overview total.
 * A counted gap is assigned to the local day of the later commit.
 */
export function buildActivityStats(
  commits: ActivityCommit[],
  opts?: { startIso?: string | null; now?: Date },
): ActivityStats {
  const now = opts?.now ?? new Date();
  const parsed = commits
    .map((c) => ({
      time: new Date(c.committed_at).getTime(),
      message: c.message ?? "",
    }))
    .filter((c) => !Number.isNaN(c.time))
    .sort((a, b) => a.time - b.time);

  if (parsed.length === 0) return EMPTY;

  const byDay = new Map<string, DayActivity>();
  const bucket = (time: number): DayActivity => {
    const key = localDayKey(time);
    let row = byDay.get(key);
    if (!row) {
      row = { key, commits: 0, codingMs: 0 };
      byDay.set(key, row);
    }
    return row;
  };

  let codingMs = 0;
  let morningCommits = 0;
  let nightCommits = 0;
  let fixCommits = 0;
  let lateNightCommits = 0;
  const lateNightDayKeys = new Set<string>();
  const fixDayKeys = new Set<string>();
  const sessions: (LateNightSession & { late: boolean })[] = [];
  let open: (LateNightSession & { late: boolean }) | null = null;

  for (let i = 0; i < parsed.length; i++) {
    const current = parsed[i];
    const day = bucket(current.time);
    day.commits += 1;

    const hour = new Date(current.time).getHours();
    const late = isLateNightHour(hour);
    if (isMorningHour(hour)) morningCommits += 1;
    if (isNightHour(hour)) nightCommits += 1;
    if (late) {
      lateNightCommits += 1;
      lateNightDayKeys.add(day.key);
    }
    if (current.message.toLowerCase().includes("fix")) {
      fixCommits += 1;
      fixDayKeys.add(day.key);
    }

    const gap = i === 0 ? 0 : current.time - parsed[i - 1].time;
    const continues = i > 0 && gap >= 0 && gap <= SESSION_GAP_MS;
    if (open && continues) {
      open.end = current.time;
      open.commits += 1;
      if (late) open.late = true;
    } else {
      if (open) sessions.push(open);
      open = {
        start: current.time,
        end: current.time,
        commits: 1,
        late,
      };
    }

    if (i === 0) continue;
    if (gap > 0 && gap <= SESSION_GAP_MS) {
      codingMs += gap;
      day.codingMs += gap;
    }
  }
  if (open) sessions.push(open);

  const daysList = [...byDay.values()];
  const startIso =
    opts?.startIso || new Date(parsed[0].time).toISOString();
  const months = billingMonths(startIso, now);
  const days = inclusiveDays(startIso, now);
  const hours = codingMs / HOUR_MS;

  let chronotype: Chronotype;
  if (morningCommits > nightCommits) chronotype = "morning";
  else if (nightCommits > morningCommits) chronotype = "night";
  else chronotype = "split";

  return {
    commitCount: parsed.length,
    codingMs,
    months,
    days,
    avgHoursPerMonth: hours / months,
    avgHoursPerDay: hours / days,
    avgCommitsPerMonth: parsed.length / months,
    bestCommitDay: pickBest(
      daysList,
      (d) => d.commits,
      (d) => d.codingMs,
    ),
    bestTimeDay: pickBest(
      daysList,
      (d) => d.codingMs,
      (d) => d.commits,
    ),
    morningCommits,
    nightCommits,
    chronotype,
    fixCommits,
    lateNightCommits,
    lateNightDayKeys: [...lateNightDayKeys],
    fixDayKeys: [...fixDayKeys],
    lateNightSessions: sessions
      .filter((session) => session.late)
      .map(({ start, end, commits }) => ({ start, end, commits }))
      .reverse(),
  };
}
