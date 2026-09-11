"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMs } from "@/features/session/format";
import type { SessionRow } from "@/types/database";

export function ActiveSessionDialog({
  open,
  existing,
  onResume,
  onTapOut,
  onCancel,
}: {
  open: boolean;
  existing: SessionRow | null;
  onResume: () => void;
  onTapOut: () => void;
  onCancel: () => void;
}) {
  const activeMs = Number(existing?.active_ms ?? 0);
  const name = existing?.session_name?.trim() || "Untitled session";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle>Active session elsewhere</DialogTitle>
          <DialogDescription>
            You already have a session in progress. Resume it here, or tap out
            on the other device first. You cannot run two at once.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="font-display text-sm font-semibold text-foreground">
            {name}
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
            {formatMs(activeMs, true)} active · status{" "}
            {existing?.status ?? "active"}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            className="rounded-xl border-border"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
              onClick={onTapOut}
            >
              Tap Out
            </Button>
            <Button className="rounded-xl" onClick={onResume}>
              Resume
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
