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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loadGuestNickname,
  validateGuestNickname,
} from "@/features/rooms/guest-join";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function GuestNicknameDialog({
  open,
  onOpenChange,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onConfirm: (nickname: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNickname(loadGuestNickname());
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = validateGuestNickname(nickname);
    if (!valid) {
      setError(t("room.toast.nicknameInvalid"));
      return;
    }
    setError(null);
    await onConfirm(valid);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border bg-card text-foreground sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {t("room.nicknameTitle")}
          </DialogTitle>
          <DialogDescription>{t("room.nicknameDesc")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="guest-nickname">{t("room.nicknameLabel")}</Label>
            <Input
              id="guest-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder={t("room.nicknamePlaceholder")}
              autoFocus
              autoComplete="nickname"
              maxLength={20}
              disabled={busy}
              className="rounded-xl font-mono"
            />
            {error ? (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("room.nicknameHint")}
              </p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="submit"
              className="w-full rounded-xl"
              disabled={busy}
            >
              {t("room.enter")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {t("settings.cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
