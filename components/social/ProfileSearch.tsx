"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { searchProfiles } from "@/features/social/api";
import type { ProfileSearchHit } from "@/features/social/types";
import { createClient } from "@/lib/supabase/client";
import { publicAvatarUrl } from "@/features/profile/api";

export function ProfileSearch() {
  const { isAuthenticated, status } = useAuth();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProfileSearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || q.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const data = await searchProfiles(supabase, q);
        if (!cancelled) setHits(data);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, isAuthenticated]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search students…"
          className="rounded-xl pl-9"
        />
      </div>
      {status !== "loading" && !isAuthenticated && (
        <p className="text-xs text-muted-foreground">
          Sign in to search students.
        </p>
      )}
      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}
      <ul className="space-y-2">
        {hits.map((h) => {
          const url = publicAvatarUrl(h.avatar_path);
          return (
            <li key={h.id}>
              <Link
                href={`/u/${h.username}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 hover:bg-background"
              >
                <Avatar className="h-9 w-9 rounded-xl">
                  {url ? <AvatarImage src={url} alt="" /> : null}
                  <AvatarFallback className="rounded-xl bg-muted text-xs">
                    {h.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold text-foreground">
                    @{h.username}
                  </p>
                  {h.bio ? (
                    <p className="truncate text-xs text-muted-foreground">{h.bio}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
