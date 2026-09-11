import { describe, expect, it } from "vitest";
import {
  createVisualSeed,
  deriveVisualSeed,
  seededRange,
  seededUnit,
} from "@/features/session/melt-seed";
import type { MeltConfig } from "@/features/session/melt-catalog";
import {
  easeInCubic,
  exteriorPoolIntensity,
  iceUnitPose,
  layerPose,
  lerpKeyframes,
  meltPoseFromProgress,
  nearestBodyState,
} from "@/components/session/melt/MeltInterpolation";
import { quantizeProgress } from "@/components/session/melt/MeltLod";
import { createMeltConfig } from "@/features/session/melt-catalog";
import { resolveArtVersion } from "@/features/session/melt-art-version";

describe("melt-seed", () => {
  it("derives a stable seed from config fields", () => {
    const config: MeltConfig = {
      kind: "iceCream",
      containerId: "cone",
      flavorId: "vanilla",
      toppings: ["cherry", "sprinkles"],
      meltDurationMs: 1,
      displayName: "Vanilla Cone",
    };
    expect(deriveVisualSeed(config)).toBe(
      "iceCream-cone-vanilla--cherry,sprinkles",
    );
    expect(deriveVisualSeed(config)).toBe(deriveVisualSeed(config));
  });

  it("prefers stored visualSeed", () => {
    const config: MeltConfig = {
      kind: "ice",
      containerId: "glass_cup",
      iceShapeId: "classic_cube",
      meltDurationMs: 1,
      displayName: "Ice",
      visualSeed: "fixed-seed",
    };
    expect(deriveVisualSeed(config)).toBe("fixed-seed");
  });

  it("is deterministic for the same seed+salt", () => {
    expect(seededUnit("abc", 1)).toBe(seededUnit("abc", 1));
    expect(seededRange("abc", 2, 0, 10)).toBe(seededRange("abc", 2, 0, 10));
    expect(createVisualSeed()).toBeTruthy();
  });
});

describe("melt interpolation", () => {
  it("maps progress to melt poses", () => {
    expect(meltPoseFromProgress(0).stage).toBe("fresh");
    expect(meltPoseFromProgress(0.3).stage).toBe("softening");
    expect(meltPoseFromProgress(0.6).stage).toBe("dripping");
    expect(meltPoseFromProgress(0.8).stage).toBe("pooled");
    expect(meltPoseFromProgress(1).stage).toBe("fully_melted");
    expect(meltPoseFromProgress(1).bodyOpacity).toBe(0);
  });

  it("melts top layers first", () => {
    const top = layerPose(1, 2, 0.4);
    const bottom = layerPose(0, 2, 0.4);
    expect(top.local).toBeGreaterThan(bottom.local);
  });

  it("quantizes progress without changing endpoints", () => {
    expect(quantizeProgress(0)).toBe(0);
    expect(quantizeProgress(1)).toBe(1);
    expect(quantizeProgress(0.333)).toBe(0.325);
  });

  it("picks nearest body state for LOD", () => {
    expect(nearestBodyState(0.1, 2)).toBe("fresh");
    expect(nearestBodyState(0.8, 2)).toBe("pooled");
  });

  it("raises drip before pool so cone trails lead the puddle", () => {
    const mid = meltPoseFromProgress(0.5);
    expect(mid.drip).toBeGreaterThan(0);
    expect(mid.pool).toBe(0);

    const late = meltPoseFromProgress(0.72);
    expect(late.drip).toBeGreaterThan(0.7);
    expect(late.pool).toBeGreaterThan(0);
    expect(late.pool).toBeLessThan(0.2);
    expect(late.drip).toBeGreaterThan(late.pool);
  });

  it("gates exterior puddle until drip trails reach the tip", () => {
    expect(exteriorPoolIntensity(0.5, 0.5)).toBe(0);
    expect(exteriorPoolIntensity(0.79, 1)).toBe(0);
    expect(exteriorPoolIntensity(0.9, 0)).toBe(0);
    expect(exteriorPoolIntensity(0.9, 0.5)).toBeGreaterThan(0);
    expect(exteriorPoolIntensity(0.9, 0.5)).toBeLessThan(0.5);
    expect(exteriorPoolIntensity(1, 1)).toBeCloseTo(1);
  });
});

