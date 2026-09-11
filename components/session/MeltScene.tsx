"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { MeltConfig } from "@/features/session/melt-catalog";
import { meltStageFromProgress } from "@/features/session/melt-utils";
import { resolveArtVersion } from "@/features/session/melt-art-version";
import { MeltSceneV1 } from "@/components/session/melt-v1/MeltSceneV1";
import { MeltComposer } from "@/components/session/melt/MeltComposer";
import {
  PROGRESS_RING_CIRC,
  SCENE_VIEWBOX,
  type MeltSceneSize,
} from "@/components/session/melt/types";
import { springSoft } from "@/components/session/state-accent";

export type { MeltSceneSize };
export { SCENE_VIEWBOX, PROGRESS_RING_CIRC };

type MeltSceneProps = {
  config: MeltConfig;
  progress: number;
  compact?: boolean;
  size?: MeltSceneSize;
  className?: string;
  ariaLabel?: string;
  popKey?: number;
  animated?: boolean;
};

function resolveSize(compact?: boolean, size?: MeltSceneSize): MeltSceneSize {
  if (size) return size;
  if (compact) return "sm";
  return "md";
}

/**
 * Thin façade — routes V1 procedural SVG vs V2 layered compositor.
 * All consumers keep importing from this module.
 */
export function MeltScene({
  config,
  progress,
  compact,
  size,
  className,
  ariaLabel,
  popKey,
  animated: animatedProp,
}: MeltSceneProps) {
  const stage = meltStageFromProgress(progress);
  const resolvedSize = resolveSize(compact, size);
  const reducedMotion = useReducedMotion();
  const animated = animatedProp ?? (resolvedSize !== "sm" && !reducedMotion);
  const label =
    ariaLabel ??
    `${config.displayName}, ${Math.round(progress * 100)}% melted, stage ${stage}`;
  const artVersion = resolveArtVersion(config);

  if (artVersion < 2) {
    return (
      <MeltSceneV1
        config={config}
        progress={progress}
        compact={compact}
        size={resolvedSize === "xl" ? "lg" : resolvedSize}
        className={className}
        ariaLabel={ariaLabel}
        popKey={popKey}
        animated={animatedProp}
      />
    );
  }

  return (
    <motion.div
      key={popKey}
      className="relative flex h-full w-full items-center justify-center"
      initial={popKey ? { scale: 0.92 } : false}
      animate={{ scale: 1 }}
      transition={springSoft}
    >
      <MeltComposer
        config={config}
        progress={progress}
        size={resolvedSize}
        animated={!!animated && !reducedMotion}
        className={className}
      />
      <span className="sr-only">{label}</span>
    </motion.div>
  );
}

/** History / feed thumbnail — uses stored progress when provided. */
export function MeltPreviewIcon({
  config,
  progress = 0,
}: {
  config: MeltConfig;
  progress?: number;
}) {
  return (
    <MeltScene
      config={config}
      progress={progress}
      size="sm"
      animated={false}
      className="pointer-events-none"
    />
  );
}
