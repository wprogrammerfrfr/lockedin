"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { CommentBox } from "@/components/feed/CommentBox";
import { LikeButton } from "@/components/feed/LikeButton";
import { listFollowingFeed, type FeedPost } from "@/features/feed/api";
import { publicAvatarUrl } from "@/features/profile/api";
import { formatMs, outcomeEmoji } from "@/features/session/format";
import type { OutcomeKind } from "@/features/session/types";
import { createClient } from "@/lib/supabase/client";

function asOutcome(o: string | null | undefined): OutcomeKind {
  if (o === "pr" || o === "tapout" || o === "break" || o === "solid") return o;
  return "solid";
}

export function FeedList() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const data = await listFollowingFeed(supabase);
        if (!cancelled) setPosts(data);
      } catch {
        if (!cancelled) {
          setError("unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading feed…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-slate-500">
        Shared sessions will show up here once people you follow post.
      </p>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No shared sessions yet. Explicit shares from people you follow land
        here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const url = publicAvatarUrl(post.author?.avatar_path ?? null);
        const outcome = asOutcome(post.session?.outcome);
        return (
          <Card key={post.id} className="border-slate-200 bg-white">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 rounded-xl">
                  {url ? <AvatarImage src={url} alt="" /> : null}
                  <AvatarFallback className="rounded-xl bg-slate-100 text-xs">
                    {(post.author?.username ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${post.author?.username ?? ""}`}
                    className="font-display text-sm font-semibold text-slate-800 hover:underline"
                  >
                    {post.author?.username}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-xl">{outcomeEmoji(outcome)}</span>
              </div>
              <p className="font-mono text-sm tabular-nums text-slate-700">
                {formatMs(post.session?.active_ms ?? 0, true)} locked in
              </p>
              {post.caption && (
                <p className="text-sm text-slate-600">{post.caption}</p>
              )}
              <div className="flex items-center gap-3">
                <LikeButton postId={post.id} liked={Boolean(post.liked_by_me)} />
              </div>
              <CommentBox postId={post.id} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
