"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, PanelLeft, PanelLeftClose } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedInLogo } from "@/components/brand/LockedInLogo";
import { NAV_ITEMS, navTabFromPathname } from "@/components/layout/nav";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SidebarAuthCard({
  compact,
  onNavigate,
}: {
  compact: boolean;
  onNavigate?: () => void;
}) {
  const { status, profileLabel, avatarUrl, connectedVia } = useAuth();

  if (status === "loading") {
    return (
      <div
        className={cn(
          "rounded-xl border border-slate-200 bg-slate-50 px-2 py-2",
          !compact && "lg:px-3",
        )}
      >
        {!compact && (
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
            Session
          </p>
        )}
      </div>
    );
  }

  if (status === "authenticated") {
    const initials = profileLabel.slice(0, 2).toUpperCase();
    return (
      <Link
        href="/profile"
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-2",
          !compact && "items-start p-3",
        )}
      >
        <Avatar className="h-8 w-8 shrink-0 rounded-lg">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="rounded-lg bg-slate-100 text-[10px]">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xs font-semibold text-slate-800">
              {profileLabel}
            </p>
            {connectedVia && (
              <Badge
                variant="outline"
                className="mt-1 border-slate-200 px-1.5 py-0 text-[10px] font-medium text-slate-500"
              >
                Connected via {connectedVia}
              </Badge>
            )}
          </div>
        )}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-2",
        !compact && "items-stretch p-3",
      )}
    >
      {!compact && (
        <p className="font-display text-xs font-semibold text-slate-700">
          Guest Session
        </p>
      )}
      <Button
        asChild
        size="sm"
        className={cn(
          "h-8 w-8 rounded-xl p-0",
          !compact && "h-8 w-full px-3",
        )}
      >
        <Link href="/login" aria-label="Log In" onClick={onNavigate}>
          <LogIn className={cn("h-4 w-4", !compact && "hidden")} />
          {!compact && <span>Log In</span>}
        </Link>
      </Button>
    </div>
  );
}

export function Sidebar({
  footer,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  variant = "rail",
}: {
  footer?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  variant?: "rail" | "drawer";
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const activeTab = navTabFromPathname(pathname);
  const compact = variant === "rail" && collapsed;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-slate-200 bg-white",
        variant === "drawer" ? "w-full border-r-0 overflow-y-auto" : compact ? "w-16" : "w-56",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center px-3",
          compact ? "justify-center" : "justify-between px-5",
        )}
      >
        <Link
          href="/lockin"
          onClick={onNavigate}
          className="inline-flex items-center font-display text-lg font-bold tracking-tight lg:text-xl"
        >
          <LockedInLogo compact={compact} className="text-lg lg:text-xl" />
        </Link>
        {variant === "rail" && onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 rounded-lg", compact && "hidden")}
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeftClose className="h-4 w-4 text-slate-500" />
          </Button>
        )}
      </div>

      {variant === "rail" && compact && onToggleCollapse && (
        <div className="flex justify-center px-2 pb-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4 text-slate-500" />
          </Button>
        </div>
      )}

      <nav className={cn("flex flex-1 flex-col gap-1 p-2", !compact && "p-3")}>
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          const Icon = item.icon;
          const label = t(`nav.${item.id}`);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 font-display text-sm font-semibold transition-colors",
                compact ? "justify-center" : "justify-start",
                active
                  ? "bg-slate-50 text-emerald-700 shadow-soft"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
              )}
              aria-current={active ? "page" : undefined}
              title={compact ? label : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-emerald-600" : "text-slate-400",
                )}
              />
              {!compact && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        <SidebarAuthCard compact={compact} onNavigate={onNavigate} />
        {footer}
      </div>
    </aside>
  );
}
