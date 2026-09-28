export const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

export type MonthGridCell =
  | { kind: "empty"; key: string }
  | {
      kind: "day";
      key: string;
      date: string;
      dayNum: number;
      isToday: boolean;
    };

/** Sunday-start month grid, padded to full weeks. */
export function buildMonthGrid(year: number, month: number): MonthGridCell[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = first.getDay();
  const todayKey = toDayKey(new Date());

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ kind: "empty", key: `pad-start-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = toDayKey(new Date(year, month, day));
    cells.push({
      kind: "day",
      key: date,
      date,
      dayNum: day,
      isToday: date === todayKey,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ kind: "empty", key: `pad-end-${cells.length}` });
  }
  return cells;
}
