"use client";

import { useEffect, useState } from "react";
import { CalendarDays, List } from "lucide-react";
import { toast } from "sonner";
import {
  DaySessionsDialog,
  SessionDetailDialog,
  SessionListRow,
} from "@/components/dashboard/DaySessionsDialog";
import { MyLockInsTitle } from "@/components/brand/LockedInLogo";
import { ContributionHeatmap } from "@/components/profile/ContributionHeatmap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  profileSessionHistory,
  profileSessionsForDay,
} from "@/features/social/api";
import type { ProfileDaySession } from "@/features/social/types";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { userFacingError } from "@/lib/supabase/errors";
import type { HeatmapDay } from "@/types/database";
import { cn } from "@/lib/utils";

const VIEW_KEY = "lockedin.historyView";
const HEATMAP_FALLBACK_DAYS = 14;

type HistoryView = "calendar" | "list";

function readStoredView(): HistoryView {
  if (typeof window === "undefined") return "calendar";
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "list" ? "list" : "calendar";
  } catch {
    return "calendar";
  }
}

function dayKey(day: string | HeatmapDay["day"]): string {
  return typeof day === "string" ? day.slice(0, 10) : String(day).slice(0, 10);
}

/** When list RPC is empty/missing, hydrate from the same days the calendar shows. */
async function loadListFromHeatmap(
  username: string,
  timezone: string,
  heatmapDays: HeatmapDay[],
): Promise<ProfileDaySession[]> {
  const activeDays = heatmapDays
    .filter((d) => (Number(d.active_ms) || 0) > 0)
    .map((d) => dayKey(d.day))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, HEATMAP_FALLBACK_DAYS);

  if (activeDays.length === 0) return [];

  const supabase = createClient();
  const batches = await Promise.all(
    activeDays.map((day) =>
      profileSessionsForDay(supabase, username, day, timezone).catch(
        () => [] as ProfileDaySession[],
      ),
    ),
  );

  const byId = new Map<string, ProfileDaySession>();
  for (const rows of batches) {
    for (const row of rows) {
      if (row?.id) byId.set(row.id, row);
    }
  }

  return [...byId.values()].sort((a, b) => {
    const at = a.started_at ?? "";
    const bt = b.started_at ?? "";
    return bt.localeCompare(at);
  });
}

