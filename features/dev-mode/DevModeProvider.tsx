"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  listProjectCommits,
  listProjects,
  projectLockedMs,
  syncProjectCommits,
} from "@/features/dev-mode/api";
import { createClient } from "@/lib/supabase/client";
import type { ProjectCommitRow, ProjectRow } from "@/types/database";

export type RepoStatsError = "invalid_repo" | "repo_not_found" | null;

export type ProjectStats = {
  additions: number;
  deletions: number;
  activeMs: number;
  error: RepoStatsError;
};

export type GithubStatus = {
  connected: boolean;
  login: string | null;
  canReadPrivate: boolean;
};

type DevModeValue = {
  ghStatus: GithubStatus | null;
  connected: boolean;
  canReadPrivate: boolean;
  needsGithubReconnect: boolean;
  linkGithub: () => Promise<void>;

  projectsLoaded: boolean;
  projects: ProjectRow[];
  repoProjects: ProjectRow[];
  stats: Record<string, ProjectStats>;

  selectedProject: ProjectRow | null;
  selectProject: (id: string) => void;

  commitsFor: (p: ProjectRow) => ProjectCommitRow[] | undefined;
  syncErrorFor: (p: ProjectRow) => string | null;
  isSyncing: (p: ProjectRow) => boolean;
  syncProject: (p: ProjectRow) => Promise<void>;

  addProject: (p: ProjectRow) => void;
  updateProject: (p: ProjectRow) => void;
  removeProject: (id: string) => void;
};

const DevModeContext = createContext<DevModeValue | null>(null);

const SELECTED_KEY = "lockedin.dev.selectedProject";

function dataKey(p: ProjectRow): string {
  return `${p.id}:${p.github_repo ?? ""}`;
}

function syncKey(p: ProjectRow, canSync: boolean): string {
  return `${dataKey(p)}:${canSync ? "sync" : "load"}`;
}

async function loadProjectStats(
  p: ProjectRow,
): Promise<{ stats: ProjectStats; needsGithub: boolean }> {
  const stats: ProjectStats = {
    additions: 0,
    deletions: 0,
    activeMs: 0,
    error: null,
  };
  let needsGithub = false;

  try {
    stats.activeMs = await projectLockedMs(createClient(), p.id);
  } catch {
    stats.activeMs = 0;
  }

  if (!p.github_repo) return { stats, needsGithub };

  try {
    const res = await fetch(
      `/api/github/stats?repo=${encodeURIComponent(p.github_repo)}`,
    );
    const body = (await res.json().catch(() => null)) as {
      additions?: number;
      deletions?: number;
      error?: string;
    } | null;
    if (res.ok) {
      stats.additions = body?.additions ?? 0;
      stats.deletions = body?.deletions ?? 0;
    } else if (body?.error === "invalid_repo") {
      stats.error = "invalid_repo";
    } else if (body?.error === "repo_not_found") {
      stats.error = "repo_not_found";
    } else if (body?.error === "link_github") {
      needsGithub = true;
    }
  } catch {
    /* network hiccup: show zeros */
  }

  return { stats, needsGithub };
}

