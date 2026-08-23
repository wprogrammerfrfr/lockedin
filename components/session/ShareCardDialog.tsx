"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import {
  SessionReceiptCard,
  type SessionReceiptData,
} from "@/components/session/SessionReceiptCard";
import { SessionSummaryCard } from "@/components/session/SessionSummaryCard";
import {
  SessionCardViewToggle,
  useSessionCardView,
} from "@/components/session/SessionCardViewToggle";
import { StoryExportCard } from "@/components/session/StoryExportCard";
import { springSoft } from "@/components/session/state-accent";
import {
  buildShareCaption,
  receiptOutcomeLabel,
  shareCardChrome,
} from "@/features/session/format";
import {
  cardToPngBlob,
  exportStoryPng,
} from "@/features/session/exportStoryPng";
import {
  shareSessionToFeed,
  uploadPostCard,
} from "@/features/feed/api";
import type { OutcomeKind } from "@/features/session/types";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { userFacingError } from "@/lib/supabase/errors";

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
  timeZone,
  receipt,
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
  timeZone?: string;
  /** Full receipt payload when available (history / room). */
  receipt?: SessionReceiptData | null;
}) {
  const { t } = useTranslation();
  const displayOutcome: OutcomeKind =
    outcome === "idle" ? "solid" : outcome === "break" ? "break" : outcome;

  const [caption, setCaption] = useState("");
  const [cardView, setCardView] = useSessionCardView("summary");
  const exportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [posting, setPosting] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    setCaption(buildShareCaption(durationMs, displayOutcome, Math.random, t));
  }, [open, durationMs, displayOutcome, t]);

  useEffect(() => {
    if (!open) {
      setExporting(false);
      setPosting(false);
    }
  }, [open]);

  const receiptData: SessionReceiptData = useMemo(() => {
    if (receipt) {
      return { ...receipt, flavorCaption: caption || receipt.flavorCaption };
    }
    return {
      sessionName: sessionName,
      kind: "solo",
      activeMs: durationMs,
      outcome: displayOutcome,
      flavorCaption: caption,
    };
  }, [receipt, sessionName, durationMs, displayOutcome, caption]);

  const chrome = shareCardChrome(durationMs, displayOutcome, t);
  const footerHint = receiptOutcomeLabel(displayOutcome, displayOutcome === "pr");
  const resolvedSessionName =
    (receiptData.sessionName ?? sessionName ?? "").trim() || null;

  async function handleExportStory() {
    setExporting(true);
    try {
      await exportStoryPng(exportRef.current);
      toast.success(t("share.storyDownloaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadCard() {
    setExporting(true);
    try {
      const blob = await cardToPngBlob(cardRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lockedin-session.png";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("share.cardDownloaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share.downloadFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function handlePost() {
    if (!sessionId) {
      toast.error(t("share.noSession"));
      return;
    }
    setPosting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not_authenticated");

      let imagePath: string | null = null;
      try {
        const blob = await cardToPngBlob(cardRef.current);
        imagePath = await uploadPostCard(
          supabase,
          user.id,
          sessionId,
          blob,
        );
      } catch {
        // Still post caption if image capture/upload fails.
        imagePath = null;
      }

      await shareSessionToFeed(supabase, sessionId, caption, imagePath);
      toast.success(t("share.postedExplore"), {
        action: {
          label: t("share.view"),
          onClick: () => {
            window.location.assign("/explore");
          },
        },
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(userFacingError(err, t("share.postFailed")));
    } finally {
      setPosting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,52rem)] max-w-md flex-col gap-3 overflow-hidden border-slate-200 bg-white">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {cardView === "summary"
              ? t("dash.sessionSummary")
              : t("dash.sessionReceipt")}
          </DialogTitle>
          <DialogDescription>{t("share.desc")}</DialogDescription>
        </DialogHeader>

        <SessionCardViewToggle
          value={cardView}
          onChange={setCardView}
          className="shrink-0"
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          <AnimatePresence mode="wait" initial={false}>
            {cardView === "summary" ? (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={springSoft}
              >
                <SessionSummaryCard
                  ref={cardRef}
                  durationMs={durationMs}
                  outcome={displayOutcome}
                  sessionName={resolvedSessionName}
                  caption={caption}
                />
              </motion.div>
            ) : (
              <motion.div
                key="receipt"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={springSoft}
              >
                <SessionReceiptCard
                  ref={cardRef}
                  data={receiptData}
                  timeZone={timeZone || "UTC"}
                />
              </motion.div>
            )}
          </AnimatePresence>
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
            sessionName={resolvedSessionName}
            caption={caption}
            receipt={receiptData}
            timeZone={timeZone || "UTC"}
            cardView={cardView}
          />
        </div>

        <p className="shrink-0 text-center text-[11px] text-slate-400">
          {chrome.headline} · {footerHint}
        </p>

        <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-col">
          <div className="flex w-full flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={handleExportStory}
              disabled={exporting || posting}
            >
              <ImageDown className="h-4 w-4" />
              {t("share.exportStory")}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={handleDownloadCard}
              disabled={exporting || posting}
            >
              <Download className="h-4 w-4" />
              {t("share.download")}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(caption);
                  toast.success(t("share.captionCopied"));
                } catch {
                  toast.error(t("share.clipboardUnavailable"));
                }
              }}
            >
              <Copy className="h-4 w-4" />
              {t("share.copy")}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={async () => {
                const shareData = {
                  title: "LockedIn",
                  text: caption,
                };
                try {
                  if (navigator.share) {
                    await navigator.share(shareData);
                  } else {
                    await navigator.clipboard.writeText(caption);
                    toast.success(t("share.captionCopied"));
                  }
                } catch {
                  /* user cancelled share */
                }
              }}
            >
              <Share2 className="h-4 w-4" />
              {t("share.share")}
            </Button>
          </div>
          {canPost && (
            <Button
              className="w-full rounded-xl"
              onClick={() => void handlePost()}
              disabled={posting || exporting}
            >
              <Share2 className="h-4 w-4" />
              {posting ? t("share.posting") : t("share.postFollowers")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
