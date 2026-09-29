"use client";

import { DevProjectFrame } from "@/components/dev/DevProjectFrame";
import { NerdStats } from "@/components/dev/NerdStats";
import { useDevMode } from "@/features/dev-mode/DevModeProvider";

export default function DevStatsPage() {
  const { stats } = useDevMode();

  return (
    <DevProjectFrame>
      {(project, rows) => (
        <NerdStats project={project} commits={rows} code={stats[project.id]} />
      )}
    </DevProjectFrame>
  );
}
