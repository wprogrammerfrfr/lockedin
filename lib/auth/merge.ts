import type { SupabaseClient } from "@supabase/supabase-js";
import type { BreakTypeStored } from "@/features/session/types";

const LOCAL_DRAFTS_KEY = "lockedin.sessionDrafts";
const ACTIVE_DRAFT_KEY = "lockedin.activeSessionDraft";

export type SessionDraft = {
  id: string;
  sessionName: string | null;
  elapsedMs: number;
  outcome: string;
  breakTypesUsed: BreakTypeStored[];
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
  draft: Omit<SessionDraft, "id" | "endedAt" | "source">,
): SessionDraft {
  const entry: SessionDraft = {
    ...draft,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `draft_${Date.now()}`,
    endedAt: new Date().toISOString(),
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
        active.elapsedMs > active.personalRecordMs));
  const outcome =
    outcomeOverride ?? (didBreakPR ? "pr" : "solid");

  const finished = saveLocalSessionDraft({
    sessionName: active.sessionName,
    elapsedMs: active.elapsedMs,
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

  const rows = drafts.map((d) => {
    const endedAt = d.endedAt || new Date().toISOString();
    const activeMs = Math.max(0, Math.round(d.elapsedMs));
    const startedAt = new Date(
      new Date(endedAt).getTime() - activeMs,
    ).toISOString();
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
      break_ms: 0,
      break_types_used: d.breakTypesUsed ?? [],
      is_shared: false,
      outcome: d.outcome || "solid",
      pr_broken: d.outcome === "pr",
    };
  });

  const { error } = await supabase.from("sessions").insert(rows);

  if (error) {
    return { ok: false as const, merged: 0, error: error.message };
  }

  clearLocalSessionDrafts();
  return { ok: true as const, merged: drafts.length, error: null };
}
