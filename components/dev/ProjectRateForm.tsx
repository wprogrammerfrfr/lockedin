"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertProject } from "@/features/dev-mode/api";
import type { ProjectRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

export function ProjectRateForm({
  project,
  onSaved,
}: {
  project?: ProjectRow | null;
  onSaved?: (p: ProjectRow) => void;
}) {
  const [name, setName] = useState(project?.display_name ?? "");
  const [repo, setRepo] = useState(project?.github_repo ?? "");
  const [rate, setRate] = useState(
    project?.hourly_rate_usd != null ? String(project.hourly_rate_usd) : "",
  );
  const [value, setValue] = useState(
    project?.project_value_usd != null ? String(project.project_value_usd) : "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await upsertProject(createClient(), {
        id: project?.id,
        display_name: name,
        github_repo: repo || null,
        hourly_rate_usd: rate ? Number(rate) : null,
        project_value_usd: value ? Number(value) : null,
      });
      toast.success("Project saved");
      onSaved?.(saved);
    } catch (err) {
      toast.error(userFacingError(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <Label htmlFor="proj-name">Internal project name</Label>
        <Input
          id="proj-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl"
          required
        />
      </div>
      <div>
        <Label htmlFor="proj-repo">GitHub repo (owner/name)</Label>
        <Input
          id="proj-repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="acme/lockedin"
          className="rounded-xl"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="proj-rate">Hourly rate — Cost (USD)</Label>
          <Input
            id="proj-rate"
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="rounded-xl font-mono"
          />
        </div>
        <div>
          <Label htmlFor="proj-value">Project value / worth (USD)</Label>
          <Input
            id="proj-value"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-xl font-mono"
          />
        </div>
      </div>
      <Button type="submit" disabled={busy} className="rounded-xl">
        {busy ? "Saving…" : "Save project"}
      </Button>
    </form>
  );
}
