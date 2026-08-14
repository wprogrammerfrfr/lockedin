"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { WelcomeLanding } from "@/components/welcome/WelcomeLanding";

function WelcomeSplash() {
  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-slate-50">
      <motion.div
        className="h-12 w-12 rounded-2xl border-2 border-lime-400"
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "0 0 28px rgba(132,204,22,0.45)" }}
        aria-label="Loading"
      />
    </div>
  );
}

export default function WelcomePage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/lockin");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return <WelcomeSplash />;
  }

  return <WelcomeLanding />;
}
