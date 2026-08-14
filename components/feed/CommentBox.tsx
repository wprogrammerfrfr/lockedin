"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  addComment,
  deleteComment,
  listComments,
  type FeedComment,
} from "@/features/feed/api";
import { publicAvatarUrl } from "@/features/profile/api";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import { Trash2 } from "lucide-react";

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
}

export function CommentBox({ postId }: { postId: string }) {
  const { user, profileLabel } = useAuth();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await listComments(createClient(), postId);
      setComments(rows);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const row = (await addComment(
        createClient(),
        postId,
        body.trim(),
      )) as FeedComment;
      const username = profileLabel?.replace(/^@/, "") || "you";
      setComments((prev) => [
        ...prev,
        {
          id: row.id,
          post_id: postId,
          user_id: row.user_id || user?.id || "",
          body: row.body || body.trim(),
          created_at: row.created_at || new Date().toISOString(),
          author: {
            username,
            avatar_path: null,
          },
        },
      ]);
      setBody("");
      toast.success("Comment posted");
      void refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Comment failed";
      if (msg === "rate_limited") {
        toast.error("Slow down — max 5 comments per minute.");
      } else {
        toast.error(userFacingError(err, "Comment failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      {loading ? (
        <p className="text-xs text-slate-400">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400">No comments yet.</p>
      ) : (
        <ul className="max-h-48 space-y-2.5 overflow-y-auto">
          {comments.map((c) => {
            const url = publicAvatarUrl(c.author?.avatar_path ?? null);
            const name = c.author?.username || "member";
            return (
              <li key={c.id} className="flex gap-2">
                <Avatar className="mt-0.5 h-7 w-7 shrink-0 rounded-lg">
                  {url ? <AvatarImage src={url} alt="" /> : null}
                  <AvatarFallback className="rounded-lg bg-slate-100 text-[10px]">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-700">
                    <Link
                      href={`/u/${name}`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      @{name}
                    </Link>{" "}
                    <span className="text-slate-600">{c.body}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {relativeTime(c.created_at)}
                  </p>
                </div>
                {user?.id === c.user_id ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-slate-50 hover:text-rose-500"
                    aria-label="Delete comment"
                    onClick={() => {
                      void deleteComment(createClient(), c.id)
                        .then(() => {
                          setComments((prev) =>
                            prev.filter((x) => x.id !== c.id),
                          );
                        })
                        .catch((err) => {
                          toast.error(
                            userFacingError(err, "Could not delete comment"),
                          );
                        });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 250))}
          placeholder="Add a comment…"
          maxLength={250}
          className="rounded-xl"
        />
        <Button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded-xl"
        >
          Post
        </Button>
      </form>
    </div>
  );
}
