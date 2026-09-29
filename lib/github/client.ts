export class GithubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GithubApiError";
  }
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubGet(token: string, path: string): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (!res.ok && res.status !== 409) {
    throw new GithubApiError(`GitHub ${path} failed (${res.status})`, res.status);
  }
  return res;
}

export type AuthorCodeStats = {
  additions: number;
  deletions: number;
  /** GitHub is still building contributor stats (HTTP 202). */
  pending: boolean;
};

type ContributorWeek = { a?: number; d?: number };
type ContributorStat = {
  author?: { login?: string } | null;
  weeks?: ContributorWeek[];
};

/**
 * All-time additions and deletions for one author on the default branch.
 * GitHub answers 202 while it computes the weekly contributor stats.
 */
export async function fetchAuthorCodeStats(
  token: string,
  owner: string,
  repo: string,
  login: string,
): Promise<AuthorCodeStats> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/stats/contributors`,
    { headers: githubHeaders(token), cache: "no-store" },
  );
  if (res.status === 202 || res.status === 204) {
    return { additions: 0, deletions: 0, pending: res.status === 202 };
  }
  if (res.status === 409) {
    return { additions: 0, deletions: 0, pending: false };
  }
  if (!res.ok) {
    throw new GithubApiError(
      `GitHub contributor stats failed (${res.status})`,
      res.status,
    );
  }

  const body = (await res.json()) as ContributorStat[];
  const mine = Array.isArray(body)
    ? body.find(
        (row) => row.author?.login?.toLowerCase() === login.toLowerCase(),
      )
    : undefined;

  let additions = 0;
  let deletions = 0;
  for (const week of mine?.weeks ?? []) {
    additions += week.a ?? 0;
    deletions += week.d ?? 0;
  }
  return { additions, deletions, pending: false };
}

export type GithubCommit = {
  sha: string;
  message: string;
  date: string;
  url: string | null;
};

type RawCommit = {
  sha: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { date?: string } | null;
    committer?: { date?: string } | null;
  };
};

const MAX_COMMIT_PAGES = 30;
const MAX_REPO_PAGES = 3;

function toCommit(raw: RawCommit): GithubCommit | null {
  const date = raw.commit?.author?.date ?? raw.commit?.committer?.date;
  if (!raw.sha || !date) return null;
  const message = (raw.commit?.message ?? "").split("\n")[0].trim();
  return { sha: raw.sha, message, date, url: raw.html_url ?? null };
}

function lastPageFromLink(link: string | null): number | null {
  if (!link) return null;
  const match = link
    .split(",")
    .find((part) => part.includes('rel="last"'))
    ?.match(/[?&]page=(\d+)/);
  return match ? Number(match[1]) : null;
}

export type GithubViewer = { login: string; scopes: string[] };

export async function fetchGithubViewer(token: string): Promise<GithubViewer> {
  const res = await githubGet(token, "/user");
  const body = (await res.json()) as { login?: string };
  if (!body.login) throw new GithubApiError("GitHub user missing login", 502);
  const scopes = (res.headers.get("x-oauth-scopes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { login: body.login, scopes };
}

export type GithubRepo = {
  fullName: string;
  private: boolean;
  pushedAt: string | null;
};

export async function listUserRepos(token: string): Promise<GithubRepo[]> {
  const out: GithubRepo[] = [];
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const params = new URLSearchParams({
      sort: "pushed",
      per_page: "100",
      page: String(page),
      affiliation: "owner,collaborator,organization_member",
    });
    const res = await githubGet(token, `/user/repos?${params}`);
    const batch = (await res.json()) as {
      full_name: string;
      private: boolean;
      pushed_at: string | null;
    }[];
    for (const r of batch) {
      out.push({ fullName: r.full_name, private: r.private, pushedAt: r.pushed_at });
    }
    if (batch.length < 100) break;
  }
  return out;
}

/** Newest first. Empty repos (409) return an empty list. */
export async function listRepoCommits(
  token: string,
  owner: string,
  repo: string,
  opts?: { since?: string; author?: string },
): Promise<GithubCommit[]> {
  const out: GithubCommit[] = [];
  for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
    });
    if (opts?.since) params.set("since", opts.since);
    if (opts?.author) params.set("author", opts.author);

    const res = await githubGet(token, `/repos/${owner}/${repo}/commits?${params}`);
    if (res.status === 409) return out;

    const batch = (await res.json()) as RawCommit[];
    for (const raw of batch) {
      const c = toCommit(raw);
      if (c) out.push(c);
    }
    if (batch.length < 100) break;
  }
  return out;
}

/** The oldest commit reachable from the default branch. */
export async function fetchFirstCommit(
  token: string,
  owner: string,
  repo: string,
): Promise<GithubCommit | null> {
  const base = `/repos/${owner}/${repo}/commits?per_page=1`;

  const first = await githubGet(token, base);
  if (first.status === 409) return null;

  const lastPage = lastPageFromLink(first.headers.get("link"));
  if (lastPage == null) {
    const only = (await first.json()) as RawCommit[];
    return only[0] ? toCommit(only[0]) : null;
  }

  const last = await githubGet(token, `${base}&page=${lastPage}`);
  const rows = (await last.json()) as RawCommit[];
  return rows[0] ? toCommit(rows[0]) : null;
}

export function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\/+$/, "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo) return null;
  const name = repo.replace(/\.git$/, "");
  const valid = /^[A-Za-z0-9-]+$/.test(owner) && /^[A-Za-z0-9._-]+$/.test(name);
  return valid ? { owner, repo: name } : null;
}

export function normalizeRepo(input: string): string | null {
  const parsed = parseOwnerRepo(input);
  return parsed ? `${parsed.owner}/${parsed.repo}` : null;
}
