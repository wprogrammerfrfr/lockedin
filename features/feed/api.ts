import type { SupabaseClient } from "@supabase/supabase-js";
import { isSchemaUnavailable } from "@/lib/supabase/errors";

export type FeedPost = {
  id: string;
  author_id: string;
  session_id: string | null;
  caption: string | null;
  image_path?: string | null;
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

export type FeedComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: {
    username: string;
    avatar_path: string | null;
  } | null;
};

async function listFollowingFeedRaw(
  supabase: SupabaseClient,
  limit = 40,
): Promise<FeedPost[]> {
  const selectWithImage =
    "id, author_id, session_id, caption, image_path, show_project_names, created_at, author:profiles!posts_author_id_fkey(username, avatar_path), session:sessions(active_ms, session_name, outcome)";
  const selectWithoutImage =
    "id, author_id, session_id, caption, show_project_names, created_at, author:profiles!posts_author_id_fkey(username, avatar_path), session:sessions(active_ms, session_name, outcome)";

  const first = await supabase
    .from("posts")
    .select(selectWithImage)
    .order("created_at", { ascending: false })
    .limit(limit);

  let rows = first.data as unknown[] | null;
  let error = first.error;

  if (error && /image_path/i.test(error.message)) {
    const second = await supabase
      .from("posts")
      .select(selectWithoutImage)
      .order("created_at", { ascending: false })
      .limit(limit);
    rows = second.data as unknown[] | null;
    error = second.error;
  }

  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }

  return (rows ?? []).map((row) => {
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

export async function enrichFeedPosts(
  supabase: SupabaseClient,
  posts: FeedPost[],
): Promise<FeedPost[]> {
  if (posts.length === 0) return posts;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ids = posts.map((p) => p.id);

  const [{ data: likes }, { data: comments }, { data: myLikes }] =
    await Promise.all([
      supabase.from("likes").select("post_id").in("post_id", ids),
      supabase.from("comments").select("post_id").in("post_id", ids),
      user
        ? supabase
            .from("likes")
            .select("post_id")
            .in("post_id", ids)
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);

  const likeCounts = new Map<string, number>();
  for (const row of likes ?? []) {
    likeCounts.set(row.post_id, (likeCounts.get(row.post_id) ?? 0) + 1);
  }
  const commentCounts = new Map<string, number>();
  for (const row of comments ?? []) {
    commentCounts.set(row.post_id, (commentCounts.get(row.post_id) ?? 0) + 1);
  }
  const likedSet = new Set((myLikes ?? []).map((r) => r.post_id));

  return posts.map((p) => ({
    ...p,
    like_count: likeCounts.get(p.id) ?? 0,
    comment_count: commentCounts.get(p.id) ?? 0,
    liked_by_me: likedSet.has(p.id),
  }));
}

export async function listFollowingFeed(
  supabase: SupabaseClient,
  limit = 40,
): Promise<FeedPost[]> {
  const posts = await listFollowingFeedRaw(supabase, limit);
  try {
    return await enrichFeedPosts(supabase, posts);
  } catch {
    return posts;
  }
}

export async function listComments(
  supabase: SupabaseClient,
  postId: string,
): Promise<FeedComment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, post_id, user_id, body, created_at, author:profiles!comments_user_id_fkey(username, avatar_path)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isSchemaUnavailable(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const r = row as FeedComment & {
      author?: FeedComment["author"] | FeedComment["author"][];
    };
    return {
      ...r,
      author: Array.isArray(r.author) ? r.author[0] : r.author,
    };
  });
}

export async function shareSessionToFeed(
  supabase: SupabaseClient,
  sessionId: string,
  caption?: string,
  imagePath?: string | null,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const payload = {
    author_id: user.id,
    session_id: sessionId,
    caption: caption?.slice(0, 280) ?? null,
    image_path: imagePath ?? null,
    show_project_names: false,
  };

  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      const { data: updated, error: updErr } = await supabase
        .from("posts")
        .update({
          caption: payload.caption,
          image_path: payload.image_path,
        })
        .eq("session_id", sessionId)
        .eq("author_id", user.id)
        .select("*")
        .single();
      if (updErr) throw new Error(updErr.message);

      const { error: shareErr } = await supabase
        .from("sessions")
        .update({ is_shared: true })
        .eq("id", sessionId);
      if (shareErr) throw new Error(shareErr.message);
      return updated;
    }
    throw new Error(error.message);
  }

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

export async function uploadPostCard(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/${sessionId}.png`;
  const { error } = await supabase.storage
    .from("post-cards")
    .upload(path, blob, {
      upsert: true,
      contentType: "image/png",
    });
  if (error) throw new Error(error.message);
  return path;
}

export function publicPostCardUrl(
  imagePath: string | null | undefined,
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const parsed = new URL(base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }
  const encoded = imagePath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/post-cards/${encoded}`;
}

export async function likePost(supabase: SupabaseClient, postId: string) {
  const { error } = await supabase.rpc("like_post", { p_post_id: postId });
  if (error) {
    if (
      isSchemaUnavailable(error) ||
      /function.*like_post/i.test(error.message)
    ) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error: insErr } = await supabase.from("likes").insert({
        post_id: postId,
        user_id: user.id,
      });
      if (insErr) throw new Error(insErr.message);
      return;
    }
    throw new Error(error.message);
  }
}

export async function unlikePost(supabase: SupabaseClient, postId: string) {
  const { error } = await supabase.rpc("unlike_post", { p_post_id: postId });
  if (error) {
    if (
      isSchemaUnavailable(error) ||
      /function.*unlike_post/i.test(error.message)
    ) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error: delErr } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (delErr) throw new Error(delErr.message);
      return;
    }
    throw new Error(error.message);
  }
}

export async function deleteComment(
  supabase: SupabaseClient,
  commentId: string,
) {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
}

export async function deletePost(supabase: SupabaseClient, postId: string) {
  const { data: post } = await supabase
    .from("posts")
    .select("session_id")
    .eq("id", postId)
    .maybeSingle();

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);

  if (post?.session_id) {
    await supabase
      .from("sessions")
      .update({ is_shared: false })
      .eq("id", post.session_id);
  }
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
