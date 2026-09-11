import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionRow } from "@/types/database";
import {
  enqueueOfflineOp,
  isLikelyOffline,
} from "@/features/session/offlineQueue";

/** No heartbeat for this long → treat as abandoned (sleep / kill / crash). */
export const STALE_SESSION_MS = 3 * 60 * 1000;

export class ActiveSessionExistsError extends Error {
  readonly existing: SessionRow | null;

  constructor(message = "active_session_exists", existing: SessionRow | null = null) {
    super(message);
    this.name = "ActiveSessionExistsError";
    this.existing = existing;
  }
}

function isActiveExistsError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("active_session_exists") ||
    error.code === "active_session_exists"
  );
}

function isAlreadyTerminalError(error: { message?: string } | null) {
  if (!error?.message) return false;
  return /session_not_active/i.test(error.message);
}

/** Older deployed start_session may not accept p_dessert_metadata yet. */
function isDessertMetadataRpcError(error: { message?: string } | null) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("p_dessert_metadata") ||
    msg.includes("dessert_metadata") ||
    msg.includes("could not find the function") ||
    msg.includes("unknown argument") ||
    msg.includes("does not exist") ||
    (msg.includes("function") && msg.includes("start_session"))
  );
}

function isTerminalMetadataRpcError(error: { message?: string } | null) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("p_break_history") ||
    msg.includes("break_history") ||
    msg.includes("p_dessert_metadata") ||
    msg.includes("dessert_metadata") ||
    msg.includes("could not find the function") ||
    msg.includes("unknown argument") ||
    (msg.includes("function") &&
      (msg.includes("end_session") || msg.includes("tap_out_session")))
  );
}

function isAuthTokenError(error: { message?: string } | null) {
  if (!error?.message) return false;
  return /jwt|token.*expired|not_authenticated|not authenticated/i.test(
    error.message,
  );
}

function isTransientSyncError(error: { message?: string } | null) {
  if (!error?.message) return false;
  return /fetch|network|load failed|connection|offline|timeout|timed out|abort|cancelled|jwt|token.*expired|not_authenticated|not authenticated/i.test(
    error.message,
  );
}

async function refreshSessionIfNeeded(
  supabase: SupabaseClient,
  force = false,
) {
  const { data } = await supabase.auth.getSession();
  const expiresAt = data.session?.expires_at ?? 0;
  const expiresSoon = expiresAt * 1000 <= Date.now() + 60_000;
  if (force || expiresSoon) {
    await supabase.auth.refreshSession();
  }
}

async function invokeTerminalSession(
  supabase: SupabaseClient,
  fn: "end_session" | "tap_out_session",
  params: Record<string, unknown>,
) {
  try {
    await refreshSessionIfNeeded(supabase);
  } catch {
    // Let the RPC provide the actionable error; transient auth failures queue.
  }

  let result = await supabase.rpc(fn, params);
  if (result.error && isAuthTokenError(result.error)) {
    try {
      await refreshSessionIfNeeded(supabase, true);
      result = await supabase.rpc(fn, params);
    } catch {
      // The caller classifies the original auth failure as retryable.
    }
  }

  if (result.error && isTerminalMetadataRpcError(result.error)) {
    const legacy = { ...params };
    delete legacy.p_break_history;
    delete legacy.p_dessert_metadata;
    result = await supabase.rpc(fn, legacy);
  }
  return result;
}

async function invokeStartSession(
  supabase: SupabaseClient,
  params: {
    p_session_name: string | null;
    p_client_id: string;
    p_room_session_id?: string;
    p_dessert_metadata?: unknown;
  },
) {
  return supabase.rpc("start_session", params);
}

/**
 * Approximate last progress wall-time from started_at + active + break.
 * Heartbeats advance active_ms/break_ms; a large gap means the client died.
 */
export function isSessionStale(
  row: Pick<SessionRow, "started_at" | "active_ms" | "break_ms">,
  now = Date.now(),
  staleMs = STALE_SESSION_MS,
): boolean {
  const started = new Date(row.started_at).getTime();
  if (!Number.isFinite(started)) return true;
  const progressAt =
    started + (Number(row.active_ms) || 0) + (Number(row.break_ms) || 0);
  return now - progressAt > staleMs;
}

function supabaseRpcUrl(fn: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!base || !anonKey) return null;
  return { url: `${base}/rest/v1/rpc/${fn}`, anonKey };
}

