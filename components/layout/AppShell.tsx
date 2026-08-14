"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { springSoft } from "@/components/session/state-accent";
import { detectAndUpsertTimezone } from "@/features/profile/timezone";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type LayoutMode = "chrome" | "solo-focus" | "room-focus";

type AppShellProps = {
  layoutMode: LayoutMode;
  children: React.ReactNode;
  idleLeft?: React.ReactNode;
  presence?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
};

export function AppShell({
  layoutMode,
  children,
  idleLeft,
  presence,
  sidebarFooter,
}: AppShellProps) {
  const { status, user } = useAuth();
  const showSidebar = layoutMode === "chrome";
  const showIdleLeft = layoutMode === "chrome" && Boolean(idleLeft);
  const showPresence = layoutMode === "room-focus" && Boolean(presence);
  const tzUserId = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) return;
    if (tzUserId.current === user.id) return;
    tzUserId.current = user.id;
    const supabase = createClient();
    void detectAndUpsertTimezone(supabase).catch(() => undefined);
  }, [status, user?.id]);

  const footer = sidebarFooter ?? (
    <div className="flex items-center justify-center lg:justify-start">
      <NotificationBell />
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-1 bg-slate-50",
        layoutMode === "solo-focus"
          ? "h-svh overflow-hidden"
          : "min-h-full",
      )}
    >
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            key="sidebar"
            className="sticky top-0 h-svh shrink-0"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={springSoft}
          >
            <Sidebar footer={footer} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showPresence && (
          <motion.div
            key="presence"
            className="sticky top-0 h-svh w-64 shrink-0 border-r border-slate-200 bg-white lg:w-72"
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
      >
        <motion.div
          layout
          transition={springSoft}
          className={cn(
            "mx-auto w-full",
            layoutMode === "solo-focus" ? "max-w-6xl scale-100" : "max-w-6xl",
          )}
        >
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
  );
}
