"use client";

import { CommitCalendar } from "@/components/dev/CommitCalendar";
import { DevProjectFrame } from "@/components/dev/DevProjectFrame";
import { OverviewStats } from "@/components/dev/OverviewStats";

export default function DevOverviewPage() {
  return (
    <DevProjectFrame>
      {(project, rows) => (
        <>
          <OverviewStats project={project} commits={rows} />
          <div className="rounded-2xl border border-border bg-card/40 p-4 sm:p-6">
            <CommitCalendar
              key={`${project.id}:${project.github_repo}`}
              commits={rows}
              firstCommitAt={project.first_commit_at}
            />
          </div>
        </>
      )}
    </DevProjectFrame>
  );
}
