"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertProject } from "@/features/dev-mode/api";
import { normalizeRepo, type GithubRepo } from "@/lib/github/client";
import type { ProjectRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import { cn } from "@/lib/utils";

const MANUAL = "__manual__";

export function ProjectForm({
  project,
  githubConnected = false,
  onSaved,
  onCancel,
  className,
}: {
  project?: ProjectRow | null;
  githubConnected?: boolean;
  onSaved?: (p: ProjectRow) => void;
  onCancel?: () => void;
  className?: string;
}) {
  const [name, setName] = useState(project?.display_name ?? "");
  const [repo, setRepo] = useState(project?.github_repo ?? "");
  const [monthly, setMonthly] = useState(
    project?.monthly_cost_usd != null ? String(project.monthly_cost_usd) : "",
  );
  const [busy, setBusy] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!githubConnected) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/github/repos");
        if (!res.ok) return;
        const body = (await res.json()) as { repos?: GithubRepo[] };
        if (!cancelled) setRepos(body.repos ?? []);
      } catch {
        /* fall back to manual entry */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [githubConnected]);

  const repoInList =
    repos?.some((r) => r.fullName.toLowerCase() === repo.trim().toLowerCase()) ??
    false;
  const showPicker = Boolean(repos && repos.length > 0);
  const showManual = !showPicker || manual || (repo.trim() !== "" && !repoInList);
  const selectValue = showManual ? MANUAL : repoInList ? repo.trim() : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setRepoError(null);

    let githubRepo: string | null = null;
    if (repo.trim()) {
      githubRepo = normalizeRepo(repo);
      if (!githubRepo) {
        setRepoError("Use owner/name, e.g. acme/lockedin, or a github.com URL.");
        return;
      }
    }

    setBusy(true);
    try {
      const saved = await upsertProject(createClient(), {
        id: project?.id,
        display_name: name,
        github_repo: githubRepo,
        monthly_cost_usd: monthly ? Number(monthly) : null,
      });
      onSaved?.(saved);
      if (!project) {
        setName("");
        setRepo("");
        setMonthly("");
        setManual(false);
      }
    } catch (err) {
      toast.error(userFacingError(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={cn("space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5", className)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`proj-name-${project?.id ?? "new"}`}>Project name</Label>
          <Input
            id={`proj-name-${project?.id ?? "new"}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="LockedIn"
            className="rounded-xl"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`proj-cost-${project?.id ?? "new"}`}>
            Monthly cost (USD)
          </Label>
          <Input
            id={`proj-cost-${project?.id ?? "new"}`}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="20"
            className="rounded-xl font-mono tabular-nums"
          />
          <p className="text-[11px] text-muted-foreground">
            AI subscriptions, hosting, tools, and so on.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={showPicker ? `proj-repo-pick-${project?.id ?? "new"}` : `proj-repo-${project?.id ?? "new"}`}>
          GitHub repo
        </Label>
        {showPicker ? (
          <select
            id={`proj-repo-pick-${project?.id ?? "new"}`}
            value={selectValue}
            onChange={(e) => {
              setRepoError(null);
              if (e.target.value === MANUAL) {
                setManual(true);
                return;
              }
              setManual(false);
              setRepo(e.target.value);
            }}
            className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
          >
            <option value="">No repo</option>
            {repos!.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
                {r.private ? " (private)" : ""}
              </option>
            ))}
            <option value={MANUAL}>Type manually…</option>
          </select>
        ) : null}
        {showManual ? (
          <Input
            id={`proj-repo-${project?.id ?? "new"}`}
            value={repo}
            onChange={(e) => {
              setRepoError(null);
              setRepo(e.target.value);
            }}
            placeholder="owner/name"
            className="rounded-xl font-mono"
            aria-invalid={repoError != null}
          />
        ) : null}
        {repoError ? <p className="text-xs text-red-400">{repoError}</p> : null}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Saving…" : project ? "Save changes" : "Add project"}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
