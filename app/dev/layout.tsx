"use client";

import { useState, type ReactNode } from "react";
import { ChromePage } from "@/components/layout/ChromePage";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { DevTabs } from "@/components/dev/DevTabs";
import { Button } from "@/components/ui/button";
import { DevModeProvider, useDevMode } from "@/features/dev-mode/DevModeProvider";

function GithubBanner() {
  const { ghStatus, connected, canReadPrivate, needsGithubReconnect, linkGithub } =
    useDevMode();

  let banner: { text: string; cta: string } | null = null;
  if (ghStatus && !connected) {
    banner = needsGithubReconnect
      ? {
          text: "GitHub session expired. Reconnect to sync commits.",
          cta: "Reconnect GitHub",
        }
      : {
          text: "Connect GitHub to import your commits.",
          cta: "Connect GitHub",
        };
  } else if (ghStatus && connected && !canReadPrivate) {
    banner = {
      text: `Connected as ${ghStatus.login ?? "GitHub"} with public repo access only. Grant access to sync private repos.`,
      cta: "Grant private repo access",
    };
  }

  if (!banner) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{banner.text}</p>
      <Button className="rounded-xl" onClick={() => void linkGithub()}>
        {banner.cta}
      </Button>
    </div>
  );
}

export default function DevLayout({ children }: { children: ReactNode }) {
  const { status, isAuthenticated } = useAuth();
  const [gateDismissed, setGateDismissed] = useState(false);
  const gateOpen = status !== "loading" && !isAuthenticated && !gateDismissed;

  return (
    <ChromePage>
      <DevModeProvider>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Developer Mode
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your commits, how long you&apos;ve been building, and what it cost.
              </p>
            </div>
            <DevTabs />
          </div>

          {isAuthenticated ? (
            <>
              <GithubBanner />
              {children}
            </>
          ) : null}
        </div>
      </DevModeProvider>

      <AuthGateModal
        open={gateOpen}
        onOpenChange={(open) => {
          if (!open) setGateDismissed(true);
        }}
        reason="save_sync"
        onContinueAsGuest={() => setGateDismissed(true)}
      />
    </ChromePage>
  );
}
