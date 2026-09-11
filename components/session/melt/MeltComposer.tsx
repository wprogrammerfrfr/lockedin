"use client";

import { useId, useMemo } from "react";
import type { MeltConfig } from "@/features/session/melt-catalog";
import { getFlavorOption } from "@/features/session/melt-catalog";
import { buildSoftServeProfile } from "@/features/session/melt-soft-serve";
import {
  buildIcePile,
  getCavity,
  iceInteriorClipPath,
  innerClipPath,
  mouthEllipseClipPath,
  coneScoopClipPath,
  packedFillPath,
  scoopContactShadePath,
  sortCubesForRender,
  interiorCenterX,
  mouthOpeningCenterX,
} from "@/features/session/melt-cavity";
import { deriveVisualSeed, seededRange } from "@/features/session/melt-seed";
import {
  exteriorPoolIntensity,
  iceUnitPose,
  layerPose,
  meltPoseFromProgress,
  solidMeltedFraction as solidMeltedFractionFromScale,
} from "@/components/session/melt/MeltInterpolation";
import { meltLodForSize, quantizeProgress } from "@/components/session/melt/MeltLod";
import { MeltContainerLayers } from "@/components/session/melt/MeltContainer";
import {
  MeltIcePile,
  MeltInteriorFill,
  MeltScoopStack,
} from "@/components/session/melt/MeltBody";
import { MeltToppings } from "@/components/session/melt/MeltToppings";
import {
  MeltCondensation,
  MeltDrips,
  MeltExteriorPuddle,
  MeltIceThresholdDrips,
  MeltLiquidPool,
} from "@/components/session/melt/MeltFx";
import {
  SCENE_VIEWBOX,
  SIZE_CLASSES,
  type MeltSceneSize,
} from "@/components/session/melt/types";
import { cn } from "@/lib/utils";

function darken(hex: string, amount = 0.15) {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, parseInt(n.slice(0, 2), 16) * (1 - amount));
  const g = Math.max(0, parseInt(n.slice(2, 4), 16) * (1 - amount));
  const b = Math.max(0, parseInt(n.slice(4, 6), 16) * (1 - amount));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export type MeltComposerProps = {
  config: MeltConfig;
  progress: number;
  size: MeltSceneSize;
  animated: boolean;
  className?: string;
};

export function MeltComposer({
  config,
  progress,
  size,
  animated,
  className,
}: MeltComposerProps) {
  const clipSuffix = useId().replace(/:/g, "");
  const lod = meltLodForSize(size);
  // Live hero: raw continuous progress. Thumbnails (animated=false): quantized steps.
  const visualProgress = animated ? progress : quantizeProgress(progress);
  const pose = meltPoseFromProgress(visualProgress);
  const seed = deriveVisualSeed(config);
  const cavity = getCavity(config.containerId);
  const mouthScale = config.kind === "iceCream" ? 1.14 : 1;
  const innerClipId = `melt-v2-inner-${clipSuffix}`;
  const mouthClipId = `melt-v2-mouth-${clipSuffix}`;

  if (config.kind === "ice") {
    return (
      <IceComposer
        config={config}
        progress={visualProgress}
        pose={pose}
        seed={seed}
        cavity={cavity}
        lod={lod}
        animated={animated}
        innerClipId={innerClipId}
        className={className}
        size={size}
      />
    );
  }

  return (
    <IceCreamComposer
      config={config}
      progress={visualProgress}
      pose={pose}
      seed={seed}
      cavity={cavity}
      lod={lod}
      animated={animated}
      mouthScale={mouthScale}
      innerClipId={innerClipId}
      mouthClipId={mouthClipId}
      className={className}
      size={size}
    />
  );
}

