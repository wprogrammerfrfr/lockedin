"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { likePost, unlikePost } from "@/features/feed/api";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import { cn } from "@/lib/utils";

export function LikeButton({
  postId,
  liked = false,
  count = 0,
}: {
  postId: string;
  liked?: boolean;
  count?: number;
}) {
  const [on, setOn] = useState(liked);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !on;
    setOn(next);
    setN((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const supabase = createClient();
      if (next) await likePost(supabase, postId);
      else await unlikePost(supabase, postId);
    } catch (err) {
      setOn(!next);
      setN((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error(userFacingError(err, "Like failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={toggle}
      className="rounded-xl gap-1.5"
    >
      <Heart
        className={cn(
          "h-4 w-4",
          on ? "fill-rose-500 text-rose-500" : "text-muted-foreground",
        )}
      />
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {n > 0 ? n : on ? "Liked" : "Like"}
      </span>
    </Button>
  );
}
