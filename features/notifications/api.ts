import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationRow } from "@/types/database";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

export async function listNotifications(
  supabase: SupabaseClient,
  limit = 40,
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  id: string,
) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (isSchemaUnavailable(error)) return;
    throw new Error(error.message);
  }
}

export async function markAllNotificationsRead(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) {
    if (isSchemaUnavailable(error)) return;
    throw new Error(error.message);
  }
}

export function unreadCount(rows: NotificationRow[]) {
  return rows.filter((n) => !n.read_at).length;
}
