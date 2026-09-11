"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { CommentBox } from "@/components/feed/CommentBox";
import { LikeButton } from "@/components/feed/LikeButton";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  deletePost,
  listFollowingFeed,
  publicPostCardUrl,
  type FeedPost,
} from "@/features/feed/api";
import { publicAvatarUrl } from "@/features/profile/api";
import { lockedInForLabel, outcomeEmoji } from "@/features/session/format";
import type { OutcomeKind } from "@/features/session/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

function asOutcome(o: string | null | undefined): OutcomeKind {
  if (o === "pr" || o === "tapout" || o === "break" || o === "solid") return o;
  return "solid";
}

export function FeedList({
  emptyExtra,
}: {
  emptyExtra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const data = await listFollowingFeed(supabase);
        if (!cancelled) setPosts(data);
      } catch {
        if (!cancelled) setError("unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(postId: string) {
    try {
      await deletePost(createClient(), postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success(t("feed.postRemoved"));
    } catch (err) {
      toast.error(userFacingError(err, t("feed.deleteFailed")));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("feed.loading")}</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">{t("feed.unavailable")}</p>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">{t("feed.emptyTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("feed.emptyDesc")}{" "}
          <Link href="/lockin" className="font-medium text-foreground underline">
            {t("nav.lockin")}
          </Link>{" "}
          {t("feed.emptyCta")}
        </p>
        {emptyExtra}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const url = publicAvatarUrl(post.author?.avatar_path ?? null);
        const cardUrl = publicPostCardUrl(post.image_path);
        const outcome = asOutcome(post.session?.outcome);
        const isOwn = user?.id === post.author_id;
        return (
          <Card key={post.id} className="border-border bg-card">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 rounded-xl">
                  {url ? <AvatarImage src={url} alt="" /> : null}
                  <AvatarFallback className="rounded-xl bg-muted text-xs">
                    {(post.author?.username ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${post.author?.username ?? ""}`}
                    className="font-display text-sm font-semibold text-foreground hover:underline"
                  >
                    {post.author?.username}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-xl">{outcomeEmoji(outcome)}</span>
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() =>
                      setMenuOpen((id) => (id === post.id ? null : post.id))
                    }
                    aria-label={t("feed.postActions")}
                  >
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  {menuOpen === post.id ? (
                    <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-border bg-card py-1 shadow-sm">
                      {isOwn ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-600 hover:bg-background"
                          onClick={() => {
                            setMenuOpen(null);
                            void handleDelete(post.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("feed.unshare")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-background"
                          onClick={() => {
                            setMenuOpen(null);
                            setReportPostId(post.id);
                          }}
                        >
                          <Flag className="h-3.5 w-3.5" />
                          {t("social.report")}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {cardUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardUrl}
                  alt=""
                  className="w-full rounded-2xl border border-slate-100 object-cover"
                />
              ) : null}

              <p className="font-mono text-sm tabular-nums text-foreground">
                {lockedInForLabel(post.session?.active_ms ?? 0)}
              </p>
              {post.caption && (
                <p className="text-sm text-muted-foreground">{post.caption}</p>
              )}
              <div className="flex items-center gap-3">
                <LikeButton
                  postId={post.id}
                  liked={Boolean(post.liked_by_me)}
                  count={post.like_count ?? 0}
                />
                {(post.comment_count ?? 0) > 0 ? (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {t("feed.comments", { n: post.comment_count ?? 0 })}
                  </span>
                ) : null}
              </div>
              <CommentBox postId={post.id} />
            </CardContent>
          </Card>
        );
      })}

      {reportPostId ? (
        <ReportDialog
          open
          onOpenChange={(open) => {
            if (!open) setReportPostId(null);
          }}
          targetType="post"
          targetId={reportPostId}
        />
      ) : null}
    </div>
  );
}
