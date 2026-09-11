import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/features/profile/types";
import {
  isValidUsername,
  normalizeUsername,
} from "@/lib/profile/username";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, avatar_path, bio, timezone, locale, break_timer_minutes, theme, username_changed_at, username_claimed_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as Profile;
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<{
    bio: string | null;
    timezone: string;
    avatar_path: string | null;
    username: string;
    locale: string;
    break_timer_minutes: number;
    theme: "light" | "dark" | "system";
  }>,
): Promise<Profile> {
  if (patch.username) {
    const normalized = normalizeUsername(patch.username);
    if (!isValidUsername(normalized)) {
      throw new Error("invalid_username");
    }
    const { error: rpcError } = await supabase.rpc("change_username", {
      p_new: normalized,
    });
    if (rpcError) throw new Error(rpcError.message);
  }

  const { username: _ignored, ...rest } = patch;
  const updates = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);
    if (error) throw new Error(error.message);
  }

  const profile = await getProfile(supabase, userId);
  if (!profile) throw new Error("Profile not found after update");
  return profile;
}

export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  if (!AVATAR_MIME.has(file.type)) {
    throw new Error("Avatar must be jpeg, png, or webp.");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("Avatar must be 2MB or smaller.");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  await updateProfile(supabase, userId, { avatar_path: path });
  return path;
}

export function publicAvatarUrl(
  avatarPath: string | null | undefined,
): string | null {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("http")) return avatarPath;
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
  const encoded = avatarPath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/avatars/${encoded}`;
}

export async function deleteOwnAccount(
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw new Error(error.message);
}
