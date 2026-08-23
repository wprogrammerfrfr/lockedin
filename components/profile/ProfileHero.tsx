"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listFollowers,
  listFollowing,
  listFriends,
} from "@/features/social/api";
import type { ProfileSearchHit } from "@/features/social/types";
import type { ProfileSocialCounts } from "@/features/social/types";
import { publicAvatarUrl } from "@/features/profile/api";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ListKind = "friends" | "followers" | "following";

export function ProfileSocialStats({
  counts,
  userId,
  className,
}: {
  counts: ProfileSocialCounts;
  userId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<ListKind | null>(null);

  const items: { label: string; value: number; kind: ListKind }[] = [
    { label: t("profile.friends"), value: counts.friends, kind: "friends" },
    { label: t("profile.followers"), value: counts.followers, kind: "followers" },
    { label: t("profile.following"), value: counts.following, kind: "following" },
  ];

  return (
    <>
      <div className={cn("flex gap-6", className)}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={!userId}
            onClick={() => userId && setOpen(item.kind)}
            className={cn(
              "text-center sm:text-left",
              userId && "cursor-pointer hover:opacity-80",
            )}
          >
            <p className="font-mono text-base font-semibold tabular-nums text-slate-900">
              {item.value}
            </p>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
              {item.label}
            </p>
          </button>
        ))}
      </div>

      {userId && open ? (
        <SocialListDialog
          open
          onOpenChange={(v) => {
            if (!v) setOpen(null);
          }}
          userId={userId}
          kind={open}
        />
      ) : null}
    </>
  );
}

function SocialListDialog({
  open,
  onOpenChange,
  userId,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  kind: ListKind;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ProfileSearchHit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const data =
          kind === "friends"
            ? await listFriends(supabase, userId)
            : kind === "followers"
              ? await listFollowers(supabase, userId)
              : await listFollowing(supabase, userId);
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, kind]);

  const title =
    kind === "friends"
      ? t("profile.friends")
      : kind === "followers"
        ? t("profile.followers")
        : t("profile.following");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(80vh,28rem)] max-w-sm overflow-y-auto rounded-2xl border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-slate-400">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400">{t("profile.noOneHere")}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((h) => {
              const url = publicAvatarUrl(h.avatar_path);
              return (
                <li key={h.id}>
                  <Link
                    href={`/u/${h.username}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      {url ? <AvatarImage src={url} alt="" /> : null}
                      <AvatarFallback className="rounded-lg bg-slate-100 text-[10px]">
                        {h.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium text-slate-800">
                      @{h.username}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProfileHeroAvatar({
  name,
  avatarUrl,
  editable,
  onPickFile,
  size = "lg",
}: {
  name: string;
  avatarUrl?: string | null;
  editable?: boolean;
  onPickFile?: (file: File) => void;
  size?: "md" | "lg";
}) {
  const { t } = useTranslation();
  const dim = size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16";

  return (
    <label
      className={cn(
        "relative shrink-0",
        editable && "cursor-pointer",
        !editable && "cursor-default",
      )}
    >
      <Avatar className={cn("rounded-2xl", dim)}>
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {editable ? (
        <>
          <span className="absolute inset-0 flex items-end justify-center rounded-2xl bg-slate-950/0 text-[10px] font-medium text-white opacity-0 transition hover:bg-slate-950/45 hover:opacity-100">
            <span className="mb-2">{t("profile.changeAvatar")}</span>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onPickFile?.(file);
            }}
          />
        </>
      ) : null}
    </label>
  );
}

export function ProfileUsernameLink({
  username,
  className,
}: {
  username: string;
  className?: string;
}) {
  return (
    <Link
      href={`/u/${username}`}
      className={cn("text-sm text-slate-500 hover:text-slate-800", className)}
    >
      @{username}
    </Link>
  );
}
