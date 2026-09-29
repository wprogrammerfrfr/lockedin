"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectForm } from "@/components/dev/ProjectForm";
import { deleteProject } from "@/features/dev-mode/api";
import { buildCost, formatUsd } from "@/features/dev-mode/cost";
import type { ProjectStats, RepoStatsError } from "@/features/dev-mode/DevModeProvider";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import { cn } from "@/lib/utils";
import type { ProjectRow } from "@/types/database";

const STATS_ERROR_TEXT: Record<Exclude<RepoStatsError, null>, string> = {
  invalid_repo: "Invalid repo — edit it to owner/name",
  repo_not_found: "No access — repo not found or private",
};

function linesWrittenLabel(stats: ProjectStats | undefined): string {
  if (!stats || stats.error) return "—";
  if (stats.pending) return "Calculating…";
  const added = stats.additions.toLocaleString("en-US");
  const removed = stats.deletions.toLocaleString("en-US");
  return `+${added} / −${removed}`;
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 truncate font-mono text-sm tabular-nums text-foreground", className)}>
        {value}
      </p>
    </div>
  );
}

export function ProjectListItem({
  project,
  stats,
  githubConnected,
  editOpen,
  onEditOpenChange,
  onUpdated,
  onDeleted,
}: {
  project: ProjectRow;
  stats?: ProjectStats;
  githubConnected: boolean;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  onUpdated: (p: ProjectRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cost = buildCost(project.monthly_cost_usd, project.first_commit_at);
  const started = project.first_commit_at
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(project.first_commit_at))
    : "—";

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteProject(createClient(), project.id);
      toast.success(`Deleted ${project.display_name}`);
      setConfirmOpen(false);
      onDeleted(project.id);
    } catch (err) {
      toast.error(userFacingError(err, "Delete failed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-lime-400">
            {project.display_name}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {project.github_repo || "No repo linked"}
          </p>
          {stats?.error ? (
            <p className="mt-1 text-xs text-red-400">
              {STATS_ERROR_TEXT[stats.error]}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            aria-label={`Edit ${project.display_name}`}
            onClick={() => onEditOpenChange(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:text-red-400"
            aria-label={`Delete ${project.display_name}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
        <Metric
          label="Monthly cost"
          value={project.monthly_cost_usd != null ? formatUsd(project.monthly_cost_usd, 2) : "—"}
        />
        <Metric label="Started" value={started} />
        <Metric
          label="Cost to date"
          value={cost ? `${formatUsd(cost.total)} · ${cost.months} mo` : "—"}
          className={cost ? "text-lime-400" : undefined}
        />
        <Metric
          label="Lines written"
          value={linesWrittenLabel(stats)}
        />
      </div>

      <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Changing the repo clears its saved commits and syncs the new one.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            key={project.id}
            project={project}
            githubConnected={githubConnected}
            className="border-0 bg-transparent p-0 sm:p-0"
            onCancel={() => onEditOpenChange(false)}
            onSaved={(p) => {
              toast.success("Project updated");
              onEditOpenChange(false);
              onUpdated(p);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {project.display_name}?</DialogTitle>
            <DialogDescription>
              Deletes this project and its saved commits from LockedIn. Your
              GitHub repo is untouched. You can add it again anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
