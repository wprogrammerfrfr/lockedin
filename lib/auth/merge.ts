import type { SupabaseClient } from "@supabase/supabase-js";
import type { BreakTypeUsed } from "@/features/session/types";

const LOCAL_DRAFTS_KEY = "lockedin.sessionDrafts";

export type SessionDraft = {
  id: string;
  sessionName: string | null;
  elapsedMs: number;
  outcome: string;
  breakTypesUsed: BreakTypeUsed[];
  endedAt: string;
  source: "local" | "anonymous";
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
