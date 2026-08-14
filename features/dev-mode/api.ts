import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectRow } from "@/types/database";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

export type ProjectInput = {
  display_name: string;
  github_repo?: string | null;
  hourly_rate_usd?: number | null;
  project_value_usd?: number | null;
};

export async function listProjects(
  supabase: SupabaseClient,
): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ProjectRow[];
}

export async function upsertProject(
  supabase: SupabaseClient,
  input: ProjectInput & { id?: string },
): Promise<ProjectRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    user_id: user.id,
    display_name: input.display_name.trim(),
    github_repo: input.github_repo?.trim() || null,
    hourly_rate_usd: input.hourly_rate_usd ?? null,
    project_value_usd: input.project_value_usd ?? null,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as ProjectRow;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectRow;
}

export async function projectLockedMs(
  supabase: SupabaseClient,
  projectId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("session_projects")
    .select("session_id, sessions(active_ms)")
    .eq("project_id", projectId);
  if (error) {
    if (isSchemaUnavailable(error)) return 0;
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, row) => {
    const s = row as { sessions?: { active_ms?: number } | { active_ms?: number }[] };
    const sess = Array.isArray(s.sessions) ? s.sessions[0] : s.sessions;
    return sum + (Number(sess?.active_ms) || 0);
  }, 0);
}

export function computeProjectCost(
  activeMs: number,
  hourlyRateUsd: number | null | undefined,
): number | null {
  if (hourlyRateUsd == null || Number.isNaN(hourlyRateUsd)) return null;
  const hours = activeMs / 3_600_000;
  return hours * hourlyRateUsd;
}
