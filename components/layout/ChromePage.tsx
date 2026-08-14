"use client";

import { AppShell } from "@/components/layout/AppShell";

export function ChromePage({ children }: { children: React.ReactNode }) {
  return <AppShell layoutMode="chrome">{children}</AppShell>;
}
