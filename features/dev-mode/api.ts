import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectCommitRow, ProjectRow } from "@/types/database";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

export type ProjectInput = {
  display_name: string;
  github_repo?: string | null;
  monthly_cost_usd?: number | null;
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
    monthly_cost_usd: input.monthly_cost_usd ?? null,
  };

  if (input.id) {
    const { data: existing } = await supabase
      .from("projects")
      .select("github_repo")
      .eq("id", input.id)
      .maybeSingle();
    const repoChanged =
      (existing as { github_repo?: string | null } | null)?.github_repo !==
      payload.github_repo;

    if (repoChanged) {
      const { error: clearError } = await supabase
        .from("project_commits")
        .delete()
        .eq("project_id", input.id);
      if (clearError && !isSchemaUnavailable(clearError)) {
        throw new Error(clearError.message);
      }
    }

    const { data, error } = await supabase
      .from("projects")
      .update(
        repoChanged
          ? {
              ...payload,
              first_commit_at: null,
              first_commit_message: null,
              first_commit_sha: null,
              commits_synced_at: null,
            }
          : payload,
      )
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

/** Cascades to the project's saved commits, session tags and stat snapshots. */
export async function deleteProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
}

const COMMITS_PAGE = 1000;

export async function listProjectCommits(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectCommitRow[]> {
  const out: ProjectCommitRow[] = [];
  for (let from = 0; ; from += COMMITS_PAGE) {
    const { data, error } = await supabase
      .from("project_commits")
      .select("*")
      .eq("project_id", projectId)
      .order("committed_at", { ascending: true })
      .range(from, from + COMMITS_PAGE - 1);
    if (error) {
      if (isSchemaUnavailable(error)) return [];
      throw new Error(error.message);
    }
    const batch = (data ?? []) as ProjectCommitRow[];
    out.push(...batch);
    if (batch.length < COMMITS_PAGE) break;
  }
  return out;
}

export type SyncCommitsResult =
  | { ok: true; imported: number; project: ProjectRow }
  | { ok: false; error: string };

export async function syncProjectCommits(
  projectId: string,
): Promise<SyncCommitsResult> {
  try {
    const res = await fetch("/api/github/commits/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const body = (await res.json().catch(() => null)) as {
      imported?: number;
      project?: ProjectRow;
      error?: string;
    } | null;
    if (!res.ok || !body?.project) {
      return { ok: false, error: body?.error ?? `http_${res.status}` };
    }
    return { ok: true, imported: body.imported ?? 0, project: body.project };
  } catch {
    return { ok: false, error: "network" };
  }
}