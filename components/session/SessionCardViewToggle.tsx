"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SessionCardView = "summary" | "receipt";

const VIEW_KEY = "lockedin.sessionCardView";

export function readStoredSessionCardView(): SessionCardView {
  if (typeof window === "undefined") return "summary";
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "receipt" ? "receipt" : "summary";
  } catch {
    return "summary";
  }
}

export function persistSessionCardView(next: SessionCardView) {
  try {
    window.localStorage.setItem(VIEW_KEY, next);
  } catch {
    /* ignore */
  }
}

/** Segmented Summary | Receipt control (pill style matching Calendar/List). */
export function SessionCardViewToggle({
  value,
  onChange,
  className,
}: {
  value: SessionCardView;
  onChange: (next: SessionCardView) => void;
  className?: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v === "receipt" ? "receipt" : "summary")}
      className={cn("w-full", className)}
    >
      <div className="flex justify-center">
        <TabsList className="h-9 bg-slate-100 text-slate-500">
          <TabsTrigger
            value="summary"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900"
          >
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="receipt"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900"
          >
            Receipt
          </TabsTrigger>
        </TabsList>
      </div>
    </Tabs>
  );
}

/** Hydrate preferred card view from localStorage after mount. */
export function useSessionCardView(
  initial: SessionCardView = "summary",
): [SessionCardView, (next: SessionCardView) => void] {
  const [view, setView] = useState<SessionCardView>(initial);

  useEffect(() => {
    setView(readStoredSessionCardView());
  }, []);

  function setViewPersist(next: SessionCardView) {
    setView(next);
    persistSessionCardView(next);
  }

  return [view, setViewPersist];
}
