import type { SupabaseClient } from "@supabase/supabase-js";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

export type FeedPost = {
  id: string;
  author_id: string;
  session_id: string | null;
  caption: string | null;
  show_project_names: boolean;
  created_at: string;
  author?: {
    username: string;
    avatar_path: string | null;
  } | null;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  session?: {
    active_ms: number;
    session_name: string | null;
    outcome: string | null;
  } | null;
};

export async function listFollowingFeed(
  supabase: SupabaseClient,
  limit = 40,
): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, session_id, caption, show_project_names, created_at, author:profiles!posts_author_id_fkey(username, avatar_path), session:sessions(active_ms, session_name, outcome)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const r = row as FeedPost & {
      author?: FeedPost["author"] | FeedPost["author"][];
      session?: FeedPost["session"] | FeedPost["session"][];
    };
    return {
      ...r,
      author: Array.isArray(r.author) ? r.author[0] : r.author,
      session: Array.isArray(r.session) ? r.session[0] : r.session,
    };
  });
}

export async function shareSessionToFeed(
  supabase: SupabaseClient,
  sessionId: string,
  caption?: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      session_id: sessionId,
      caption: caption?.slice(0, 280) ?? null,
      show_project_names: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { error: shareErr } = await supabase
    .from("sessions")
    .update({ is_shared: true })
    .eq("id", sessionId);

  if (shareErr) {
    await supabase.from("posts").delete().eq("id", data.id);
    throw new Error(shareErr.message);
  }

  return data;
}

export async function likePost(supabase: SupabaseClient, postId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("likes").insert({
    post_id: postId,
    user_id: user.id,
  });
  if (error) throw new Error(error.message);
}

export async function unlikePost(supabase: SupabaseClient, postId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function addComment(
  supabase: SupabaseClient,
  postId: string,
  body: string,
) {
  const { data, error } = await supabase.rpc("add_comment", {
    p_post_id: postId,
    p_body: body.slice(0, 250),
  });
  if (error) {
    if (/rate_limited/i.test(error.message)) {
      throw new Error("rate_limited");
    }
    throw new Error(error.message);
  }
  return data;
}
