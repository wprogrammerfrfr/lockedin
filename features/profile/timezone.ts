import type { SupabaseClient } from "@supabase/supabase-js";

/** Detect browser IANA timezone and upsert only when profile still has the signup default. */
export async function detectAndUpsertTimezone(supabase: SupabaseClient) {
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    return { ok: false as const, timezone: tz, reason: "unauthenticated" };
  }

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    return { ok: false as const, timezone: tz, error: readError.message };
  }

  const stored = existing?.timezone?.trim();
  if (stored && stored !== "UTC") {
    return { ok: true as const, timezone: stored, skipped: true as const };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ timezone: tz })
    .eq("id", user.id);

  if (error) {
    return { ok: false as const, timezone: tz, error: error.message };
  }

  return { ok: true as const, timezone: tz };
}
