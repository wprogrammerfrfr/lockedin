import { NextResponse } from "next/server";
import {
  fetchAuthorCodeStats,
  fetchGithubViewer,
  parseOwnerRepo,
} from "@/lib/github/client";
import {
  errorJson,
  githubErrorResponse,
  requireGithub,
} from "@/lib/github/route-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseOwnerRepo(searchParams.get("repo") ?? "");
  if (!parsed) return errorJson("invalid_repo", 400);

  const ctx = await requireGithub();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { login } = await fetchGithubViewer(ctx.token);
    const stats = await fetchAuthorCodeStats(
      ctx.token,
      parsed.owner,
      parsed.repo,
      login,
    );
    return NextResponse.json(stats);
  } catch (err) {
    return githubErrorResponse(err);
  }
}
