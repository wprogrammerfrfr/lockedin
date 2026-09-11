import type { SupabaseClient } from "@supabase/supabase-js";
import type { BreakTypeStored } from "@/features/session/types";
import { STALE_SESSION_MS } from "@/features/session/sync";

const LOCAL_DRAFTS_KEY = "lockedin.sessionDrafts";
const ACTIVE_DRAFT_KEY = "lockedin.activeSessionDraft";
const MERGE_LOCK_KEY = "lockedin.mergeLock";

export type SessionDraft = {
  id: string;
  sessionName: string | null;
  elapsedMs: number;
  breakMs?: number;
  outcome: string;
  breakTypesUsed: BreakTypeStored[];
  /** ISO start; when missing, derived as endedAt - elapsedMs. */
  startedAt?: string;
  endedAt: string;
  source: "local" | "anonymous";
};

/** In-progress guest session — written periodically / on hide; finalized on unload. */
export type ActiveSessionDraft = {
  sessionName: string | null;
  elapsedMs: number;
  breakMs: number;
  breakTypesUsed: BreakTypeStored[];
  personalRecordMs: number;
  didBreakPR: boolean;
  updatedAt: string;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Read local session drafts written while guest / offline. */
export function loadLocalSessionDrafts(): SessionDraft[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(LOCAL_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist a finished local session for later merge after signup. */
export function saveLocalSessionDraft(
  draft: Omit<SessionDraft, "id" | "endedAt" | "source"> & {
    endedAt?: string;
    startedAt?: string;
  },
): SessionDraft {
  const endedAt = draft.endedAt || new Date().toISOString();
  const activeMs = Math.max(0, Math.round(draft.elapsedMs));
  const startedAt =
    draft.startedAt ||
    new Date(new Date(endedAt).getTime() - activeMs).toISOString();
  const entry: SessionDraft = {
    sessionName: draft.sessionName,
    elapsedMs: draft.elapsedMs,
    breakMs: draft.breakMs ?? 0,
    outcome: draft.outcome,
    breakTypesUsed: draft.breakTypesUsed,
    startedAt,
    endedAt,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `draft_${Date.now()}`,
    source: "local",
  };

  if (canUseLocalStorage()) {
    const existing = loadLocalSessionDrafts();
    localStorage.setItem(
      LOCAL_DRAFTS_KEY,
      JSON.stringify([...existing, entry]),
    );
  }

  return entry;
}

export function clearLocalSessionDrafts() {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(LOCAL_DRAFTS_KEY);
}

export function loadActiveSessionDraft(): ActiveSessionDraft | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(ACTIVE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSessionDraft;
    if (!parsed || typeof parsed.elapsedMs !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveSessionDraft(
  draft: Omit<ActiveSessionDraft, "updatedAt">,
): void {
  if (!canUseLocalStorage()) return;
  const entry: ActiveSessionDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(ACTIVE_DRAFT_KEY, JSON.stringify(entry));
}

export function clearActiveSessionDraft() {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(ACTIVE_DRAFT_KEY);
}

export function isActiveSessionDraftStale(
  draft: ActiveSessionDraft,
  now = Date.now(),
  staleMs = STALE_SESSION_MS,
): boolean {
  const updated = new Date(draft.updatedAt).getTime();
  if (!Number.isFinite(updated)) return true;
  return now - updated > staleMs;
}

/**
 * Promote in-progress guest draft to a finished local draft (unexpected close).
 * Returns the finished draft, or null if nothing to finalize.
 */
export function finalizeActiveSessionDraft(
  outcomeOverride?: string,
  didBreakPROverride?: boolean,
): SessionDraft | null {
  const active = loadActiveSessionDraft();
  if (!active) return null;
  if ((active.elapsedMs || 0) <= 0) {
    clearActiveSessionDraft();
    return null;
  }

  const didBreakPR =
    didBreakPROverride ??
    (active.didBreakPR ||
      (active.personalRecordMs > 0 &&
        active.elapsedMs > active.personalRecordMs) ||
      (active.personalRecordMs === 0 && active.elapsedMs > 0));
  const outcome =
    outcomeOverride ?? (didBreakPR ? "pr" : "solid");

  const finished = saveLocalSessionDraft({
    sessionName: active.sessionName,
    elapsedMs: active.elapsedMs,
    breakMs: active.breakMs ?? 0,
    outcome,
    breakTypesUsed: active.breakTypesUsed ?? [],
  });
  clearActiveSessionDraft();
  return finished;
}

/**
 * Guests stay localStorage-only (anonymous sign-ins disabled).
 * Does not call signInAnonymously.
 */
export async function ensureAnonymousSession(supabase: SupabaseClient) {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session && !existing.session.user.is_anonymous) {
    return {
      session: existing.session,
      mode: "authenticated" as const,
      drafts: loadLocalSessionDrafts(),
    };
  }

  return {
    session: null,
    mode: "local" as const,
    drafts: loadLocalSessionDrafts(),
    error: null,
  };
}

function tryAcquireMergeLock(): boolean {
  if (!canUseLocalStorage()) return true;
  try {
    const raw = localStorage.getItem(MERGE_LOCK_KEY);
    const now = Date.now();
    if (raw) {
      const ts = Number(raw);
      if (Number.isFinite(ts) && now - ts < 15_000) return false;
    }
    localStorage.setItem(MERGE_LOCK_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

function releaseMergeLock() {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(MERGE_LOCK_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Insert ended local drafts into `sessions` for the authenticated user.
 * Never uses the service role key. Does not call signInAnonymously.
 */
export async function mergeLocalSessionsIntoUser(
  supabase: SupabaseClient,
  drafts: SessionDraft[] = loadLocalSessionDrafts(),
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || user.is_anonymous) {
    return {
      ok: false as const,
      merged: 0,
      error: userError?.message ?? "No authenticated user to merge into.",
    };
  }

  if (drafts.length === 0) {
    return { ok: true as const, merged: 0, error: null };
  }

  if (!tryAcquireMergeLock()) {
    return { ok: true as const, merged: 0, error: null };
  }

  try {
    // Clear before insert so a concurrent tab cannot duplicate the same drafts.
    clearLocalSessionDrafts();

    const rows = drafts.map((d) => {
      const endedAt = d.endedAt || new Date().toISOString();
      const activeMs = Math.max(0, Math.round(d.elapsedMs));
      const breakMs = Math.max(0, Math.round(d.breakMs ?? 0));
      const startedAt =
        d.startedAt ||
        new Date(new Date(endedAt).getTime() - activeMs).toISOString();
      const status =
        d.outcome === "tapout" || d.outcome === "tapped_out"
          ? "tapped_out"
          : "ended";

      return {
        user_id: user.id,
        session_name: d.sessionName,
        started_at: startedAt,
        ended_at: endedAt,
        status,
        active_ms: activeMs,
        break_ms: breakMs,
        break_types_used: d.breakTypesUsed ?? [],
        is_shared: false,
        outcome: d.outcome || "solid",
        pr_broken: d.outcome === "pr",
      };
    });

    const { error } = await supabase.from("sessions").insert(rows);

    if (error) {
      // Put drafts back so a later retry can succeed.
      if (canUseLocalStorage()) {
        localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts));
      }
      return { ok: false as const, merged: 0, error: error.message };
    }

    return { ok: true as const, merged: drafts.length, error: null };
  } finally {
    releaseMergeLock();
  }
}
