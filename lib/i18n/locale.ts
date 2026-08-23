export type Locale = "en" | "tr" | "ko";

export function normalizeLocale(raw: string | null | undefined): Locale {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "tr" || v.startsWith("tr")) return "tr";
  if (v === "ko" || v.startsWith("ko")) return "ko";
  return "en";
}
