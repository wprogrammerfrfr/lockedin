"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function ParticleBurst({ active }: { active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const dist = 50 + (i % 5) * 26;
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 30,
          rotate: i * 28,
          color: i % 3 === 0 ? "#84cc16" : i % 3 === 1 ? "#eab308" : "#10b981",
          w: 5 + (i % 3),
          h: 5 + ((i + 1) % 3),
        };
      }),
    []
  );

  return (
    <AnimatePresence>
      {active && (
        <div className="pointer-events-none absolute inset-0 overflow-visible">
          {particles.map((p) => (
            <motion.span
              key={`${p.id}-${active}`}
              className="absolute left-1/2 top-1/2 rounded-sm"
              style={{
                width: p.w,
                height: p.h,
                backgroundColor: p.color,
              }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{
                opacity: 0,
                x: p.x,
                y: p.y,
                rotate: p.rotate,
                scale: 0.35,
              }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
