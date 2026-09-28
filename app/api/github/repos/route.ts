import { NextResponse } from "next/server";
import { listUserRepos } from "@/lib/github/client";
import { githubErrorResponse, requireGithub } from "@/lib/github/route-helpers";

export async function GET() {
  const ctx = await requireGithub();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const repos = await listUserRepos(ctx.token);
    return NextResponse.json({ repos });
  } catch (err) {
    return githubErrorResponse(err);
  }
}