describe("ice melt smoothness helpers", () => {
  const settleKeys: [number, number, number, number] = [100, 106, 112, 118];

  it("lerpKeyframes is continuous across bucket boundaries", () => {
    const at024 = lerpKeyframes(settleKeys, 0.24);
    const at026 = lerpKeyframes(settleKeys, 0.26);
    const at049 = lerpKeyframes(settleKeys, 0.49);
    const at051 = lerpKeyframes(settleKeys, 0.51);
    // Continuous: ~0.36 over Δt=0.02. Old discrete buckets hopped a full keyframe (6).
    expect(Math.abs(at026 - at024)).toBeLessThan(1);
    expect(Math.abs(at051 - at049)).toBeLessThan(1);
    // Crossing 0.25 must not snap to the next keyframe value.
    expect(at026).not.toBe(settleKeys[1]);
    expect(at024).not.toBe(settleKeys[0]);
    // Endpoints match keyframes.
    expect(lerpKeyframes(settleKeys, 0)).toBe(100);
    expect(lerpKeyframes(settleKeys, 1)).toBe(118);
  });

  it("easeInCubic holds structure early (well below linear mid)", () => {
    expect(easeInCubic(0)).toBe(0);
    expect(easeInCubic(1)).toBe(1);
    expect(easeInCubic(0.5)).toBe(0.125);
    expect(easeInCubic(0.5)).toBeLessThan(0.5);
  });

  it("iceUnitPose keeps a flattened blob with opacity late in melt", () => {
    // The solid parks at a soft puddle floor, then dissolves.
    const pose = iceUnitPose({
      local: 0.983,
      settleY: settleKeys,
      y: 100,
      depthScale: 1,
      sheen: 0.5,
      depthOpacity: 1,
      globalProgress: 0.983,
    });
    expect(pose.opacity).toBeGreaterThan(0);
    expect(pose.scaleY).toBeCloseTo(0.2);
    expect(pose.scaleX).toBeGreaterThan(1);
    expect(pose.scaleX).toBeLessThanOrEqual(1.2);
  });

  it("iceUnitPose still has visible ice at raw 0.95 (no early pop)", () => {
    const pose = iceUnitPose({
      local: 0.95,
      settleY: settleKeys,
      y: 100,
      depthScale: 1,
      sheen: 0.5,
      depthOpacity: 1,
      globalProgress: 0.95,
    });
    expect(pose.opacity).toBeGreaterThan(0.15);
    expect(pose.scaleX).toBeGreaterThan(1);
    expect(pose.scaleY).toBeLessThan(1);
  });

  it("iceUnitPose does not vanish early from phase jitter", () => {
    const pose = iceUnitPose({
      local: 0.99,
      settleY: settleKeys,
      y: 100,
      depthScale: 1,
      sheen: 0.5,
      depthOpacity: 1,
      globalProgress: 0.93,
    });
    expect(pose.melt).toBeLessThanOrEqual(0.995);
    expect(pose.opacity).toBeGreaterThan(0);
  });

  it("iceUnitPose fully clears only when global progress is complete", () => {
    const pose = iceUnitPose({
      local: 1,
      settleY: settleKeys,
      y: 100,
      depthScale: 1,
      sheen: 0.5,
      depthOpacity: 1,
      globalProgress: 1,
    });
    expect(pose.melt).toBe(1);
    expect(pose.opacity).toBe(0);
    expect(pose.scaleY).toBeCloseTo(0.2);
    expect(pose.scaleX).toBeCloseTo(1.2);
  });
});

describe("createMeltConfig art version", () => {
  it("attaches visualSeed and artVersion", () => {
    const config = createMeltConfig({ kind: "iceCream", containerId: "cone" });
    expect(config.visualSeed).toBeTruthy();
    expect(config.artVersion === 1 || config.artVersion === 2).toBe(true);
  });

  it("keeps legacy configs on V1 when artVersion missing", () => {
    const legacy: MeltConfig = {
      kind: "iceCream",
      containerId: "cone",
      flavorId: "vanilla",
      meltDurationMs: 1,
      displayName: "Legacy",
    };
    expect(resolveArtVersion(legacy)).toBe(1);
  });
});
