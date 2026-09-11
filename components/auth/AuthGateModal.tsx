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
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export type AuthGateReason =
  | "join_room"
  | "create_room"
  | "save_sync"
  | "social"
  | "follow"
  | "feed";

const REASON_KEYS: Record<AuthGateReason, string> = {
  join_room: "auth.joinRoom",
  create_room: "auth.createRoom",
  save_sync: "auth.saveSync",
  social: "auth.accessSocial",
  follow: "auth.followStudents",
  feed: "auth.openFeed",
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
  const { t } = useTranslation();
  const actionLabel = t(REASON_KEYS[reason]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {t("auth.accountRequired")}
          </DialogTitle>
          <DialogDescription>
            {t("auth.guestSoloOnly", { action: actionLabel })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full rounded-xl"
            onClick={() => router.push("/login")}
          >
            <UserRound className="h-4 w-4" />
            {t("auth.logIn")}
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={onContinueAsGuest}
          >
            <Lock className="h-4 w-4" />
            {t("auth.continueGuest")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
