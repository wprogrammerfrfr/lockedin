"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { publicAvatarUrl } from "@/features/profile/api";
import { searchProfiles } from "@/features/social/api";
import type { ProfileSearchHit } from "@/features/social/types";
import { createClient } from "@/lib/supabase/client";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

async function suggestProfiles(
  supabase: ReturnType<typeof createClient>,
): Promise<ProfileSearchHit[]> {
  const { data, error } = await supabase.rpc("suggest_profiles", {
    p_limit: 6,
  });
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (Array.isArray(data) ? data : []) as ProfileSearchHit[];
}

export function ExploreSuggestions({
  profileUsername,
}: {
  profileUsername?: string | null;
}) {
  const [hits, setHits] = useState<ProfileSearchHit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        let rows = await suggestProfiles(supabase);
        if (rows.length === 0) {
          // Fallback: empty search isn't useful; try a common letter
          rows = await searchProfiles(supabase, "a");
        }
        if (!cancelled) setHits(rows.slice(0, 6));
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyInvite() {
    const origin = window.location.origin;
    const path = profileUsername
      ? `${origin}/u/${profileUsername}`
      : `${origin}/login`;
    try {
      await navigator.clipboard.writeText(path);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="font-display text-sm font-semibold text-slate-800">
          Invite friends
        </p>
        <p className="mt-1 text-xs text-slate-500">
          LockedIn is better with mutuals. Share your profile link to get your
          first follows.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 rounded-xl"
          onClick={() => void copyInvite()}
        >
          <Copy className="mr-1.5 h-4 w-4" />
          Copy invite link
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Finding students…</p>
      ) : hits.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <UserPlus className="h-3.5 w-3.5" />
            Suggested
          </p>
          <ul className="space-y-2">
            {hits.map((h) => {
              const url = publicAvatarUrl(h.avatar_path);
              return (
                <li key={h.id}>
                  <Link
                    href={`/u/${h.username}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      {url ? <AvatarImage src={url} alt="" /> : null}
                      <AvatarFallback className="rounded-lg bg-slate-100 text-[10px]">
                        {h.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium text-slate-800">
                      @{h.username}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
