export type OfflineOp =
  | {
      kind: "heartbeat";
      sessionId: string;
      activeMs: number;
      breakMs: number;
      breakTypes: unknown;
      status: string;
      at: number;
    }
  | {
      kind: "end" | "tap_out";
      sessionId: string;
      activeMs: number;
      breakMs: number;
      breakTypes: unknown;
      outcome: string;
      prBroken: boolean;
      at: number;
    };

const STORAGE_KEY = "lockedin.offlineQueue";

export function isLikelyOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function readQueue(): OfflineOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: OfflineOp[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

export async function enqueueOfflineOp(op: OfflineOp) {
  const q = readQueue();
  q.push(op);
  writeQueue(q);
}

export function peekOfflineQueue() {
  return readQueue();
}

export function clearOfflineQueue() {
  writeQueue([]);
}

/** Replay queued heartbeats / end / tap-out when back online. */
export async function replayOfflineQueue(
  run: (op: OfflineOp) => Promise<void>,
) {
  const q = readQueue();
  if (q.length === 0) return { replayed: 0 };

  const remaining: OfflineOp[] = [];
  let replayed = 0;

  for (const op of q) {
    try {
      await run(op);
      replayed += 1;
    } catch {
      remaining.push(op);
    }
  }

  writeQueue(remaining);
  return { replayed, remaining: remaining.length };
}
