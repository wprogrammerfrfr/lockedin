"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportContent } from "@/features/moderation/api";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

const REASONS = [
  "Spam",
  "Harassment",
  "Inappropriate content",
  "Impersonation",
  "Other",
] as const;

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "profile" | "post" | "comment";
  targetId: string;
}) {
  const [reason, setReason] = useState<(typeof REASONS)[number]>("Spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await reportContent(
        createClient(),
        targetType,
        targetId,
        reason,
        note.trim() || undefined,
      );
      toast.success("Report submitted. Thanks for helping keep LockedIn safe.");
      onOpenChange(false);
      setNote("");
    } catch (err) {
      toast.error(userFacingError(err, "Could not submit report."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>
            Reports are reviewed by the LockedIn team. False reports may lead to
            account limits.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="report-reason">Reason</Label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) =>
                setReason(e.target.value as (typeof REASONS)[number])
              }
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="report-note">Details (optional)</Label>
            <Input
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              className="mt-1 rounded-xl"
              placeholder="Anything else we should know?"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={busy}
            onClick={() => void submit()}
          >
            <Flag className="mr-1.5 h-4 w-4" />
            {busy ? "Sending…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
