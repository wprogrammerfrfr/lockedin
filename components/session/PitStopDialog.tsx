"use client";

import { useMemo } from "react";
import { Clock, Droplets, Leaf, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildBreakChoices } from "@/features/session/format";
import type { BreakChoice } from "@/features/session/types";

export function PitStopDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (choice: BreakChoice) => void;
}) {
  const choices = useMemo(() => buildBreakChoices(), [open]);

  const hydration = choices.find((c) => c.group === "hydration")!;
  const dynamic = choices.filter((c) => c.group === "dynamic");
  const smart = choices.find((c) => c.group === "smart")!;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-lg border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle>Break</DialogTitle>
          <DialogDescription>
            Main timer paused. Pick a break — countdown starts on select.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onSelect(hydration)}
            className="flex w-full items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left transition-colors hover:bg-sky-100"
          >
            <span className="text-2xl" aria-hidden>
              {hydration.emoji}
            </span>
            <span>
              <span className="block font-display text-sm font-semibold text-slate-900">
                {hydration.title}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {hydration.subtitle}
              </span>
            </span>
            <Droplets className="ml-auto h-4 w-4 shrink-0 text-sky-500" />
          </button>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              Dynamic
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {dynamic.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onSelect(choice)}
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-white px-3 py-3 text-left transition-colors hover:bg-amber-50"
                >
                  <span className="text-xl" aria-hidden>
                    {choice.emoji}
                  </span>
                  <span>
                    <span className="block font-display text-sm font-semibold text-slate-900">
                      {choice.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {choice.subtitle}
                    </span>
                  </span>
                  {choice.id === "doomscroll" ? (
                    <Smartphone className="ml-auto h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Leaf className="ml-auto h-3.5 w-3.5 text-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelect(smart)}
            className="flex w-full items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left transition-colors hover:bg-violet-100"
          >
            <span className="text-2xl" aria-hidden>
              {smart.emoji}
            </span>
            <span>
              <span className="block font-display text-sm font-semibold text-slate-900">
                {smart.title}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {smart.subtitle}
              </span>
            </span>
            <Clock className="ml-auto h-4 w-4 shrink-0 text-violet-500" />
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep locked in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
