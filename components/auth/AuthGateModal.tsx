"use client";

import { useRouter } from "next/navigation";
import { Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AuthGateReason =
  | "join_room"
  | "create_room"
  | "save_sync"
  | "social"
  | "follow"
  | "feed";

const REASON_COPY: Record<AuthGateReason, string> = {
  join_room: "Join a Room",
  create_room: "Create a Room",
  save_sync: "Save or sync session stats",
  social: "Access Social",
  follow: "Follow other students",
  feed: "Open the Feed",
};

type AuthGateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueAsGuest: () => void;
  reason?: AuthGateReason;
};

export function AuthGateModal({
  open,
  onOpenChange,
  onContinueAsGuest,
  reason = "join_room",
}: AuthGateModalProps) {
  const router = useRouter();
  const actionLabel = REASON_COPY[reason];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Account required
          </DialogTitle>
          <DialogDescription>
            {actionLabel} needs an account. Guests can keep using Solo focus
            only — Rooms, cloud sync, and social stay locked.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              router.push("/login");
            }}
          >
            <Lock className="h-4 w-4" />
            Log In / Sign Up
          </Button>
          <Button
            variant="outline"
            className="w-full border-slate-200"
            onClick={() => {
              onContinueAsGuest();
              onOpenChange(false);
            }}
          >
            <UserRound className="h-4 w-4" />
            Continue as Guest (Solo Only)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
