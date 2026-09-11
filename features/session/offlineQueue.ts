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
      breakHistory?: unknown;
      outcome: string;
      prBroken: boolean;
      dessertMetadata?: unknown;
      at: number;
    };

const STORAGE_KEY = "lockedin.offlineQueue";
const LOCK_KEY = "lockedin.offlineQueue.lock";
const LOCK_TTL_MS = 15_000;

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    // Safari private browsing and storage pressure can reject localStorage.
  }
}

function tryAcquireReplayLock(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    const now = Date.now();
    if (raw) {
      const ts = Number(raw);
      if (Number.isFinite(ts) && now - ts < LOCK_TTL_MS) return false;
    }
    localStorage.setItem(LOCK_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

function releaseReplayLock() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
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
  if (!tryAcquireReplayLock()) return { replayed: 0, remaining: readQueue().length };

  try {
    const q = readQueue();
    if (q.length === 0) return { replayed: 0 };

    // Clear the snapshot first. If a replay discovers that the device is still
    // offline, sync.ts will enqueue a fresh copy that must not be overwritten.
    writeQueue([]);
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

    const requeued = readQueue();
    writeQueue([...remaining, ...requeued]);
    return { replayed, remaining: remaining.length + requeued.length };
  } finally {
    releaseReplayLock();
  }
}