export function DevModeProvider({ children }: { children: ReactNode }) {
  const { status, isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;

  const [ghStatus, setGhStatus] = useState<GithubStatus | null>(null);
  const [needsGithubReconnect, setNeedsGithubReconnect] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [commits, setCommits] = useState<Record<string, ProjectCommitRow[]>>({});
  const [syncErrors, setSyncErrors] = useState<Record<string, string | null>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(SELECTED_KEY),
  );
  const autoSynced = useRef(new Set<string>());

  const connected = Boolean(ghStatus?.connected) && !needsGithubReconnect;
  const canReadPrivate = connected && Boolean(ghStatus?.canReadPrivate);

  const repoProjects = useMemo(
    () => projects.filter((p) => Boolean(p.github_repo)),
    [projects],
  );
  const selectedProject =
    repoProjects.find((p) => p.id === selectedId) ?? repoProjects[0] ?? null;

  const refreshStats = useCallback(async (p: ProjectRow) => {
    const { stats: next, needsGithub } = await loadProjectStats(p);
    setStats((prev) => ({ ...prev, [p.id]: next }));
    if (needsGithub) setNeedsGithubReconnect(true);
  }, []);

  const updateProject = useCallback(
    (p: ProjectRow) => {
      const before = projects.find((x) => x.id === p.id);
      setProjects((prev) => prev.map((x) => (x.id === p.id ? p : x)));
      if (before?.github_repo !== p.github_repo) void refreshStats(p);
    },
    [projects, refreshStats],
  );

  const runSync = useCallback(
    async (project: ProjectRow, withGithub: boolean) => {
      const key = dataKey(project);
      let error: string | null = null;
      if (withGithub) {
        const res = await syncProjectCommits(project.id);
        if (res.ok) {
          setProjects((prev) =>
            prev.map((x) => (x.id === res.project.id ? res.project : x)),
          );
        } else {
          error = res.error;
          if (res.error === "link_github") setNeedsGithubReconnect(true);
        }
      }
      const rows = await listProjectCommits(createClient(), project.id).catch(
        () => null,
      );
      setCommits((prev) => ({ ...prev, [key]: rows ?? prev[key] ?? [] }));
      setSyncErrors((prev) => ({ ...prev, [key]: error }));
    },
    [],
  );

  useEffect(() => {
    if (status === "loading" || !isAuthenticated || !userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/github/status");
        const body = (await res.json()) as GithubStatus;
        if (!cancelled) setGhStatus(body);
      } catch {
        if (!cancelled) {
          setGhStatus({ connected: false, login: null, canReadPrivate: false });
        }
      }
    })();

    void (async () => {
      try {
        const list = await listProjects(createClient());
        if (cancelled) return;
        setProjects(list);
        setProjectsLoaded(true);
        await Promise.all(list.map((p) => refreshStats(p)));
      } catch {
        if (!cancelled) {
          setProjects([]);
          setProjectsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, isAuthenticated, userId, refreshStats]);

  useEffect(() => {
    if (!ghStatus) return;
    const pending = repoProjects.filter((p) => {
      const key = syncKey(p, connected);
      if (autoSynced.current.has(key)) return false;
      autoSynced.current.add(key);
      return true;
    });
    if (pending.length === 0) return;

    void (async () => {
      await Promise.all(pending.map((p) => runSync(p, connected)));
    })();
  }, [ghStatus, repoProjects, connected, runSync]);

  const syncProject = useCallback(
    async (p: ProjectRow) => {
      setSyncing((prev) => ({ ...prev, [p.id]: true }));
      await runSync(p, true);
      setSyncing((prev) => ({ ...prev, [p.id]: false }));
    },
    [runSync],
  );

  const selectProject = useCallback((id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const addProject = useCallback(
    (p: ProjectRow) => {
      setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
      void refreshStats(p);
      if (p.github_repo) selectProject(p.id);
    },
    [refreshStats, selectProject],
  );

  const removeProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((x) => x.id !== id));
    setStats((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const linkGithub = useCallback(async () => {
    await createClient().auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "read:user repo",
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}&gh=1`,
      },
    });
  }, []);

  const value: DevModeValue = {
    ghStatus,
    connected,
    canReadPrivate,
    needsGithubReconnect,
    linkGithub,
    projectsLoaded,
    projects,
    repoProjects,
    stats,
    selectedProject,
    selectProject,
    commitsFor: (p) => commits[dataKey(p)],
    syncErrorFor: (p) => syncErrors[dataKey(p)] ?? null,
    isSyncing: (p) => Boolean(syncing[p.id]) || commits[dataKey(p)] === undefined,
    syncProject,
    addProject,
    updateProject,
    removeProject,
  };

  return (
    <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>
  );
}

export function useDevMode(): DevModeValue {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error("useDevMode must be used inside DevModeProvider");
  return ctx;
}