function IceCreamComposer({
  config,
  progress,
  pose,
  seed,
  cavity,
  lod,
  animated,
  mouthScale,
  innerClipId,
  mouthClipId,
  className,
  size,
}: {
  config: MeltConfig;
  progress: number;
  pose: ReturnType<typeof meltPoseFromProgress>;
  seed: string;
  cavity: ReturnType<typeof getCavity>;
  lod: ReturnType<typeof meltLodForSize>;
  animated: boolean;
  mouthScale: number;
  innerClipId: string;
  mouthClipId: string;
  className?: string;
  size: MeltSceneSize;
}) {
  const flavor = getFlavorOption(config.flavorId ?? "vanilla");
  const color = flavor?.color ?? "#FFE7A3";
  const outline = flavor?.outline ?? darken(color, 0.38);
  const toppings = config.toppings ?? [];
  const profile = useMemo(
    () => buildSoftServeProfile(cavity, config.containerId),
    [cavity, config.containerId],
  );
  const topScoop = profile.scoops[profile.scoops.length - 1];
  const topPose = topScoop
    ? layerPose(topScoop.layer, profile.layerCount, progress)
    : null;
  const topLocal = topPose?.local ?? 0;
  const meltedFraction =
    profile.layerCount > 0
      ? Array.from({ length: profile.layerCount }, (_, layer) =>
          solidMeltedFractionFromScale(
            layerPose(layer, profile.layerCount, progress).scaleY,
          ),
        ).reduce((sum, fraction) => sum + fraction, 0) / profile.layerCount
      : progress;
  const showInteriorLiquid =
    !cavity.isOpen && !profile.interiorFill && meltedFraction > 0.05;

  return (
    <svg
      viewBox={SCENE_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      className={cn(SIZE_CLASSES[size], "overflow-visible", className)}
      role="img"
    >
      <defs>
        <clipPath id={innerClipId}>
          <path d={innerClipPath(cavity)} />
        </clipPath>
        <clipPath id={mouthClipId}>
          {config.containerId === "cone" ? (
            <path d={coneScoopClipPath(cavity)} />
          ) : (
            <>
              <path d={innerClipPath(cavity)} />
              <path
                d={mouthEllipseClipPath(cavity, config.containerId, undefined, mouthScale)}
              />
            </>
          )}
        </clipPath>
      </defs>

      {cavity.isOpen ? (
        <MeltExteriorPuddle
          cavity={cavity}
          color={color}
          poolIntensity={exteriorPoolIntensity(pose.drip, pose.pool)}
        />
      ) : null}
      <MeltContainerLayers containerId={config.containerId} cavity={cavity} role="back" />
      {lod.showCondensation ? (
        <MeltCondensation
          cavity={cavity}
          intensity={progress}
          animated={animated}
        />
      ) : null}

      <g clipPath={`url(#${innerClipId})`}>
        {profile.interiorFill ? (
          <MeltInteriorFill
            fillPath={packedFillPath(cavity)}
            color={color}
            cavityFloorY={cavity.floorY}
            cx={interiorCenterX(cavity, cavity.rimY)}
            progress={progress}
            layerCount={profile.layerCount}
            sheen={pose.sheen}
          />
        ) : null}
        {showInteriorLiquid ? (
          <MeltLiquidPool
            cavity={cavity}
            color={color}
            meltedFraction={meltedFraction}
            opacity={0.78}
            animated={animated}
          />
        ) : null}
      </g>

      <MeltScoopStack
        scoops={profile.scoops}
        layerCount={profile.layerCount}
        progress={progress}
        color={color}
        outline={outline}
        shallowBelly={!!cavity.isOpen}
        sheen={pose.sheen}
        seed={seed}
        flavorId={config.flavorId}
        mouthClipId={mouthClipId}
      />
      {config.containerId === "sundae_glass" && topScoop && topLocal < 1 ? (
        <g clipPath={`url(#${mouthClipId})`}>
          <path
            d={scoopContactShadePath(
              mouthOpeningCenterX(cavity),
              cavity.rimY,
              Math.min(topScoop.r * 0.92, (cavity.rimRight - cavity.rimLeft) / 2 + 1),
              3.2,
            )}
            fill={darken(color, 0.28)}
            opacity={0.28 * (1 - topLocal)}
          />
        </g>
      ) : null}

      <MeltContainerLayers
        containerId={config.containerId}
        cavity={cavity}
        role="front"
        showSheen={lod.showGlassSheen}
      />

      {/* Toppings after front walls so cream/cherry sit on the dessert, not behind the rim */}
      {topScoop && topPose && topPose.opacity > 0 ? (() => {
        const tilt =
          (topScoop.tilt ?? 0) +
          seededRange(seed, 60 + profile.scoops.length - 1, -1.8, 1.8);
        const oy = topScoop.seatY;
        const sagY = topScoop.seatY + topPose.sagY;
        return (
          <g
            opacity={topPose.opacity}
            transform={`translate(${topScoop.cx}, ${oy}) rotate(${tilt}) scale(${topPose.scaleX}, ${topPose.scaleY}) translate(${-topScoop.cx}, ${-oy}) translate(0, ${sagY - oy})`}
          >
            <MeltToppings
              toppings={toppings}
              scoop={topScoop}
              seed={seed}
              localMelt={topLocal}
              maxSprinkles={lod.maxSprinkleDots}
              showTiny={lod.showTinyToppings}
              containerId={config.containerId}
              rimY={cavity.rimY}
            />
          </g>
        );
      })() : null}

      {cavity.isOpen ? (
        <MeltDrips
          cavity={cavity}
          color={color}
          dripIntensity={pose.drip}
          animated={animated}
          seed={seed}
          showLoops={lod.showDripLoops}
        />
      ) : null}
    </svg>
  );
}

function IceComposer({
  config,
  progress,
  pose,
  seed,
  cavity,
  lod,
  animated,
  innerClipId,
  className,
  size,
}: {
  config: MeltConfig;
  progress: number;
  pose: ReturnType<typeof meltPoseFromProgress>;
  seed: string;
  cavity: ReturnType<typeof getCavity>;
  lod: ReturnType<typeof meltLodForSize>;
  animated: boolean;
  innerClipId: string;
  className?: string;
  size: MeltSceneSize;
}) {
  const shape = config.iceShapeId ?? "classic_cube";
  const cubes = useMemo(
    () => buildIcePile(cavity, shape, config.containerId, lod.maxIceCubes, seed),
    [cavity, shape, config.containerId, lod.maxIceCubes, seed],
  );
  const sorted = useMemo(() => sortCubesForRender(cubes), [cubes]);
  const meltedFraction =
    sorted.length > 0
      ? sorted.reduce((sum, cube, i) => {
          const depth = cube.depth ?? 1;
          const depthScale = depth === 0 ? 0.98 : depth === 2 ? 1.02 : 1;
          const unit = iceUnitPose({
            local: Math.min(
              1,
              Math.max(
                0,
                progress + seededRange(seed, 100 + i, -0.07, 0.07),
              ),
            ),
            settleY: cube.settleY,
            y: cube.y,
            depthScale,
            sheen: pose.sheen,
            depthOpacity: 1,
            globalProgress: progress,
          });
          return (
            sum +
            solidMeltedFractionFromScale(unit.scaleY, depthScale)
          );
        }, 0) / sorted.length
      : progress;

  return (
    <svg
      viewBox={SCENE_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      className={cn(SIZE_CLASSES[size], "overflow-visible", className)}
      role="img"
    >
      <defs>
        <clipPath id={innerClipId}>
          <path d={iceInteriorClipPath(cavity, config.containerId)} />
        </clipPath>
      </defs>

      <MeltContainerLayers containerId={config.containerId} cavity={cavity} role="back" />

      <g clipPath={`url(#${innerClipId})`}>
        <MeltIcePile
          cubes={sorted}
          shape={shape}
          progress={progress}
          sheen={pose.sheen}
          seed={seed}
          maxCubes={lod.maxIceCubes}
          detail={lod.size !== "sm"}
          animated={animated}
        />
        <MeltLiquidPool
          cavity={cavity}
          color="#A8DFF8"
          meltedFraction={meltedFraction}
          opacity={
            meltedFraction >= 0.9
              ? 0.5 + (meltedFraction - 0.9) * 3
              : 0.5
          }
          animated={animated}
        />
      </g>

      <MeltContainerLayers
        containerId={config.containerId}
        cavity={cavity}
        role="front"
        showSheen={lod.showGlassSheen}
      />

      {lod.showCondensation ? (
        <MeltCondensation
          cavity={cavity}
          intensity={progress}
          animated={animated}
        />
      ) : null}

      {lod.showCondensation ? (
        <MeltIceThresholdDrips
          cavity={cavity}
          progress={progress}
          animated={animated}
          seed={seed}
        />
      ) : null}
    </svg>
  );
}
