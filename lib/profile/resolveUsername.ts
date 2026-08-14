import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow } from "@/types/database";

/**
 * Resolve a username to a profile. If the slug is in username_history,
 * redirect permanently to the current username.
 */
export async function resolveUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<ProfileRow> {
  const slug = username.trim();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, username, avatar_path, bio, timezone, username_changed_at",
    )
    .eq("username", slug)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile) return profile as ProfileRow;

  const { data: hist, error: histError } = await supabase
    .from("username_history")
    .select("profile_id, old_username")
    .eq("old_username", slug)
    .maybeSingle();

  if (histError) throw histError;

  if (hist?.profile_id) {
    const { data: current, error: currentError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", hist.profile_id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (current?.username) {
      redirect(`/u/${current.username}`);
    }
  }

  throw new Error("PROFILE_NOT_FOUND");
}
