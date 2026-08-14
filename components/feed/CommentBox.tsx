"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addComment } from "@/features/feed/api";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

export function CommentBox({ postId }: { postId: string }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addComment(createClient(), postId, body.trim());
      setBody("");
      toast.success("Comment posted");
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
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 250))}
        placeholder="Add a comment…"
        maxLength={250}
        className="rounded-xl"
      />
      <Button type="submit" disabled={busy || !body.trim()} className="rounded-xl">
        Post
      </Button>
    </form>
  );
}
