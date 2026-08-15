"use client";

import { forwardRef } from "react";
import {
  SessionReceiptCard,
  type SessionReceiptData,
} from "@/components/session/SessionReceiptCard";
import { SessionSummaryCard } from "@/components/session/SessionSummaryCard";
import type { SessionCardView } from "@/components/session/SessionCardViewToggle";
import type { OutcomeKind } from "@/features/session/types";

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
    receipt?: SessionReceiptData | null;
    timeZone?: string;
    cardView?: SessionCardView;
  }
>(function StoryExportCard(
  {
    durationMs,
    outcome,
    displayName,
    avatarUrl,
    sessionName,
    caption,
    receipt,
    timeZone,
    cardView = "summary",
  },
  ref,
) {
  const displayOutcome: OutcomeKind =
    outcome === "idle" ? "solid" : outcome === "break" ? "break" : outcome;

  if (cardView === "receipt") {
    const data: SessionReceiptData = receipt
      ? { ...receipt, flavorCaption: caption || receipt.flavorCaption }
      : {
          sessionName: sessionName,
          kind: "solo",
          activeMs: durationMs,
          outcome: displayOutcome,
          flavorCaption: caption,
        };

    return (
      <SessionReceiptCard
        ref={ref}
        data={data}
        timeZone={timeZone || "UTC"}
        variant="story"
      />
    );
  }

  return (
    <SessionSummaryCard
      ref={ref}
      durationMs={durationMs}
      outcome={displayOutcome}
      sessionName={sessionName}
      caption={caption}
      displayName={displayName}
      avatarUrl={avatarUrl}
      variant="story"
    />
  );
});
