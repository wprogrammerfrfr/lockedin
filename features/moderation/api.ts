import type { SupabaseClient } from "@supabase/supabase-js";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

export async function blockUser(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.rpc("block_user", {
    p_blocked_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function unblockUser(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.rpc("unblock_user", {
    p_blocked_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function reportContent(
  supabase: SupabaseClient,
  targetType: "profile" | "post" | "comment",
  targetId: string,
  reason: string,
  note?: string,
) {
  const { error } = await supabase.rpc("report_content", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_note: note ?? null,
  });
  if (error) {
    if (isSchemaUnavailable(error)) {
      throw new Error("unavailable");
    }
    throw new Error(error.message);
  }
}
