import { NextResponse } from "next/server";
import { fetchGithubViewer, GithubApiError } from "@/lib/github/client";
import { clearGithubCookie } from "@/lib/github/token";
import { requireGithub } from "@/lib/github/route-helpers";

const DISCONNECTED = { connected: false, login: null, canReadPrivate: false };

export async function GET() {
  const ctx = await requireGithub();
  if (ctx instanceof NextResponse) return NextResponse.json(DISCONNECTED);

  try {
    const viewer = await fetchGithubViewer(ctx.token);
    return NextResponse.json({
      connected: true,
      login: viewer.login,
      canReadPrivate: viewer.scopes.includes("repo"),
    });
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 401) {
      const res = NextResponse.json(DISCONNECTED);
      clearGithubCookie(res);
      return res;
    }
    return NextResponse.json({ connected: true, login: null, canReadPrivate: false });
  }
}