/**
 * Best-effort heartbeat during pagehide/beforeunload so refresh does not end
 * the session. Pair with enqueueOfflineOp so a failed beacon still replays.
 */
export function heartbeatSessionKeepalive(
  opts: {
    id: string;
    activeMs: number;
    breakMs: number;
    breakTypes: unknown;
    status: "active" | "on_break";
  },
  accessToken: string | null | undefined,
): void {
  const rpc = supabaseRpcUrl("heartbeat_session");
  if (!rpc || !accessToken) return;

  try {
    void fetch(rpc.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: rpc.anonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        p_id: opts.id,
        p_active_ms: Math.round(opts.activeMs),
        p_break_ms: Math.round(opts.breakMs),
        p_break_types: opts.breakTypes ?? [],
        p_status: opts.status,
      }),
      keepalive: true,
    });
  } catch {
    /* unload — ignore */
  }
}

/**
 * Best-effort end_session beacon (explicit quit paths / legacy). Prefer ending
 * via the normal RPC; unload should use heartbeatSessionKeepalive instead.
 */
export function endSessionKeepalive(
  opts: {
    id: string;
    activeMs: number;
    breakMs: number;
    breakTypes: unknown;
    outcome: string;
    prBroken: boolean;
  },
  accessToken: string | null | undefined,
): void {
  const rpc = supabaseRpcUrl("end_session");
  if (!rpc || !accessToken) return;

  try {
    void fetch(rpc.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: rpc.anonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        p_id: opts.id,
        p_active_ms: Math.round(opts.activeMs),
        p_break_ms: Math.round(opts.breakMs),
        p_break_types: opts.breakTypes ?? [],
        p_outcome: opts.outcome,
        p_pr_broken: opts.prBroken,
      }),
      keepalive: true,
    });
  } catch {
    /* unload — ignore */
  }
}

