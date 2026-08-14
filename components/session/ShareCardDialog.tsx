"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Copy, Download, ImageDown, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { StoryExportCard } from "@/components/session/StoryExportCard";
import {
  buildShareCaption,
  formatCentiseconds,
  lockedInForLabel,
  shareCardChrome,
} from "@/features/session/format";
import { exportStoryPng } from "@/features/session/exportStoryPng";
import { shareSessionToFeed } from "@/features/feed/api";
import type { OutcomeKind } from "@/features/session/types";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import { cn } from "@/lib/utils";

export function ShareCardDialog({
  open,
  onOpenChange,
  durationMs,
  outcome,
  displayName,
  avatarUrl,
  sessionId,
  canPost = false,
  sessionName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  durationMs: number;
  outcome: OutcomeKind;
  displayName?: string | null;
  avatarUrl?: string | null;
  sessionId?: string | null;
  canPost?: boolean;
  sessionName?: string | null;
}) {
  const displayOutcome: OutcomeKind =
    outcome === "idle" ? "solid" : outcome === "break" ? "break" : outcome;

  const trimmedSessionName = (sessionName ?? "").trim();
  const chrome = shareCardChrome(durationMs, displayOutcome);

  const [caption, setCaption] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    setCaption(buildShareCaption(durationMs, displayOutcome));
  }, [open, durationMs, displayOutcome]);

  useEffect(() => {
    if (!open) setExporting(false);
  }, [open]);

  async function handleExportStory() {
    setExporting(true);
    try {
      await exportStoryPng(exportRef.current);
      toast.success("Story PNG downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handlePost() {
    if (!sessionId) {
      toast.error("No cloud session to share yet");
      return;
    }
    try {
      await shareSessionToFeed(createClient(), sessionId, caption);
      toast.success("Posted to followers");
    } catch (err) {
      toast.error(userFacingError(err, "Post failed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle>Session Summary</DialogTitle>
          <DialogDescription>
            Screenshot card, 9:16 story export, or post to followers.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br p-6 shadow-soft",
            chrome.gradient,
          )}
        >
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-slate-700/80">
            LockedIn
          </p>
          {trimmedSessionName ? (
            <p className="mt-3 font-display text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              {trimmedSessionName}
            </p>
          ) : null}
          <p className="mt-4 text-5xl leading-none">{chrome.emoji}</p>
          <p className="mt-4 font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {caption}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {chrome.headline}
          </p>
          <Separator className="my-4 bg-white/50" />
          <div className="flex justify-between gap-3 text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              {lockedInForLabel(durationMs)}
              <span className="ml-0.5 text-[0.65em] opacity-70">
                :{formatCentiseconds(durationMs)}
              </span>
            </span>
            <span className="shrink-0">{chrome.footerLabel}</span>
          </div>
        </div>

        {/* Off-screen 9:16 export target */}
        <div
          aria-hidden
          className="pointer-events-none fixed -left-[9999px] top-0 opacity-0"
        >
          <StoryExportCard
            ref={exportRef}
            durationMs={durationMs}
            outcome={displayOutcome}
            displayName={displayName}
            avatarUrl={avatarUrl}
            sessionName={trimmedSessionName || null}
            caption={caption}
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex w-full flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={handleExportStory}
              disabled={exporting}
            >
              <ImageDown className="h-4 w-4" />
              Export Story
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={handleExportStory}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(caption);
                  toast.success("Caption copied");
                } catch {
                  toast.error("Clipboard unavailable");
                }
              }}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          {canPost && (
            <Button className="w-full rounded-xl" onClick={handlePost}>
              <Share2 className="h-4 w-4" />
              Post to followers
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
