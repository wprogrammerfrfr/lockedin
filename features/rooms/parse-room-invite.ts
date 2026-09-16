const SIX_DIGIT = /^\d{6}$/;

/** Extract a 6-digit room code from pasted text or invite URLs. */
export function parseRoomCodeFromPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (SIX_DIGIT.test(trimmed)) return trimmed;

  try {
    const url = trimmed.startsWith("http")
      ? new URL(trimmed)
      : new URL(trimmed, "https://lockedin.local");
    const match = url.pathname.match(/\/rooms\/(\d{6})\/?$/i);
    if (match?.[1]) return match[1];
  } catch {
    /* not a URL */
  }

  const anywhere = trimmed.match(/(?:^|\D)(\d{6})(?:\D|$)/);
  return anywhere?.[1] ?? null;
}

export function roomInviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/rooms/${code}`;
}