export async function startSession(
  supabase: SupabaseClient,
  opts: {
    sessionName?: string | null;
    clientId: string;
    roomSessionId?: string | null;
    dessertMetadata?: unknown;
  },
): Promise<SessionRow> {
  const params: {
    p_session_name: string | null;
    p_client_id: string;
    p_room_session_id?: string;
    p_dessert_metadata?: unknown;
  } = {
    p_session_name: opts.sessionName?.trim() || null,
    p_client_id: opts.clientId,
  };
  if (opts.roomSessionId) {
    params.p_room_session_id = opts.roomSessionId;
  }
  let data: SessionRow | SessionRow[] | null = null;
  let error: { message?: string; code?: string } | null = null;

  if (opts.dessertMetadata) {
    params.p_dessert_metadata = opts.dessertMetadata;
    const first = await invokeStartSession(supabase, params);
    data = first.data as typeof data;
    error = first.error;
    if (error && isDessertMetadataRpcError(error)) {
      const legacy = { ...params };
      delete legacy.p_dessert_metadata;
      const retry = await invokeStartSession(supabase, legacy);
      data = retry.data as typeof data;
      error = retry.error;
    }
  } else {
    const result = await invokeStartSession(supabase, params);
    data = result.data as typeof data;
    error = result.error;
  }

  if (error) {
    if (isActiveExistsError(error)) {
      const existing = await resumeActiveSession(supabase);
      throw new ActiveSessionExistsError(error.message, existing);
    }
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as SessionRow | null;
  if (!row?.id) throw new Error("start_session returned no row");
  return row;
}

export async function heartbeatSession(
  supabase: SupabaseClient,
  opts: {
    id: string;
    activeMs: number;
    breakMs: number;
    breakTypes: unknown;
    status: string;
  },
): Promise<SessionRow | null> {
  if (isLikelyOffline()) {
    await enqueueOfflineOp({
      kind: "heartbeat",
      sessionId: opts.id,
      activeMs: opts.activeMs,
      breakMs: opts.breakMs,
      breakTypes: opts.breakTypes,
      status: opts.status,
      at: Date.now(),
    });
    return null;
  }

  const { data, error } = await supabase.rpc("heartbeat_session", {
    p_id: opts.id,
    p_active_ms: Math.round(opts.activeMs),
    p_break_ms: Math.round(opts.breakMs),
    p_break_types: opts.breakTypes ?? [],
    p_status: opts.status,
  });

  if (error) {
    if (isLikelyOffline() || /fetch|network|failed/i.test(error.message)) {
      await enqueueOfflineOp({
        kind: "heartbeat",
        sessionId: opts.id,
        activeMs: opts.activeMs,
        breakMs: opts.breakMs,
        breakTypes: opts.breakTypes,
        status: opts.status,
        at: Date.now(),
      });
      return null;
    }
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data[0] : data) as SessionRow | null;
}

export async function endSession(
  supabase: SupabaseClient,
  opts: {
    id: string;
    activeMs: number;
    breakMs: number;
    breakTypes: unknown;
    breakHistory?: unknown;
    outcome: string;
    prBroken: boolean;
    dessertMetadata?: unknown;
  },
): Promise<SessionRow | null> {
  if (isLikelyOffline()) {
    await enqueueOfflineOp({
      kind: "end",
      sessionId: opts.id,
      activeMs: opts.activeMs,
      breakMs: opts.breakMs,
      breakTypes: opts.breakTypes,
      breakHistory: opts.breakHistory,
      outcome: opts.outcome,
      prBroken: opts.prBroken,
      dessertMetadata: opts.dessertMetadata,
      at: Date.now(),
    });
    return null;
  }

  const { data, error } = await invokeTerminalSession(supabase, "end_session", {
    p_id: opts.id,
    p_active_ms: Math.round(opts.activeMs),
    p_break_ms: Math.round(opts.breakMs),
    p_break_types: opts.breakTypes ?? [],
    p_outcome: opts.outcome,
    p_pr_broken: opts.prBroken,
    p_break_history: opts.breakHistory ?? [],
    p_dessert_metadata: opts.dessertMetadata ?? null,
  });

  if (error) {
    if (isAlreadyTerminalError(error)) return null;
    if (isLikelyOffline() || isTransientSyncError(error)) {
      await enqueueOfflineOp({
        kind: "end",
        sessionId: opts.id,
        activeMs: opts.activeMs,
        breakMs: opts.breakMs,
        breakTypes: opts.breakTypes,
        breakHistory: opts.breakHistory,
        outcome: opts.outcome,
        prBroken: opts.prBroken,
        dessertMetadata: opts.dessertMetadata,
        at: Date.now(),
      });
      return null;
    }
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data[0] : data) as SessionRow | null;
}

export async function tapOutSession(
  supabase: SupabaseClient,
  opts: {
    id: string;
    activeMs: number;
    breakMs: number;
    breakTypes: unknown;
    breakHistory?: unknown;
    outcome?: string;
    prBroken?: boolean;
    dessertMetadata?: unknown;
  },
): Promise<SessionRow | null> {
  if (isLikelyOffline()) {
    await enqueueOfflineOp({
      kind: "tap_out",
      sessionId: opts.id,
      activeMs: opts.activeMs,
      breakMs: opts.breakMs,
      breakTypes: opts.breakTypes,
      breakHistory: opts.breakHistory,
      outcome: opts.outcome ?? "tapout",
      prBroken: opts.prBroken ?? false,
      dessertMetadata: opts.dessertMetadata,
      at: Date.now(),
    });
    return null;
  }

  const { data, error } = await invokeTerminalSession(
    supabase,
    "tap_out_session",
    {
    p_id: opts.id,
    p_active_ms: Math.round(opts.activeMs),
    p_break_ms: Math.round(opts.breakMs),
    p_break_types: opts.breakTypes ?? [],
    p_outcome: opts.outcome ?? "tapout",
    p_pr_broken: opts.prBroken ?? false,
    p_break_history: opts.breakHistory ?? [],
    p_dessert_metadata: opts.dessertMetadata ?? null,
    },
  );

  if (error) {
    if (isAlreadyTerminalError(error)) return null;
    if (isLikelyOffline() || isTransientSyncError(error)) {
      await enqueueOfflineOp({
        kind: "tap_out",
        sessionId: opts.id,
        activeMs: opts.activeMs,
        breakMs: opts.breakMs,
        breakTypes: opts.breakTypes,
        breakHistory: opts.breakHistory,
        outcome: opts.outcome ?? "tapout",
        prBroken: opts.prBroken ?? false,
        dessertMetadata: opts.dessertMetadata,
        at: Date.now(),
      });
      return null;
    }
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data[0] : data) as SessionRow | null;
}

export async function resumeActiveSession(
  supabase: SupabaseClient,
): Promise<SessionRow | null> {
  const { data, error } = await supabase.rpc("resume_active_session");
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (Array.isArray(data) ? data[0] : data) as SessionRow | null;
}
