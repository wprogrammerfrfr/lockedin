"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cloud, Target, Users } from "lucide-react";
import { WelcomeCtas } from "@/components/welcome/WelcomeCtas";
import { WelcomeFeatures } from "@/components/welcome/WelcomeFeatures";
import { WelcomeHowTo } from "@/components/welcome/WelcomeHowTo";
import { WelcomeTimerPreview } from "@/components/welcome/WelcomeTimerPreview";
import { springSoft } from "@/components/session/state-accent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const VIEW = { once: true, margin: "-80px" as const };

function WelcomeSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEW}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay }}
    >
      {children}
    </motion.section>
  );
}

export function WelcomeLanding() {
  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden bg-slate-50">
      <header
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm"
        style={{
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
          >
            LockedIn
          </Link>
          <WelcomeCtas compact />
        </div>
      </header>

      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-20 overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16 lg:gap-24 lg:py-20">
        <section className="grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
          <motion.div
            className="min-w-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
          >
            <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
              Focus tracking for students
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Competitive deep work for students, developers, doomscrollers, anyone who needs to LOCK TF IN.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Lock in, join Rooms, and keep deep work streaks. Solo sessions
              work without an account. Sign in to sync hours, sit with 2–6
              people, and share the card.
            </p>
            <WelcomeCtas size="xl" stack className="mt-8" />
          </motion.div>
          <motion.div
            className="min-w-0 w-full"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.08 }}
          >
            <WelcomeTimerPreview />
          </motion.div>
        </section>

        <WelcomeSection>
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            How to use it
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            LOCK IN → LOCKED IN → BREAK → TAP OUT
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Hover or tap a step. Same buttons and state colors you’ll see in
            the app.
          </p>
          <div className="mt-6">
            <WelcomeHowTo />
          </div>
        </WelcomeSection>

        <WelcomeSection>
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            What you get
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            Lock in with friends. Price the build.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Rooms for shared sessions. Developer Mode for GitHub cost and time.
          </p>
          <div className="mt-6">
            <WelcomeFeatures />
          </div>
        </WelcomeSection>

        <WelcomeSection>
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            Guest or account
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            Try it now. Save it later.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-slate-500" />
                  Guest
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-600">
                  Solo focus stays on this device. LOCK IN, BREAK, and TAP OUT
                  all work. Sessions wait in local drafts until you log in.
                </p>
                <ul className="space-y-1.5 text-sm text-slate-600">
                  <li>Solo timer, no account</li>
                  <li>Drafts merge after you sign in</li>
                  <li>Rooms and social stay gated</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-lime-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cloud className="h-4 w-4 text-emerald-600" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-600">
                  Cloud-backed hours, Rooms, Explore, and streaks. Connect
                  GitHub if you want hours verified against real work.
                </p>
                <ul className="space-y-1.5 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    Rooms, feed, follows
                  </li>
                  <li>Dashboard, PRs, and streaks</li>
                  <li>GitHub Verified vs Self-Reported</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <WelcomeCtas size="xl" stack className="mt-8 justify-center" />
        </WelcomeSection>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-display text-lg font-bold tracking-tight text-slate-900">
              LockedIn
            </p>
            <p className="text-sm text-slate-500">
              LockedIn — deep work, tracked.
            </p>
          </div>
          <WelcomeCtas />
        </div>
      </footer>
    </div>
  );
}
