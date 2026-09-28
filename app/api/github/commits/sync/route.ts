import { NextResponse } from "next/server";
import {
  fetchFirstCommit,
  fetchGithubViewer,
  listRepoCommits,
  parseOwnerRepo,
} from "@/lib/github/client";
import {
  errorJson,
  githubErrorResponse,
  requireGithub,
} from "@/lib/github/route-helpers";
import type { ProjectRow } from "@/types/database";

const UPSERT_CHUNK = 500;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    projectId?: string;
  } | null;
  const projectId = body?.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const ctx = await requireGithub();
  if (ctx instanceof NextResponse) return ctx;
  const { supabase, user, token } = ctx;

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !projectData) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const project = projectData as ProjectRow;
  const parsed = project.github_repo ? parseOwnerRepo(project.github_repo) : null;
  if (!parsed) return errorJson("invalid_repo", 400);

  const { data: latest } = await supabase
    .from("project_commits")
    .select("committed_at")
    .eq("project_id", project.id)
    .order("committed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    const { login } = await fetchGithubViewer(token);
    const commits = await listRepoCommits(token, parsed.owner, parsed.repo, {
      author: login,
      since: (latest as { committed_at?: string } | null)?.committed_at,
    });

    const rows = commits.map((c) => ({
      project_id: project.id,
      user_id: user.id,
      sha: c.sha,
      message: c.message,
      committed_at: c.date,
      html_url: c.url,
    }));

    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const { error } = await supabase
        .from("project_commits")
        .upsert(rows.slice(i, i + UPSERT_CHUNK), {
          onConflict: "project_id,sha",
        });
      if (error) {
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
    }

    const patch: Partial<ProjectRow> = {
      commits_synced_at: new Date().toISOString(),
    };
    if (!project.first_commit_at) {
      const first = await fetchFirstCommit(token, parsed.owner, parsed.repo);
      if (first) {
        patch.first_commit_at = first.date;
        patch.first_commit_message = first.message;
        patch.first_commit_sha = first.sha;
      }
    }

    const { data: updated } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", project.id)
      .select("*")
      .maybeSingle();

    return NextResponse.json({
      imported: rows.length,
      project: (updated as ProjectRow | null) ?? { ...project, ...patch },
    });
  } catch (err) {
    return githubErrorResponse(err);
  }
}
