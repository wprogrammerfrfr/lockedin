"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LogIn, Play } from "lucide-react";
import { springSoft } from "@/components/session/state-accent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LIME_CTA =
  "bg-lime-400 text-slate-950 hover:bg-lime-300 border border-lime-500/40";

export function WelcomeCtas({
  size = "default",
  className,
  stack = false,
  compact = false,
}: {
  size?: "default" | "lg" | "xl";
  className?: string;
  stack?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3",
        stack ? "w-full flex-col sm:flex-row" : compact ? "flex-nowrap" : "flex-wrap",
        className,
      )}
    >
      <motion.div
        className={stack ? "w-full sm:w-auto" : undefined}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={springSoft}
      >
        <Button
          asChild
          variant="outline"
          size={size === "xl" ? "lg" : compact ? "sm" : size}
          className={cn(
            "border-slate-200 bg-white",
            stack && "w-full sm:w-auto",
            size === "xl" && "h-14 rounded-2xl px-8 text-base",
          )}
        >
          <Link href="/login">
            <LogIn className={size === "xl" ? "h-5 w-5" : "h-4 w-4"} />
            Log in
          </Link>
        </Button>
      </motion.div>
      <motion.div
        className={cn("relative", stack && "w-full sm:flex-1")}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={springSoft}
      >
        {size === "xl" && (
          <motion.div
            className="pointer-events-none absolute -inset-1.5 rounded-2xl border-2 border-lime-400"
            animate={{ scale: [1, 1.03, 1], opacity: [0.35, 0.85, 0.35] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "0 0 22px rgba(132,204,22,0.35)" }}
          />
        )}
        <Button
          asChild
          size={size === "xl" ? "lg" : compact ? "sm" : size}
          className={cn(
            "relative z-10",
            LIME_CTA,
            stack && "w-full",
            size === "xl" && "h-14 rounded-2xl px-8 text-base",
          )}
        >
          <Link href="/lockin">
            <Play className={size === "xl" ? "h-5 w-5" : "h-4 w-4"} />
            {compact ? (
              <>
                <span className="sm:hidden">Try it</span>
                <span className="hidden sm:inline">Try without logging in</span>
              </>
            ) : (
              "Try without logging in"
            )}
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
