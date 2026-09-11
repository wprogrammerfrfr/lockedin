"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Recycle, Snowflake, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeltScene } from "@/components/session/MeltScene";
import type { MeltConfig, MeltPostAction } from "@/features/session/melt-catalog";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type MeltPostActionDialogProps = {
  open: boolean;
  config: MeltConfig;
  onAction: (action: MeltPostAction) => void;
  onDismiss?: () => void;
};

export function MeltPostActionDialog({
  open,
  config,
  onAction,
  onDismiss,
}: MeltPostActionDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onDismiss?.();
      }}
    >
      <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            {t("melt.postAction.title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("melt.postAction.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center rounded-2xl border border-border bg-background py-4">
          <MeltScene config={config} progress={1} size="sm" animated={false} />
        </div>

        <div className="grid gap-2">
          <Button
            variant="outline"
            className="justify-start border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            onClick={() => onAction("trash")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>
              {t("melt.postAction.trash")}
              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                {t("melt.postAction.trashHint")}
              </span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="justify-start border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
            onClick={() => onAction("refreeze")}
          >
            <Snowflake className="mr-2 h-4 w-4" />
            <span>
              {t("melt.postAction.refreeze")}
              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                {t("melt.postAction.refreezeHint")}
              </span>
            </span>
          </Button>
          <Button
            className="justify-start border border-lime-400/40 bg-lime-400 text-slate-950 hover:bg-lime-300"
            onClick={() => onAction("refreeze_restart")}
          >
            <Recycle className="mr-2 h-4 w-4" />
            <span>
              {t("melt.postAction.refreezeRestart")}
              <span className="mt-0.5 block text-[10px] font-normal text-foreground/70">
                {t("melt.postAction.refreezeRestartHint")}
              </span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
