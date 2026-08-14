"use client";

import { forwardRef } from "react";
import {
  formatCentiseconds,
  formatMs,
  shareCardChrome,
} from "@/features/session/format";
import type { OutcomeKind } from "@/features/session/types";
import { cn } from "@/lib/utils";

/** Off-screen 9:16 export layout (1080×1920 CSS px). */
export const StoryExportCard = forwardRef<
  HTMLDivElement,
  {
    durationMs: number;
    outcome: OutcomeKind;
    displayName?: string | null;
    avatarUrl?: string | null;
    sessionName?: string | null;
    caption?: string | null;
  }
>(function StoryExportCard(
  { durationMs, outcome, displayName, avatarUrl, sessionName, caption },
  ref,
) {
  const displayOutcome: OutcomeKind =
    outcome === "idle" ? "solid" : outcome === "break" ? "break" : outcome;

  const trimmedSessionName = (sessionName ?? "").trim();
  const chrome = shareCardChrome(durationMs, displayOutcome);

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-[1920px] w-[1080px] flex-col justify-between bg-gradient-to-br p-16 text-slate-900",
        chrome.gradient,
      )}
      style={{ width: 1080, height: 1920 }}
    >
      <div className="flex items-center gap-6">
        <div className="h-28 w-28 overflow-hidden rounded-3xl bg-white/70">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : null}
        </div>
        <div>
          <p className="text-4xl font-bold tracking-tight">
            {displayName || "LockedIn"}
          </p>
          {trimmedSessionName ? (
            <p className="mt-2 text-2xl font-semibold text-slate-800">
              {trimmedSessionName}
            </p>
          ) : null}
          <p className="mt-2 text-2xl text-slate-700/80">{chrome.headline}</p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-[140px] leading-none">{chrome.emoji}</p>
        <p className="mt-10 font-mono text-7xl font-semibold tabular-nums">
          {formatMs(durationMs, true)}
          <span className="ml-1 text-3xl font-medium opacity-70">
            :{formatCentiseconds(durationMs)}
          </span>
        </p>
        <p className="mt-6 text-3xl font-medium text-slate-700">
          {caption || chrome.headline}
        </p>
      </div>

      <p className="text-center text-3xl font-bold tracking-[0.3em] text-slate-800/70">
        LOCKEDIN
      </p>
    </div>
  );
});
