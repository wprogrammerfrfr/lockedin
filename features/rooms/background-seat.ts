/** iOS and installed PWAs fire pagehide on app switch. That must not leave the room. */
export function backgroundKeepsRoomSeat(input: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}): boolean {
  const ios =
    /iPad|iPhone|iPod/.test(input.userAgent) ||
    (input.platform === "MacIntel" && (input.maxTouchPoints ?? 0) > 1);
  return ios || Boolean(input.standalone);
}
