"use client";

import { useEffect, useState } from "react";
import { MeltScene } from "@/components/session/MeltScene";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DessertMetadata,
  MeltRecord,
} from "@/features/session/melt-catalog";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type MeltHistoryRow = {
  id: string;
  started_at?: string | null;
  ended_at?: string | null;
  dessert_metadata?: DessertMetadata | null;
};

type MeltCardRecord = MeltRecord & { displayDate?: string };

function collectMeltRecords(sessions: MeltHistoryRow[]): MeltCardRecord[] {
  const out: MeltCardRecord[] = [];
  for (const s of sessions) {
    const meta = s.dessert_metadata;
    if (!meta) continue;
    const sessionDate = s.ended_at || s.started_at || undefined;
    if (meta.active?.config) {
      out.push({
        ...meta.active,
        displayDate: meta.active.completedAt || sessionDate,
      });
    }
    if (Array.isArray(meta.history)) {
      for (const rec of meta.history) {
        out.push({
          ...rec,
          displayDate: rec.completedAt || sessionDate,
        });
      }
    }
  }
  return out.sort((a, b) => {
    const at = a.displayDate ?? a.completedAt ?? "";
    const bt = b.displayDate ?? b.completedAt ?? "";
    return bt.localeCompare(at);
  });
}

function formatMeltDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function MeltedCreationsDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<MeltCardRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) {
      if (!open) {
        setRecords([]);
        setLoading(false);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await createClient()
          .from("sessions")
          .select("id, started_at, ended_at, dessert_metadata")
          .eq("user_id", userId)
          .in("status", ["ended", "tapped_out"])
          .order("started_at", { ascending: false })
          .limit(100);
        if (cancelled) return;
        if (error) {
          setRecords([]);
          return;
        }
        setRecords(
          collectMeltRecords(
            (data ?? []).map((row) => ({
              id: row.id as string,
              started_at: row.started_at as string | null,
              ended_at: (row as { ended_at?: string | null }).ended_at ?? null,
              dessert_metadata: row.dessert_metadata as DessertMetadata | null,
            })),
          ),
        );
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,52rem)] max-w-3xl flex-col gap-3 overflow-hidden border-border bg-card">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("melt.dashboard.title")}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("melt.dashboard.loading")}
            </p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("melt.dashboard.empty")}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {records.slice(0, 12).map((rec, i) => {
                const dateLabel = formatMeltDate(rec.displayDate);
                return (
                  <div
                    key={`${rec.config.displayName}-${rec.displayDate ?? i}-${i}`}
                    className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-100 p-5 text-slate-900 shadow-soft [color-scheme:light]"
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <MeltScene
                        config={rec.config}
                        progress={rec.meltProgress}
                        size="sm"
                        animated={false}
                        className="pointer-events-none"
                      />
                      <p className="font-display text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                        {rec.config.displayName}
                      </p>
                    </div>
                    {dateLabel ? (
                      <p className="mt-4 self-end text-[10px] font-semibold tabular-nums text-slate-800/80">
                        {dateLabel}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {!loading && records.length > 0 ? (
            <p className="mt-3 text-[10px] text-muted-foreground">
              {t("melt.dashboard.count", { count: records.length })}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
