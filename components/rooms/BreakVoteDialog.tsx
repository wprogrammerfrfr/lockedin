"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BreakVoteChoice } from "@/features/rooms/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function BreakVoteDialog({
  open,
  endsAt,
  tallies,
  myVote,
  canCancel,
  onVote,
  onCancel,
}: {
  open: boolean;
  endsAt: string | null;
  tallies: { break: number; stay: number };
  myVote: BreakVoteChoice | null;
  canCancel?: boolean;
  onVote: (choice: BreakVoteChoice) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(30);

  useEffect(() => {
    if (!open || !endsAt) return;
    const tick = () => {
      setLeft(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [endsAt, open]);

  const youVoteLabel = myVote
    ? t("room.youVote", {
        choice: myVote === "break" ? t("room.bet") : t("room.nah"),
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-sm border-slate-200 bg-white"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("room.sharedBreakVote")}</DialogTitle>
          <DialogDescription>{t("room.breakVoteDesc")}</DialogDescription>
        </DialogHeader>

        <p className="font-mono text-center text-2xl tabular-nums text-slate-800">
          {left}s
        </p>
        <p className="text-center text-xs text-slate-500">
          {t("room.voteTally", { bet: tallies.break, stay: tallies.stay })}
          {youVoteLabel}
        </p>

        <DialogFooter className="gap-2 sm:justify-center">
          <Button
            className="h-auto flex-col gap-1 rounded-xl bg-amber-100 py-3 text-amber-900 hover:bg-amber-200"
            disabled={Boolean(myVote)}
            onClick={() => onVote("break")}
          >
            <span className="font-display text-base font-bold">{t("room.bet")}</span>
            <span className="text-[11px] font-medium normal-case tracking-normal text-amber-800/80">
              {t("room.takeBreak")}
            </span>
          </Button>
          <Button
            className="h-auto flex-col gap-1 rounded-xl py-3"
            variant="outline"
            disabled={Boolean(myVote)}
            onClick={() => onVote("stay")}
          >
            <span className="font-display text-base font-bold">{t("room.nah")}</span>
            <span className="text-[11px] font-medium normal-case tracking-normal text-slate-500">
              {t("room.stayLockedIn")}
            </span>
          </Button>
        </DialogFooter>
        {canCancel ? (
          <Button
            variant="ghost"
            className="w-full rounded-xl text-slate-500"
            onClick={() => onCancel?.()}
          >
            {t("room.cancelVote")}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
