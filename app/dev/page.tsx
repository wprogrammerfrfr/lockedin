"use client";

import { useEffect, useState } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProjectRateForm } from "@/components/dev/ProjectRateForm";
import { RepoStatsCard } from "@/components/dev/RepoStatsCard";
import { Button } from "@/components/ui/button";
import { listProjects, projectLockedMs } from "@/features/dev-mode/api";
import type { ProjectRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

type StatsMap = Record<
  string,
  { commits: number; additions: number; deletions: number; activeMs: number }
>;

export default function DevPage() {
  const { status, isAuthenticated, user, session, connectedVia } = useAuth();
  const userId = user?.id ?? null;
  const providerToken = Boolean(
    (session as { provider_token?: string } | null)?.provider_token,
  );
  const [gateOpen, setGateOpen] = useState(false);
  const [hasGithub, setHasGithub] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [stats, setStats] = useState<StatsMap>({});

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated || !userId || !user) {
      setGateOpen(true);
      setProjects([]);
      return;
    }

    setHasGithub(
      Boolean(
        providerToken ||
          connectedVia === "GitHub" ||
          user.app_metadata?.provider === "github" ||
          (user.identities ?? []).some((i) => i.provider === "github"),
      ),
    );

    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const list = await listProjects(supabase);
        if (cancelled) return;
        setProjects(list);
        const next: StatsMap = {};
        for (const p of list) {
          let activeMs = 0;
          try {
            activeMs = await projectLockedMs(supabase, p.id);
          } catch {
            activeMs = 0;
          }
          let commits = 0;
          let additions = 0;
          let deletions = 0;
          if (p.github_repo) {
            try {
              const res = await fetch(
                `/api/github/stats?repo=${encodeURIComponent(p.github_repo)}`,
              );
              if (res.ok) {
                const body = (await res.json()) as {
                  commits?: number;
                  additions?: number;
                  deletions?: number;
                };
                commits = body.commits ?? 0;
                additions = body.additions ?? 0;
                deletions = body.deletions ?? 0;
              }
            } catch {
              /* ignore */
            }
          }
          next[p.id] = { commits, additions, deletions, activeMs };
        }
        if (!cancelled) setStats(next);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    status,
    isAuthenticated,
    userId,
    user,
    providerToken,
    connectedVia,
  ]);

  async function linkGithub() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "read:user repo",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Developer Mode
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track project Cost (hours × rate) and Value side-by-side with GitHub
            LOC.
          </p>
        </div>

        {isAuthenticated && !hasGithub && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">
              Link GitHub to load commits and LOC for your projects.
            </p>
            <Button className="mt-3 rounded-xl" onClick={linkGithub}>
              Link GitHub
            </Button>
          </div>
        )}

        {isAuthenticated && (
          <>
            <ProjectRateForm
              onSaved={(p) =>
                setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)])
              }
            />
            <div className="space-y-4">
              {projects.map((p) => (
                <RepoStatsCard
                  key={p.id}
                  project={p}
                  activeMs={stats[p.id]?.activeMs ?? 0}
                  commits={stats[p.id]?.commits ?? 0}
                  additions={stats[p.id]?.additions ?? 0}
                  deletions={stats[p.id]?.deletions ?? 0}
                />
              ))}
              {projects.length === 0 && (
                <p className="text-sm text-slate-400">
                  Add a project to see Cost vs Value.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <AuthGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        reason="save_sync"
        onContinueAsGuest={() => setGateOpen(false)}
      />
    </ChromePage>
  );
}
