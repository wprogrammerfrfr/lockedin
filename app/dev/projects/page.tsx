"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ProjectForm } from "@/components/dev/ProjectForm";
import { ProjectListItem } from "@/components/dev/ProjectListItem";
import { useDevMode } from "@/features/dev-mode/DevModeProvider";

function ProjectsManager() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editingId = searchParams.get("edit");
  const {
    projectsLoaded,
    projects,
    stats,
    connected,
    addProject,
    updateProject,
    removeProject,
  } = useDevMode();

  function setEditing(id: string | null) {
    router.replace(id ? `${pathname}?edit=${id}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Add a project
          </h2>
          <p className="text-sm text-muted-foreground">
            Cost to build = monthly cost × every started month since the first
            commit.
          </p>
        </div>
        <ProjectForm
          githubConnected={connected}
          onSaved={(p) => {
            addProject(p);
            toast.success(`Added ${p.display_name}`, {
              action: { label: "View on Overview", onClick: () => router.push("/dev") },
            });
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Your projects
          {projectsLoaded ? (
            <span className="ml-2 font-mono text-sm tabular-nums text-muted-foreground">
              {projects.length}
            </span>
          ) : null}
        </h2>
        {!projectsLoaded ? (
          <p className="text-sm text-muted-foreground">Loading projects…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet. Add one above to start tracking.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <ProjectListItem
                key={p.id}
                project={p}
                stats={stats[p.id]}
                githubConnected={connected}
                editOpen={editingId === p.id}
                onEditOpenChange={(open) => setEditing(open ? p.id : null)}
                onUpdated={updateProject}
                onDeleted={removeProject}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function DevProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsManager />
    </Suspense>
  );
}
