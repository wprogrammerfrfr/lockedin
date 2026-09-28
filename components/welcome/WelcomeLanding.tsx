"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cloud, Code2, IceCreamCone, Target, Users } from "lucide-react";
import { LockedInLogo } from "@/components/brand/LockedInLogo";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { WelcomeCtas } from "@/components/welcome/WelcomeCtas";
import { WelcomeDevShowcase } from "@/components/welcome/WelcomeDevShowcase";
import { WelcomeFeatures } from "@/components/welcome/WelcomeFeatures";
import { WelcomeHeroEquation } from "@/components/welcome/WelcomeHeroEquation";
import { WelcomeMeltShowcase } from "@/components/welcome/WelcomeMeltShowcase";
import { WelcomeRoomsShowcase } from "@/components/welcome/WelcomeRoomsShowcase";
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
    <div className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      <header
        className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm"
        style={{
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight sm:text-xl"
          >
            <LockedInLogo />
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
            <WelcomeHeroEquation />
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Lock in, join Rooms, and keep deep work streaks. Solo sessions
              work without an account. Sign in to sync hours, sit with 2–6
              people, and share the card.
            </p>
            <div className="mt-8 flex w-full max-w-xl flex-col gap-4">
              <InstallAppButton hero />
              <WelcomeCtas size="xl" stack />
            </div>
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
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">
            Rooms
          </p>
          <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-foreground">
            <Users className="h-7 w-7 text-emerald-600" />
            Lock in with friends.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Shared rooms, presence, and Bet / Nah break votes.
          </p>
          <div className="mt-6">
            <WelcomeRoomsShowcase />
          </div>
        </WelcomeSection>

        <WelcomeSection>
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-lime-600">
            Developer Mode
          </p>
          <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-foreground">
            <Code2 className="h-7 w-7 text-lime-600" />
            Price the build.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Connect GitHub. Every commit on a calendar, how long you&apos;ve
            been building, and what it cost.
          </p>
          <div className="mt-6">
            <WelcomeDevShowcase />
          </div>
        </WelcomeSection>

        <WelcomeSection>
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-amber-600">
            Melt It
          </p>
          <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-foreground">
            <IceCreamCone className="h-7 w-7 text-amber-600" />
            Design it. Watch it melt.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Try the making board here, then MELT IT — in rooms, everyone&apos;s
            dessert sits on one shared table. No account needed for this demo.
          </p>
          <div className="mt-6">
            <WelcomeMeltShowcase />
          </div>
        </WelcomeSection>

        <WelcomeSection>
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Also in the app
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">
            Streaks, share cards, proof.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Dashboard stats, screenshot cards, and verification badges.
          </p>
          <div className="mt-6">
            <WelcomeFeatures />
          </div>
        </WelcomeSection>

        <WelcomeSection>
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Guest or account
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">
            Try it now. Save it later.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  Guest
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Solo focus stays on this device. LOCK IN, BREAK, and TAP OUT
                  all work. Sessions wait in local drafts until you log in.
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
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
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Cloud-backed hours, Rooms, Explore, and streaks. Connect
                  GitHub if you want hours verified against real work.
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
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
          <div className="mt-8 flex w-full max-w-xl flex-col gap-4 sm:mx-auto">
            <InstallAppButton hero />
            <WelcomeCtas size="xl" stack className="justify-center" />
          </div>
        </WelcomeSection>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <LockedInLogo
              as="p"
              className="text-lg tracking-tight"
            />
            <p className="text-sm text-muted-foreground">
              LockedIn — deep work, tracked.
            </p>
          </div>
          <WelcomeCtas />
        </div>
      </footer>
    </div>
  );
}