export function SessionHistoryPanel({
  username,
  timezone,
  heatmapDays,
  canShare = false,
  locked = false,
  emptyHint = false,
  unavailable = false,
  /** When omitted, shows logo-style "My Lock ins". Pass a string for public profiles. */
  title,
  subtitle,
}: {
  username: string | null;
  timezone: string;
  heatmapDays: HeatmapDay[];
  canShare?: boolean;
  locked?: boolean;
  emptyHint?: boolean;
  unavailable?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<HistoryView>("calendar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [daySessions, setDaySessions] = useState<ProfileDaySession[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  const [listSessions, setListSessions] = useState<ProfileDaySession[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listHasMore, setListHasMore] = useState(false);
  const [listFromHeatmap, setListFromHeatmap] = useState(false);
  const [detail, setDetail] = useState<ProfileDaySession | null>(null);

  useEffect(() => {
    setView(readStoredView());
  }, []);

  function setViewPersist(next: HistoryView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  // Load day sessions when calendar day opens
  useEffect(() => {
    if (!dayOpen || !selectedDay || !username || locked) {
      setDaySessions([]);
      setDayError(null);
      return;
    }
    let cancelled = false;
    setDayLoading(true);
    setDayError(null);
    void (async () => {
      try {
        const rows = await profileSessionsForDay(
          createClient(),
          username,
          selectedDay,
          timezone,
        );
        if (!cancelled) setDaySessions(rows);
      } catch (err) {
        if (!cancelled) {
          setDaySessions([]);
          setDayError(userFacingError(err, t("dash.loadSessionsFailed")));
        }
      } finally {
        if (!cancelled) setDayLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dayOpen, selectedDay, username, timezone, locked]);

  // Load list when tab active
  useEffect(() => {
    if (view !== "list" || !username || locked) {
      return;
    }
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    setListFromHeatmap(false);
    void (async () => {
      try {
        const rows = await profileSessionHistory(
          createClient(),
          username,
          timezone,
          { limit: 30 },
        );
        if (cancelled) return;

        const heatmapHasSessions = heatmapDays.some(
          (d) => (Number(d.active_ms) || 0) > 0,
        );

        if (rows.length === 0 && heatmapHasSessions) {
          const fallback = await loadListFromHeatmap(
            username,
            timezone,
            heatmapDays,
          );
          if (cancelled) return;
          setListSessions(fallback);
          setListHasMore(false);
          setListFromHeatmap(true);
          return;
        }

        setListSessions(rows);
        setListHasMore(rows.length >= 30);
        setListFromHeatmap(false);
      } catch (err) {
        if (cancelled) return;
        const heatmapHasSessions = heatmapDays.some(
          (d) => (Number(d.active_ms) || 0) > 0,
        );
        if (heatmapHasSessions && username) {
          try {
            const fallback = await loadListFromHeatmap(
              username,
              timezone,
              heatmapDays,
            );
            if (cancelled) return;
            setListSessions(fallback);
            setListHasMore(false);
            setListFromHeatmap(true);
            setListError(null);
            return;
          } catch {
            /* fall through to error */
          }
        }
        setListSessions([]);
        setListError(userFacingError(err, t("dash.loadHistoryFailed")));
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, username, timezone, locked, heatmapDays]);

  async function loadMore() {
    if (!username || listSessions.length === 0 || listFromHeatmap) return;
    const last = listSessions[listSessions.length - 1];
    if (!last?.started_at) return;
    setListLoading(true);
    try {
      const rows = await profileSessionHistory(
        createClient(),
        username,
        timezone,
        { limit: 30, before: last.started_at },
      );
      setListSessions((prev) => [...prev, ...rows]);
      setListHasMore(rows.length >= 30);
    } catch (err) {
      toast.error(userFacingError(err, t("dash.loadMoreFailed")));
    } finally {
      setListLoading(false);
    }
  }

  const tz = timezone || "UTC";

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {title ? (
                <CardTitle className="text-base">{title}</CardTitle>
              ) : (
                <CardTitle className="text-base">
                  <MyLockInsTitle className="text-base" />
                </CardTitle>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {subtitle ?? t("dash.historySubtitle")}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            value={view}
            onValueChange={(v) =>
              setViewPersist(v === "list" ? "list" : "calendar")
            }
          >
            <div className="mb-4 flex justify-end">
              <TabsList className="h-9 bg-muted text-muted-foreground">
                <TabsTrigger
                  value="calendar"
                  className="gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t("dash.calendar")}
                </TabsTrigger>
                <TabsTrigger
                  value="list"
                  className="gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground"
                >
                  <List className="h-3.5 w-3.5" />
                  {t("dash.list")}
                </TabsTrigger>
              </TabsList>
            </div>

            {unavailable ? (
              <p className="mb-3 text-sm text-muted-foreground">
                {t("dash.statsUnavailable")}
              </p>
            ) : null}

            {!username ? (
              <p className="text-sm text-muted-foreground">{t("dash.setUsername")}</p>
            ) : locked && view === "list" ? (
              <p className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                {t("dash.followToUnlock")}
              </p>
            ) : (
              <>
                <TabsContent value="calendar" className="mt-0">
                  <ContributionHeatmap
                    days={heatmapDays}
                    emptyHint={emptyHint}
                    onDayClick={(date) => {
                      if (locked) {
                        toast.message(t("dash.followToSeeSessions"), {
                          description: t("dash.followUnlockDesc"),
                        });
                        return;
                      }
                      setSelectedDay(date);
                      setDayOpen(true);
                    }}
                  />
                </TabsContent>
                <TabsContent value="list" className="mt-0">
                  {listLoading && listSessions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("dash.loadingSessions")}
                    </p>
                  ) : listError ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {listError}
                    </p>
                  ) : listSessions.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                      {t("dash.noSessions")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
                        {listSessions.map((s) => (
                          <li key={s.id}>
                            <SessionListRow
                              session={s}
                              timeZone={tz}
                              showDate
                              onClick={() => setDetail(s)}
                            />
                          </li>
                        ))}
                      </ul>
                      {listHasMore && !listFromHeatmap ? (
                        <Button
                          variant="outline"
                          className={cn("w-full rounded-xl")}
                          disabled={listLoading}
                          onClick={() => void loadMore()}
                        >
                          {listLoading ? t("common.loading") : t("dash.loadMore")}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {username ? (
        <DaySessionsDialog
          open={dayOpen}
          onOpenChange={setDayOpen}
          username={username}
          day={selectedDay}
          timezone={tz}
          canShare={canShare}
          locked={locked}
          sessions={daySessions}
          loading={dayLoading}
          error={dayError}
        />
      ) : null}

      <SessionDetailDialog
        open={Boolean(detail)}
        onOpenChange={(next) => {
          if (!next) setDetail(null);
        }}
        session={detail}
        timeZone={tz}
        canShare={canShare}
      />
    </>
  );
}
