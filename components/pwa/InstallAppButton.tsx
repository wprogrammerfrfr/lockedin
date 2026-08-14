"use client";

import { useState } from "react";
import { Download, Share } from "lucide-react";
import { usePwaInstall } from "@/features/pwa/usePwaInstall";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InstallAppButton() {
  const { installed, canInstall, isIos, promptInstall } = usePwaInstall();
  const [howtoOpen, setHowtoOpen] = useState(false);

  if (installed) return null;

  async function onClick() {
    if (canInstall) {
      await promptInstall();
      return;
    }
    setHowtoOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 rounded-xl"
        onClick={() => void onClick()}
      >
        <Download className="h-4 w-4" />
        <span>Install app</span>
      </Button>

      <Dialog open={howtoOpen} onOpenChange={setHowtoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install LockedIn</DialogTitle>
            <DialogDescription>
              {isIos
                ? "Add LockedIn to your Home Screen to use it like an app."
                : "Install LockedIn from your browser for a full-screen timer on your phone."}
            </DialogDescription>
          </DialogHeader>
          {isIos ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>
                Tap Share
                <Share className="mx-1 inline h-3.5 w-3.5 align-text-bottom text-slate-500" />
                in Safari.
              </li>
              <li>Choose Add to Home Screen.</li>
              <li>Tap Add — LockedIn appears on your Home Screen.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Open this site in Chrome or Edge on your phone.</li>
              <li>Open the browser menu and choose Install app / Add to Home screen.</li>
              <li>Confirm — LockedIn opens in its own window.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
