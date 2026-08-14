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

export function BreakVoteDialog({
  open,
  endsAt,
  tallies,
  myVote,
  onVote,
  onClose,
}: {
  open: boolean;
  endsAt: string | null;
  tallies: { break: number; stay: number };
  myVote: BreakVoteChoice | null;
  onVote: (choice: BreakVoteChoice) => void;
  onClose: () => void;
}) {
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

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="max-w-sm border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle>Shared break vote</DialogTitle>
          <DialogDescription>
            Majority of eligible voters wins. Tie or timeout → stay locked in.
          </DialogDescription>
        </DialogHeader>

        <p className="text-center font-mono text-2xl tabular-nums text-slate-800">
          {left}s
        </p>
        <p className="text-center text-xs text-slate-500">
          Break {tallies.break} · Stay {tallies.stay}
          {myVote ? ` · You: ${myVote}` : ""}
        </p>

        <DialogFooter className="gap-2 sm:justify-center">
          <Button
            className="rounded-xl bg-amber-100 text-amber-900 hover:bg-amber-200"
            disabled={Boolean(myVote)}
            onClick={() => onVote("break")}
          >
            Break
          </Button>
          <Button
            className="rounded-xl"
            variant="outline"
            disabled={Boolean(myVote)}
            onClick={() => onVote("stay")}
          >
            Stay Locked In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
