"use client";

import { Timer, Hourglass } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BreakMode } from "@/features/session/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function BreakStartDialog({
  open,
  onClose,
  onStart,
  required = false,
  breakTimerMinutes = 15,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (mode: BreakMode) => void;
  required?: boolean;
  breakTimerMinutes?: number;
}) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (required) return;
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-w-md border-slate-200 bg-white"
        onPointerDownOutside={required ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={required ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {required ? t("break.sharedTitle") : t("break.title")}
          </DialogTitle>
          <DialogDescription>{t("break.desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 rounded-2xl border-amber-200 bg-amber-50/60 px-4 py-4 text-left hover:bg-amber-50"
            onClick={() => onStart("count_up")}
          >
            <Timer className="h-5 w-5 shrink-0 text-amber-600" />
            <span>
              <span className="block font-display text-sm font-semibold text-slate-900">
                {t("break.startCountUp")}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {t("break.startCountUpHint")}
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 rounded-2xl border-sky-200 bg-sky-50/60 px-4 py-4 text-left hover:bg-sky-50"
            onClick={() => onStart("count_down")}
          >
            <Hourglass className="h-5 w-5 shrink-0 text-sky-600" />
            <span>
              <span className="block font-display text-sm font-semibold text-slate-900">
                {t("break.startCountDown")}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {t("break.startCountDownHint", { n: breakTimerMinutes })}
              </span>
            </span>
          </Button>
        </div>

        {!required ? (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t("break.keepLockedIn")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
