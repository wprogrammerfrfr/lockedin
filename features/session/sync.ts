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
 * Best-effort end_session during pagehide/beforeunload.
 * Always pair with enqueueOfflineOp so a failed beacon still replays later.
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
  },
): Promise<SessionRow> {
  const params: {
    p_session_name: string | null;
    p_client_id: string;
    p_room_session_id?: string;
  } = {
    p_session_name: opts.sessionName?.trim() || null,
    p_client_id: opts.clientId,
  };
  if (opts.roomSessionId) {
    params.p_room_session_id = opts.roomSessionId;
  }
  const { data, error } = await supabase.rpc("start_session", params);

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
    outcome: string;
    prBroken: boolean;
  },
): Promise<SessionRow | null> {
  if (isLikelyOffline()) {
    await enqueueOfflineOp({
      kind: "end",
      sessionId: opts.id,
      activeMs: opts.activeMs,
      breakMs: opts.breakMs,
      breakTypes: opts.breakTypes,
      outcome: opts.outcome,
      prBroken: opts.prBroken,
      at: Date.now(),
    });
    return null;
  }

  const { data, error } = await supabase.rpc("end_session", {
    p_id: opts.id,
    p_active_ms: Math.round(opts.activeMs),
    p_break_ms: Math.round(opts.breakMs),
    p_break_types: opts.breakTypes ?? [],
    p_outcome: opts.outcome,
    p_pr_broken: opts.prBroken,
  });

  if (error) {
    if (isAlreadyTerminalError(error)) return null;
    if (isLikelyOffline() || /fetch|network|failed/i.test(error.message)) {
      await enqueueOfflineOp({
        kind: "end",
        sessionId: opts.id,
        activeMs: opts.activeMs,
        breakMs: opts.breakMs,
        breakTypes: opts.breakTypes,
        outcome: opts.outcome,
        prBroken: opts.prBroken,
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
    outcome?: string;
    prBroken?: boolean;
  },
): Promise<SessionRow | null> {
  if (isLikelyOffline()) {
    await enqueueOfflineOp({
      kind: "tap_out",
      sessionId: opts.id,
      activeMs: opts.activeMs,
      breakMs: opts.breakMs,
      breakTypes: opts.breakTypes,
      outcome: opts.outcome ?? "tapout",
      prBroken: opts.prBroken ?? false,
      at: Date.now(),
    });
    return null;
  }

  const { data, error } = await supabase.rpc("tap_out_session", {
    p_id: opts.id,
    p_active_ms: Math.round(opts.activeMs),
    p_break_ms: Math.round(opts.breakMs),
    p_break_types: opts.breakTypes ?? [],
    p_outcome: opts.outcome ?? "tapout",
    p_pr_broken: opts.prBroken ?? false,
  });

  if (error) {
    if (isAlreadyTerminalError(error)) return null;
    if (isLikelyOffline() || /fetch|network|failed/i.test(error.message)) {
      await enqueueOfflineOp({
        kind: "tap_out",
        sessionId: opts.id,
        activeMs: opts.activeMs,
        breakMs: opts.breakMs,
        breakTypes: opts.breakTypes,
        outcome: opts.outcome ?? "tapout",
        prBroken: opts.prBroken ?? false,
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
