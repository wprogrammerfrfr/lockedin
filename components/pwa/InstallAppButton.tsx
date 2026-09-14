"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Share } from "lucide-react";
import { springSoft } from "@/components/session/state-accent";
import { usePwaInstall } from "@/features/pwa/usePwaInstall";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const LIME_CTA =
  "bg-lime-400 text-slate-950 hover:bg-lime-300 border border-lime-500/40";

export function InstallAppButton({
  size = "sm",
  label,
  className,
  hero = false,
}: {
  size?: "sm" | "default" | "lg" | "xl";
  label?: string;
  className?: string;
  /** Huge lime Download CTA for the welcome page. */
  hero?: boolean;
}) {
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

  const displayLabel = label ?? (hero ? "Download" : "Install app");

  const button = (
    <Button
      type="button"
      variant={hero ? "default" : "outline"}
      size={hero ? "xl" : size}
      className={cn(
        hero
          ? cn(
              "relative z-10 h-20 w-full rounded-2xl px-10 text-2xl font-bold sm:h-24 sm:text-3xl [&_svg]:size-8 sm:[&_svg]:size-10",
              LIME_CTA,
            )
          : "shrink-0 rounded-xl",
        className,
      )}
      onClick={() => void onClick()}
    >
      <Download className={hero ? undefined : "h-4 w-4"} />
      <span>{displayLabel}</span>
    </Button>
  );

  return (
    <>
      {hero ? (
        <motion.div
          className="relative w-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={springSoft}
        >
          <motion.div
            className="pointer-events-none absolute -inset-1.5 rounded-2xl border-2 border-lime-400 sm:-inset-2 sm:rounded-3xl"
            animate={{ scale: [1, 1.03, 1], opacity: [0.35, 0.85, 0.35] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "0 0 28px rgba(132,204,22,0.45)" }}
          />
          {button}
        </motion.div>
      ) : (
        button
      )}

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
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Tap Share
                <Share className="mx-1 inline h-3.5 w-3.5 align-text-bottom text-muted-foreground" />
                in Safari.
              </li>
              <li>Choose Add to Home Screen.</li>
              <li>Tap Add — LockedIn appears on your Home Screen.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
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
