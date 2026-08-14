export function majorityBreakResult(
  breakVotes: number,
  stayVotes: number,
  eligible: number,
): "break" | "stay" {
  const stay =
    stayVotes + Math.max(eligible - (breakVotes + stayVotes), 0);
  return breakVotes > stay ? "break" : "stay";
}
