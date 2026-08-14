export type GithubRepoStats = {
  commits: number;
  additions: number;
  deletions: number;
};

/**
 * Fetch commit stats for a repo using a GitHub OAuth access token.
 * No service role. Never log the token.
 */
export async function fetchRepoStats(
  token: string,
  owner: string,
  repo: string,
  opts?: { since?: string; author?: string },
): Promise<GithubRepoStats> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const params = new URLSearchParams({ per_page: "100" });
  if (opts?.since) params.set("since", opts.since);
  if (opts?.author) params.set("author", opts.author);

  const listRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?${params}`,
    { headers, cache: "no-store" },
  );

  if (!listRes.ok) {
    throw new Error(`GitHub commits failed (${listRes.status})`);
  }

  const commits = (await listRes.json()) as { sha: string }[];
  let additions = 0;
  let deletions = 0;

  const limited = commits.slice(0, 30);
  for (const c of limited) {
    const detail = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`,
      { headers, cache: "no-store" },
    );
    if (!detail.ok) continue;
    const body = (await detail.json()) as {
      stats?: { additions?: number; deletions?: number };
    };
    additions += body.stats?.additions ?? 0;
    deletions += body.stats?.deletions ?? 0;
  }

  return {
    commits: commits.length,
    additions,
    deletions,
  };
}

export function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/^https?:\/\/github\.com\//, "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo) return null;
  return { owner, repo: repo.replace(/\.git$/, "") };
}
