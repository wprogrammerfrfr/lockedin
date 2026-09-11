"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeltPreviewIcon } from "@/components/session/MeltScene";
import type { DessertMetadata, MeltPostAction, MeltRecord } from "@/features/session/melt-catalog";
import { meltSummaryLine } from "@/features/session/melt-utils";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type MeltHistoryRow = {
  id: string;
  session_name?: string | null;
  active_ms?: number;
  started_at?: string;
  dessert_metadata?: DessertMetadata | null;
};

function collectMeltRecords(sessions: MeltHistoryRow[]): MeltRecord[] {
  const out: MeltRecord[] = [];
  for (const s of sessions) {
    const meta = s.dessert_metadata;
    if (!meta) continue;
    if (meta.active?.config) out.push(meta.active);
    if (Array.isArray(meta.history)) out.push(...meta.history);
  }
  return out.sort((a, b) => {
    const at = a.completedAt ?? "";
    const bt = b.completedAt ?? "";
    return bt.localeCompare(at);
  });
}

function outcomeLabel(
  action: MeltPostAction | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!action) return null;
  if (action === "trash") return t("melt.postAction.trash");
  if (action === "refreeze") return t("melt.postAction.refreeze");
  if (action === "refreeze_restart") return t("melt.postAction.refreezeRestart");
  return action;
}

export function MeltedCreationsPanel({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<MeltRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await createClient()
          .from("sessions")
          .select("id, dessert_metadata")
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
  }, [userId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">
          {t("melt.dashboard.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("melt.dashboard.loading")}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("melt.dashboard.empty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {records.slice(0, 12).map((rec, i) => (
              <div
                key={`${rec.config.displayName}-${rec.completedAt ?? i}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
              >
                <MeltPreviewIcon
                  config={rec.config}
                  progress={rec.meltProgress}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {rec.config.displayName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {meltSummaryLine(rec.config, rec.meltComplete, t)}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] tabular-nums text-lime-700">
                    {Math.round(rec.meltProgress * 100)}%
                  </p>
                  {rec.outcomeAction ? (
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {outcomeLabel(rec.outcomeAction, t)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {records.length > 0 ? (
          <p className="mt-3 text-[10px] text-muted-foreground">
            {t("melt.dashboard.count", { count: records.length })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
