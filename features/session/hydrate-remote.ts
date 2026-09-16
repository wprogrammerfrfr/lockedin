import type { BreakSegment, BreakTypeId, BreakTypeStored } from "@/features/session/break-types";
import { getBreakType } from "@/features/session/break-types";
import {
  meltFieldsFromDessertMetadata,
  type MeltHydrateFields,
} from "@/features/session/melt-catalog";
import type { Action, SessionState } from "@/features/session/types";
import type { SessionRow } from "@/types/database";
import { applyWallClockCatchUp } from "@/features/session/wall-clock";

function asBreakTypesUsed(raw: unknown): BreakTypeStored[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is BreakTypeStored => typeof x === "string");
}

function asBreakHistory(raw: unknown): BreakSegment[] {
  if (!Array.isArray(raw)) return [];
  const out: BreakSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      typeId?: unknown;
      durationMs?: unknown;
      openEnded?: unknown;
    };
    const typeId = typeof row.typeId === "string" ? row.typeId : null;
    if (!typeId || !getBreakType(typeId)) continue;
    out.push({
      typeId: typeId as BreakTypeId,
      durationMs: Math.max(0, Number(row.durationMs) || 0),
      openEnded: Boolean(row.openEnded),
    });
  }
  return out;
}

function lastBreakTypeId(types: BreakTypeStored[]): BreakTypeId | null {
  for (let i = types.length - 1; i >= 0; i -= 1) {
    const id = types[i];
    if (id && getBreakType(id)) return id as BreakTypeId;
  }
  return null;
}

/** Build a HYDRATE_REMOTE action from a cloud SessionRow (resume / auto-resume). */
export function hydrateRemoteFromSessionRow(row: SessionRow): Extract<
  Action,
  { type: "HYDRATE_REMOTE" }
> {
  let elapsedMs = Number(row.active_ms) || 0;
  let breakMs = Number(row.break_ms) || 0;
  const breakTypesUsed = asBreakTypesUsed(row.break_types_used);
  const breakHistory = asBreakHistory(row.break_history);
  const onBreak = row.status === "on_break";
  const session: SessionState = onBreak ? "ON_BREAK" : "LOCKED_IN";
  const startedAt = row.started_at;
  const lastBreak = lastBreakTypeId(breakTypesUsed);
  const breakOpenEnded = onBreak ? true : undefined;
  const caught = applyWallClockCatchUp(
    elapsedMs,
    breakMs,
    startedAt,
    {
      onBreak,
      breakOpenEnded,
      breakElapsedMs: onBreak ? breakMs : undefined,
      breakRemainingMs: onBreak ? 0 : undefined,
    },
  );
  elapsedMs = caught.activeMs;
  breakMs = caught.breakMs;
  const melt: MeltHydrateFields | null = meltFieldsFromDessertMetadata(
    row.dessert_metadata,
    elapsedMs,
  );

  return {
    type: "HYDRATE_REMOTE",
    remoteSessionId: row.id,
    clientId: row.client_id,
    elapsedMs,
    sessionName: row.session_name,
    startedAt: row.started_at,
    session,
    breakTypesUsed,
    breakHistory,
    breakMs: onBreak || breakMs > 0 ? breakMs : undefined,
    breakTypeId: onBreak ? lastBreak : undefined,
    breakOpenEnded: onBreak ? (breakOpenEnded ?? true) : undefined,
    breakElapsedMs: onBreak
      ? (caught.breakElapsedMs ?? breakMs)
      : undefined,
    breakRemainingMs: onBreak
      ? (caught.breakRemainingMs ?? 0)
      : undefined,
    breakDurationMs: onBreak ? 0 : undefined,
    ...(melt ?? {}),
  };
}
