import { NextResponse } from "next/server";
import { clearGithubCookie } from "@/lib/github/token";

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearGithubCookie(res);
  return res;
}
