"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
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
  const { t } = useTranslation();
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v === "receipt" ? "receipt" : "summary")}
      className={cn("w-full", className)}
    >
      <div className="flex justify-center">
        <TabsList className="h-9 bg-muted text-muted-foreground">
          <TabsTrigger
            value="summary"
            className="rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            {t("share.summary")}
          </TabsTrigger>
          <TabsTrigger
            value="receipt"
            className="rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            {t("share.receipt")}
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
