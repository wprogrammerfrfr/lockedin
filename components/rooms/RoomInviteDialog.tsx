"use client";

import { useMemo } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { renderSVG } from "uqr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { roomInviteUrl } from "@/features/rooms/parse-room-invite";
import { shareOrCopyInvite } from "@/features/rooms/share-invite";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function RoomInviteDialog({
  open,
  onOpenChange,
  code,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
}) {
  const { t } = useTranslation();
  const link = useMemo(() => {
    if (typeof window === "undefined") return `/rooms/${code}`;
    return roomInviteUrl(window.location.origin, code);
  }, [code]);

  const qrSvg = useMemo(
    () =>
      renderSVG(link, {
        pixelSize: 6,
        border: 2,
        blackColor: "#fafafa",
        whiteColor: "#09090b",
        ecc: "M",
      }),
    [link],
  );

  async function onCopy() {
    const result = await shareOrCopyInvite(link);
    if (result === "copied") toast.success(t("room.toast.inviteCopied"));
    else if (result === "failed") toast.error(t("room.toast.copyFailed"));
  }

  async function onShare() {
    if (!navigator.share) {
      await onCopy();
      return;
    }
    try {
      await navigator.share({
        title: "LockedIn room",
        text: t("room.inviteShareText"),
        url: link,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await onCopy();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border bg-zinc-950 text-foreground sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {t("room.inviteDialogTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-center text-xs text-zinc-400">
          {t("room.inviteDialogHint")}
        </p>
        <p className="text-center font-mono text-4xl font-bold tabular-nums tracking-[0.25em] text-white">
          {code}
        </p>
        <div
          className="mx-auto w-fit rounded-2xl border border-white/10 bg-zinc-950 p-3"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl border-white/10 bg-zinc-900"
            onClick={() => void onCopy()}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t("room.inviteCopyLink")}
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            onClick={() => void onShare()}
          >
            <Share2 className="mr-2 h-4 w-4" />
            {t("room.inviteShare")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
