"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { springSoft } from "@/components/session/state-accent";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { detectAndUpsertTimezone } from "@/features/profile/timezone";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type LayoutMode = "chrome" | "solo-focus" | "room-focus";

type AppShellProps = {
  layoutMode: LayoutMode;
  children: React.ReactNode;
  idleLeft?: React.ReactNode;
  presence?: React.ReactNode;
  presenceStrip?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
};

export function AppShell({
  layoutMode,
  children,
  idleLeft,
  presence,
  presenceStrip,
  sidebarFooter,
}: AppShellProps) {
  const { status, user } = useAuth();
  const showSidebar = layoutMode === "chrome";
  const showIdleLeft = layoutMode === "chrome" && Boolean(idleLeft);
  const showPresence = layoutMode === "room-focus" && Boolean(presence);
  const tzUserId = useRef<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) return;
    if (tzUserId.current === user.id) return;
    tzUserId.current = user.id;
    const supabase = createClient();
    void detectAndUpsertTimezone(supabase).catch(() => undefined);
  }, [status, user?.id]);

  const defaultFooter = (compact: boolean) =>
    sidebarFooter ?? (
      <div
        className={cn(
          "flex items-center",
          compact ? "justify-center" : "justify-start",
        )}
      >
        <NotificationBell />
      </div>
    );

  return (
    <div
      className={cn(
        "flex flex-1 flex-col bg-slate-50",
        layoutMode === "solo-focus" ? "h-svh overflow-hidden" : "min-h-full",
      )}
    >
      {showSidebar && (
        <header
          className="sticky top-0 z-40 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:hidden"
          style={{
            paddingTop: "max(0.5rem, env(safe-area-inset-top))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5 text-slate-700" />
          </Button>
          <Link
            href="/lockin"
            className="font-display text-lg font-bold tracking-tight text-slate-900"
          >
            LockedIn
          </Link>
          <div className="ml-auto">
            <NotificationBell menuAlign="header" />
          </div>
        </header>
      )}

      {showSidebar && (
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent
            side="left"
            className="w-72 p-0 pt-[env(safe-area-inset-top)] sm:max-w-xs"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              App pages and account
            </SheetDescription>
            <Sidebar
              variant="drawer"
              footer={defaultFooter(false)}
              onNavigate={() => setNavOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      {showPresence && (
        <Sheet open={presenceOpen} onOpenChange={setPresenceOpen}>
          <SheetContent
            side="left"
            className="w-80 p-0 pt-[env(safe-area-inset-top)] sm:max-w-sm"
          >
            <SheetTitle className="sr-only">Room presence</SheetTitle>
            <SheetDescription className="sr-only">
              Who is in this room
            </SheetDescription>
            {presence}
          </SheetContent>
        </Sheet>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1",
          layoutMode === "solo-focus" && "h-full overflow-hidden",
        )}
      >
        <AnimatePresence initial={false}>
          {showSidebar && (
            <motion.div
              key="sidebar"
              className="sticky top-0 hidden h-svh shrink-0 lg:block"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={springSoft}
            >
              <Sidebar
                footer={defaultFooter(collapsed)}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((v) => !v)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showPresence && (
            <motion.div
              key="presence"
              className="sticky top-0 hidden h-svh w-64 shrink-0 border-r border-slate-200 bg-white lg:block lg:w-72"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={springSoft}
            >
              {presence}
            </motion.div>
          )}
        </AnimatePresence>

        <main
          className={cn(
            "min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
            layoutMode === "solo-focus"
              ? "flex h-full items-center justify-center overflow-hidden px-3 py-4 sm:px-6"
              : "overflow-y-auto",
          )}
          style={
            layoutMode === "solo-focus"
              ? {
                  paddingTop: "max(1rem, env(safe-area-inset-top))",
                  paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                }
              : undefined
          }
        >
          <motion.div
            layout
            transition={springSoft}
            className={cn(
              "mx-auto w-full",
              layoutMode === "solo-focus" ? "max-w-6xl scale-100" : "max-w-6xl",
            )}
          >
            {showPresence && (
              <button
                type="button"
                className="mb-4 w-full lg:hidden"
                onClick={() => setPresenceOpen(true)}
                aria-label="Open presence"
              >
                {presenceStrip ?? (
                  <span className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-600">
                    Presence
                  </span>
                )}
              </button>
            )}
            {children}
          </motion.div>
        </main>

        <AnimatePresence initial={false}>
          {showIdleLeft && (
            <motion.aside
              key="idle-right"
              className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 lg:block"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={springSoft}
            >
              {idleLeft}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
