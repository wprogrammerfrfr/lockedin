const STORAGE_KEY = "lockedin.breakTimerMinutes";
export const DEFAULT_BREAK_TIMER_MINUTES = 15;
export const BREAK_TIMER_PRESETS = [5, 10, 15, 20, 30] as const;

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadBreakTimerMinutes(): number {
  if (!canUseStorage()) return DEFAULT_BREAK_TIMER_MINUTES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BREAK_TIMER_MINUTES;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 120) return DEFAULT_BREAK_TIMER_MINUTES;
    return n;
  } catch {
    return DEFAULT_BREAK_TIMER_MINUTES;
  }
}

export function saveBreakTimerMinutes(minutes: number): void {
  if (!canUseStorage()) return;
  const clamped = Math.min(120, Math.max(1, Math.round(minutes)));
  localStorage.setItem(STORAGE_KEY, String(clamped));
}

export function breakTimerMs(minutes = loadBreakTimerMinutes()): number {
  return minutes * 60 * 1000;
}
