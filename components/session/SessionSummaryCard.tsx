"use client";

import { forwardRef, useMemo } from "react";
import { LockedInLogo } from "@/components/brand/LockedInLogo";
import { Separator } from "@/components/ui/separator";
import {
  buildShareCaption,
  lockedInForWords,
  shareCardChrome,
} from "@/features/session/format";
import type { OutcomeKind } from "@/features/session/types";
import type { DessertMetadata } from "@/features/session/melt-catalog";
import { MeltScene } from "@/components/session/MeltScene";
import { meltSummaryLine } from "@/features/session/melt-utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

export type SessionSummaryCardProps = {
  durationMs: number;
  outcome: OutcomeKind;
  sessionName?: string | null;
  /** When set, skips regenerating a random caption. */
  caption?: string | null;
  className?: string;
  /** Larger typography for story PNG export. */
  variant?: "card" | "story";
  displayName?: string | null;
  avatarUrl?: string | null;
  dessertMetadata?: DessertMetadata | null;
};

function asDisplayOutcome(outcome: OutcomeKind): OutcomeKind {
  if (outcome === "idle") return "solid";
  if (outcome === "break") return "break";
  return outcome;
}

export const SessionSummaryCard = forwardRef<
  HTMLDivElement,
  SessionSummaryCardProps
>(function SessionSummaryCard(
  {
    durationMs,
    outcome,
    sessionName,
    caption: captionProp,
    className,
    variant = "card",
    displayName,
    avatarUrl,
    dessertMetadata,
  },
  ref,
) {
  const { t } = useTranslation();
  const displayOutcome = asDisplayOutcome(outcome);
  const chrome = shareCardChrome(durationMs, displayOutcome, t);
  const caption = useMemo(() => {
    return (
      captionProp?.trim() ||
      buildShareCaption(durationMs, displayOutcome, Math.random, t)
    );
  }, [captionProp, durationMs, displayOutcome, t]);
  const durationWords = lockedInForWords(durationMs, t);
  const trimmedSessionName = (sessionName ?? "").trim();
  const story = variant === "story";
  const melt = dessertMetadata?.active;

  if (story) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-[1920px] w-[1080px] flex-col justify-between bg-gradient-to-br p-16 text-slate-900",
          chrome.gradient,
          className,
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
            {displayName ? (
              <p className="text-4xl font-bold tracking-tight text-slate-900">
                {displayName}
              </p>
            ) : (
              <LockedInLogo className="text-4xl tracking-tight" />
            )}
            {trimmedSessionName ? (
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {trimmedSessionName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="text-center">
          {melt?.config ? (
            <div className="mx-auto mb-8 flex justify-center">
              <MeltScene
                config={melt.config}
                progress={melt.meltProgress}
                size="md"
                animated={false}
              />
            </div>
          ) : (
            <p className="text-[140px] leading-none">{chrome.emoji}</p>
          )}
          <p className="mt-10 font-display text-5xl font-bold tracking-tight text-slate-900">
            {caption}
          </p>
          {melt?.config ? (
            <p className="mt-4 text-3xl text-amber-900/80">
              {meltSummaryLine(melt.config, melt.meltComplete, t)}
            </p>
          ) : null}
          <p className="mt-8 text-4xl font-semibold leading-snug text-slate-800">
            {durationWords}
          </p>
        </div>

        <p className="text-center text-3xl font-bold tracking-[0.3em] text-slate-800/70">
          {chrome.footerLabel}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br p-6 text-slate-900 shadow-soft [color-scheme:light]",
        chrome.gradient,
        className,
      )}
    >
      <LockedInLogo className="text-sm tracking-tight" />
      {trimmedSessionName ? (
        <p className="mt-3 font-display text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
          {trimmedSessionName}
        </p>
      ) : null}
      {melt?.config ? (
        <div className="mt-4 flex items-center gap-3">
          <MeltScene
            config={melt.config}
            progress={melt.meltProgress}
            size="sm"
            animated={false}
          />
          <p className="text-sm text-amber-900/90">
            {meltSummaryLine(melt.config, melt.meltComplete, t)}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-5xl leading-none">{chrome.emoji}</p>
      )}
      <p className="mt-4 font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        {caption}
      </p>
      <p className="mt-3 text-base font-semibold leading-snug text-slate-800 sm:text-lg">
        {durationWords}
      </p>
      <Separator className="my-4 bg-white/50" />
      <div className="flex justify-end">
        <span className="shrink-0 font-semibold uppercase tracking-wider text-slate-800 text-xs">
          {chrome.footerLabel}
        </span>
      </div>
    </div>
  );
});
