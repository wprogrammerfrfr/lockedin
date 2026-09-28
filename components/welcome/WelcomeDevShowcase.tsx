"use client";

import { useEffect, useState } from "react";
import { CommitCalendar } from "@/components/dev/CommitCalendar";
import { OverviewStats } from "@/components/dev/OverviewStats";
import type { ProjectCommitRow, ProjectRow } from "@/types/database";

const PROJECT_ID = "welcome-demo";

type ScriptRow = {
  daysAgo: number;
  hour: number;
  minute: number;
  message: string;
};

/** Oldest first. Same-day gaps stay under 2 hours so time coding counts them. */
const SCRIPT: ScriptRow[] = [
  { daysAgo: 80, hour: 9, minute: 14, message: "Initial commit" },
  { daysAgo: 21, hour: 10, minute: 2, message: "Add the focus timer" },
  { daysAgo: 21, hour: 10, minute: 48, message: "Lime glow while locked in" },
  { daysAgo: 18, hour: 11, minute: 6, message: "Break pauses the clock" },
  { daysAgo: 16, hour: 14, minute: 11, message: "Room seats and presence" },
  { daysAgo: 16, hour: 14, minute: 52, message: "Bet / Nah break votes" },
  { daysAgo: 12, hour: 9, minute: 40, message: "Melt scene" },
  { daysAgo: 12, hour: 10, minute: 18, message: "Shared dessert table" },
  { daysAgo: 12, hour: 11, minute: 5, message: "Topping picker" },
  { daysAgo: 9, hour: 13, minute: 22, message: "Share card" },
  { daysAgo: 9, hour: 14, minute: 1, message: "PR burst when the record falls" },
  { daysAgo: 6, hour: 10, minute: 8, message: "Connect GitHub" },
  { daysAgo: 6, hour: 10, minute: 44, message: "Import commits" },
  { daysAgo: 6, hour: 11, minute: 27, message: "Month calendar" },
  { daysAgo: 4, hour: 15, minute: 3, message: "Cost to build" },
  { daysAgo: 4, hour: 15, minute: 41, message: "Time coding estimate" },
  { daysAgo: 3, hour: 10, minute: 5, message: "Project switcher" },
  { daysAgo: 3, hour: 10, minute: 33, message: "Sync status" },
  { daysAgo: 3, hour: 11, minute: 12, message: "Started flag on day one" },
  { daysAgo: 3, hour: 11, minute: 48, message: "Day dialog" },
  { daysAgo: 3, hour: 13, minute: 6, message: "Jump to start" },
  { daysAgo: 3, hour: 13, minute: 52, message: "Private repo access" },
  { daysAgo: 1, hour: 9, minute: 16, message: "Stat tiles" },
  { daysAgo: 1, hour: 9, minute: 58, message: "Midnight rollover for day count" },
  { daysAgo: 0, hour: 8, minute: 24, message: "Polish developer mode" },
  { daysAgo: 0, hour: 9, minute: 7, message: "Welcome demo" },
];

function atLocal(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
  return d.toISOString();
}

function shaFor(index: number): string {
  return (0xa17c0de + index * 9973).toString(16).padStart(7, "0");
}

function buildDemo(): { project: ProjectRow; commits: ProjectCommitRow[] } {
  const commits = SCRIPT.map((row, index) => {
    const committed_at = atLocal(row.daysAgo, row.hour, row.minute);
    return {
      id: `welcome-commit-${index}`,
      project_id: PROJECT_ID,
      user_id: "welcome",
      sha: shaFor(index),
      message: row.message,
      committed_at,
      html_url: null,
      created_at: committed_at,
    };
  }).sort((a, b) => a.committed_at.localeCompare(b.committed_at));

  const first = commits[0];
  return {
    project: {
      id: PROJECT_ID,
      user_id: "welcome",
      display_name: "LockedIn web",
      github_repo: "acme/lockedin",
      monthly_cost_usd: 20,
      created_at: first.committed_at,
      first_commit_at: first.committed_at,
      first_commit_message: first.message,
      first_commit_sha: first.sha,
      commits_synced_at: new Date().toISOString(),
    },
    commits,
  };
}

export function WelcomeDevShowcase() {
  const [demo, setDemo] = useState<ReturnType<typeof buildDemo> | null>(null);

  useEffect(() => {
    setDemo(buildDemo());
  }, []);

  if (!demo) {
    return (
      <div
        className="min-h-[28rem] rounded-2xl border border-border bg-card/40"
        aria-hidden
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold text-lime-600">
          {demo.project.display_name}
        </p>
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
          {demo.project.github_repo}
        </p>
      </div>

      <OverviewStats project={demo.project} commits={demo.commits} />

      <div className="rounded-2xl border border-border bg-card/40 p-4 sm:p-6">
        <CommitCalendar
          commits={demo.commits}
          firstCommitAt={demo.project.first_commit_at}
        />
      </div>
    </div>
  );
}
