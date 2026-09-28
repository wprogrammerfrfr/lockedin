import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { GithubApiError } from "@/lib/github/client";
import { clearGithubCookie, getGithubToken } from "@/lib/github/token";

export type GithubErrorCode =
  | "unauthorized"
  | "link_github"
  | "invalid_repo"
  | "repo_not_found"
  | "github_error";

export function errorJson(error: GithubErrorCode, status: number) {
  return NextResponse.json({ error }, { status });
}

export function linkGithubResponse() {
  const res = errorJson("link_github", 403);
  clearGithubCookie(res);
  return res;
}

type Ctx = { supabase: SupabaseClient; user: User; token: string };

export async function requireGithub(): Promise<Ctx | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return errorJson("unauthorized", 401);

  const token = await getGithubToken(supabase, user.id);
  if (!token) return errorJson("link_github", 403);

  return { supabase, user, token };
}

/** 401 = token revoked/expired → drop the cookie so the UI asks to reconnect. */
export function githubErrorResponse(err: unknown) {
  if (err instanceof GithubApiError) {
    if (err.status === 401) return linkGithubResponse();
    if (err.status === 404) return errorJson("repo_not_found", 404);
  }
  return errorJson("github_error", 502);
}
