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
  usernameClaimed = true,
}: {
  profileUsername?: string | null;
  usernameClaimed?: boolean;
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
    const canShareProfile =
      usernameClaimed &&
      Boolean(profileUsername) &&
      !/^u_[a-f0-9]{8,}$/i.test(profileUsername ?? "");
    const path = canShareProfile
      ? `${origin}/u/${profileUsername}`
      : `${origin}/login`;
    try {
      await navigator.clipboard.writeText(path);
      toast.success(
        canShareProfile
          ? "Invite link copied"
          : "Login link copied — claim a username to share your profile",
      );
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-display text-sm font-semibold text-foreground">
          Invite friends
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          LockedIn is better with mutuals. Share your profile link to get your
          first follows.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 rounded-xl"
          onClick={() => void copyInvite()}
        >
          <Copy className="h-4 w-4" />
          Copy invite
        </Button>
      </div>

      <div>
        <p className="mb-2 font-display text-sm font-semibold text-foreground">
          People to follow
        </p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : hits.length === 0 ? (
          <p className="text-xs text-muted-foreground">No suggestions yet.</p>
        ) : (
          <ul className="space-y-2">
            {hits.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/u/${h.username}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 hover:bg-muted/40"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={publicAvatarUrl(h.avatar_path) ?? undefined}
                    />
                    <AvatarFallback>
                      {(h.username ?? "?").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    @{h.username}
                  </span>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
