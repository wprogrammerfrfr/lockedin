"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NAV_ITEMS, navTabFromPathname } from "@/components/layout/nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SidebarAuthCard() {
  const { status, profileLabel, avatarUrl, connectedVia } = useAuth();

  if (status === "loading") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 lg:px-3">
        <p className="hidden text-[10px] uppercase tracking-[0.14em] text-slate-400 lg:block">
          Session
        </p>
      </div>
    );
  }

  if (status === "authenticated") {
    const initials = profileLabel.slice(0, 2).toUpperCase();
    return (
      <Link
        href="/profile"
        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-2 lg:items-start lg:p-3"
      >
        <Avatar className="h-8 w-8 shrink-0 rounded-lg">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="rounded-lg bg-slate-100 text-[10px]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 flex-1 lg:block">
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
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 lg:items-stretch lg:p-3">
      <p className="hidden font-display text-xs font-semibold text-slate-700 lg:block">
        Guest Session
      </p>
      <Button asChild size="sm" className="h-8 w-8 rounded-xl p-0 lg:h-8 lg:w-full lg:px-3">
        <Link href="/login" aria-label="Log In">
          <LogIn className="h-4 w-4 lg:hidden" />
          <span className="hidden lg:inline">Log In</span>
        </Link>
      </Button>
    </div>
  );
}

export function Sidebar({
  footer,
}: {
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = navTabFromPathname(pathname);

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-slate-200 bg-white lg:w-56">
      <div className="flex h-16 items-center justify-center px-3 lg:justify-start lg:px-5">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-slate-900 lg:text-xl"
        >
          <span className="lg:hidden">LI</span>
          <span className="hidden lg:inline">LockedIn</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2 lg:p-3">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center justify-center gap-3 rounded-xl px-3 py-3 font-display text-sm font-semibold transition-colors lg:justify-start",
                active
                  ? "bg-slate-50 text-emerald-700 shadow-soft"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-emerald-600" : "text-slate-400",
                )}
              />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        <SidebarAuthCard />
        {footer}
      </div>
    </aside>
  );
}
