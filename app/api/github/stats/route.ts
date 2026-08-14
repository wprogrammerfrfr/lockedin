import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchRepoStats, parseOwnerRepo } from "@/lib/github/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get("repo");
  if (!repoParam) {
    return NextResponse.json({ error: "repo required" }, { status: 400 });
  }

  const parsed = parseOwnerRepo(repoParam);
  if (!parsed) {
    return NextResponse.json({ error: "invalid repo" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token =
    (session as { provider_token?: string } | null)?.provider_token ?? null;

  if (!token) {
    return NextResponse.json(
      { error: "link_github", message: "Link GitHub to load repo stats." },
      { status: 403 },
    );
  }

  try {
    const stats = await fetchRepoStats(token, parsed.owner, parsed.repo);
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "github_error" }, { status: 502 });
  }
}
