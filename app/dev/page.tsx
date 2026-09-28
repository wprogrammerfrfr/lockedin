"use client";

import Link from "next/link";
import { AlertTriangle, FolderPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommitCalendar } from "@/components/dev/CommitCalendar";
import { OverviewStats } from "@/components/dev/OverviewStats";
import { useDevMode } from "@/features/dev-mode/DevModeProvider";
import { cn } from "@/lib/utils";

function syncedAgo(iso: string | null | undefined): string {
  if (!iso) return "Never synced";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.floor(hours / 24)}d ago`;
}

export default function DevOverviewPage() {
  const {
    projectsLoaded,
    repoProjects,
    selectedProject,
    selectProject,
    connected,
    canReadPrivate,
    linkGithub,
    commitsFor,
    syncErrorFor,
    isSyncing,
    syncProject,
  } = useDevMode();

  if (!projectsLoaded) {
    return <p className="text-sm text-muted-foreground">Loading projects…</p>;
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
        <FolderPlus className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-display text-lg font-semibold text-foreground">
            Add your first project to start tracking
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Link a GitHub repo and a monthly cost. LockedIn imports your commits
            and works out how long you&apos;ve been building and what it cost.
          </p>
        </div>
        <Button asChild className="rounded-xl">
          <Link href="/dev/projects">Add a project</Link>
        </Button>
      </div>
    );
  }

  const project = selectedProject;
  const rows = commitsFor(project) ?? [];
  const syncing = isSyncing(project);
  const error = syncErrorFor(project);
  const editHref = `/dev/projects?edit=${project.id}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {repoProjects.length > 1 ? (
            <Tabs value={project.id} onValueChange={selectProject}>
              <TabsList className="h-auto flex-wrap justify-start">
                {repoProjects.map((p) => (
                  <TabsTrigger
                    key={p.id}
                    value={p.id}
                    className="data-[state=active]:text-lime-400"
                  >
                    {p.display_name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <p className="font-display text-lg font-semibold text-lime-400">
              {project.display_name}
            </p>
          )}
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {project.github_repo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {syncing ? "Syncing…" : syncedAgo(project.commits_synced_at)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl"
            disabled={syncing || !connected}
            onClick={() => void syncProject(project)}
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", syncing && "animate-spin")}
            />
            Sync
          </Button>
        </div>
      </div>

      {error ? (
        <SyncErrorRow
          error={error}
          canReadPrivate={canReadPrivate}
          editHref={editHref}
          onConnect={() => void linkGithub()}
        />
      ) : null}

      <OverviewStats project={project} commits={rows} />

      <div className="rounded-2xl border border-border bg-card/40 p-4 sm:p-6">
        <CommitCalendar
          key={`${project.id}:${project.github_repo}`}
          commits={rows}
          firstCommitAt={project.first_commit_at}
        />
      </div>
    </div>
  );
}

function SyncErrorRow({
  error,
  canReadPrivate,
  editHref,
  onConnect,
}: {
  error: string;
  canReadPrivate: boolean;
  editHref: string;
  onConnect: () => void;
}) {
  let message = "GitHub sync failed. Try again in a moment.";
  let action: { label: string; href?: string; onClick?: () => void } | null =
    null;

  if (error === "invalid_repo") {
    message = "Repo must be owner/name, e.g. acme/lockedin.";
    action = { label: "Edit project", href: editHref };
  } else if (error === "repo_not_found") {
    message = canReadPrivate
      ? "Can't access this repo. Check the owner/name."
      : "Can't access this repo. If it's private, grant LockedIn access.";
    action = canReadPrivate
      ? { label: "Edit project", href: editHref }
      : { label: "Grant private repo access", onClick: onConnect };
  } else if (error === "link_github") {
    message = "GitHub isn't connected, so commits can't sync.";
    action = { label: "Connect GitHub", onClick: onConnect };
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
      <p className="flex items-center gap-2 text-sm text-red-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {message}
      </p>
      {action?.href ? (
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : action ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
