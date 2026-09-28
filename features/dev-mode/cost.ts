/**
 * Subscription-style month count: every started month is billed in full.
 * Mar 4 → Mar 4 = 1, Apr 3 = 1, Apr 4 = 2.
 */
export function billingMonths(startIso: string, now: Date = new Date()): number {
  const start = new Date(startIso);
  const monthDiff =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  const daysInNowMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const anchorDay = Math.min(start.getDate(), daysInNowMonth);
  const months = monthDiff + (now.getDate() >= anchorDay ? 1 : 0);
  return Math.max(1, months);
}

export function buildCost(
  monthlyUsd: number | null | undefined,
  startIso: string | null | undefined,
  now: Date = new Date(),
): { months: number; total: number } | null {
  if (monthlyUsd == null || Number.isNaN(Number(monthlyUsd)) || !startIso) {
    return null;
  }
  const months = billingMonths(startIso, now);
  return { months, total: months * Number(monthlyUsd) };
}

export function formatUsd(n: number | null | undefined, fractionDigits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}
