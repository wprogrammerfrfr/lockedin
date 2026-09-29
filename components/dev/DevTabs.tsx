"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { FlaskConical, FolderGit2, LayoutDashboard, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dev", label: "Overview", icon: LayoutDashboard },
  { href: "/dev/stats", label: "Stats for nerds", icon: FlaskConical },
  { href: "/dev/projects", label: "Projects", icon: FolderGit2 },
];

function activeHref(pathname: string): string {
  if (pathname.startsWith("/dev/projects")) return "/dev/projects";
  if (pathname.startsWith("/dev/stats")) return "/dev/stats";
  return "/dev";
}

export function DevTabs() {
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Developer Mode">
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 pb-3 pt-1 text-sm font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {isActive ? (
              <motion.span
                layoutId="dev-tab-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
