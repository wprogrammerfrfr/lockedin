"use client";

import { useEffect, useState } from "react";
import { useMotionValue, useSpring, useTransform } from "framer-motion";

import { cn } from "@/lib/utils";

export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 });
  const display = useTransform(spring, (latest) => format(latest));
  const [text, setText] = useState(format(0));

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useEffect(() => {
    const unsub = display.on("change", (v) => setText(v));
    return unsub;
  }, [display]);

  return (
    <span className={cn("font-mono tabular-nums", className)}>{text}</span>
  );
}
