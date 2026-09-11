import { describe, expect, it } from "vitest";
import {
  buildIcePile,
  coneScoopClipPath,
  cubesTouch,
  getCavity,
  getInsetCavity,
  getInteriorHalfWidthAtY,
  iceInteriorClipPath,
  floorSurfaceY,
  interiorEdgesAt,
  interiorWidthAt,
  mouthEllipseClipPath,
  mouthOpeningCenterX,
  pileHash,
  rotatedExtents,
  SCOOP_OVERHANG,
  sortCubesForRender,
} from "@/features/session/melt-cavity";
import { ICE_CREAM_FLAVORS, type IceShapeId } from "@/features/session/melt-catalog";
import {
  alternateShapePath,
  getCubeGeometry,
} from "@/features/session/melt-ice-art";
import {
  buildSoftServeProfile,
  ICE_CREAM_CONTAINER_IDS,
  pointOnScoopCap,
  profileOverlapsRim,
  profileWithinBounds,
  scoopCreasePath,
  scoopDomePath,
  scoopEquatorY,
  scoopSquigglePaths,
  toppingSurfaceFromScoop,
} from "@/features/session/melt-soft-serve";

const ICE_CONTAINERS = [
  "glass_cup",
  "ice_bucket",
  "pitcher",
] as const;

const ICE_SHAPES: IceShapeId[] = ["classic_cube", "sphere"];

describe("ice vessel interior clips", () => {
  it("opens a crown above the rim so masonry peaks are not sliced", () => {
    const cavity = getCavity("glass_cup");
    const path = iceInteriorClipPath(cavity, "glass_cup");
    const inset = getInsetCavity(cavity);
    const crownPeakY = cavity.rimY - 40;
    const capY = crownPeakY + 16;
    const mouthRx = (inset.rimRight - inset.rimLeft) / 2;
    expect(path).toContain(`L ${inset.rimRight} ${capY}`);
    expect(path).toContain(
      `A ${mouthRx} 16 0 0 0 ${inset.rimLeft} ${capY}`,
    );
    expect(path).toContain(`L ${inset.rimLeft} ${cavity.rimY}`);
    expect(path).not.toContain("A 22.5 8");
  });

  it("extends the pitcher clip toward its left pouring spout", () => {
    const cavity = getCavity("pitcher");
    const path = iceInteriorClipPath(cavity, "pitcher");
    expect(path).toContain(`M ${cavity.rimLeft - 0.5} ${cavity.rimY}`);
  });

  it("anchors every vessel to an explicit contact point", () => {
    expect(
      ["cone", "cup", "sundae_glass", "ice_bucket", "pitcher", "glass_cup"].map(
        (id) => getCavity(id).contactY,
      ),
    ).toEqual([171, 173, 171, 176, 173, 173]);
  });
});

describe("ice cream scoops", () => {
  for (const containerId of ICE_CREAM_CONTAINER_IDS) {
    it(`seats a scoop on the rim of ${containerId}`, () => {
      const cavity = getCavity(containerId);
      const profile = buildSoftServeProfile(cavity, containerId);
      expect(profile.scoops.length).toBeGreaterThanOrEqual(1);
      expect(profileOverlapsRim(profile, cavity)).toBe(true);
      expect(profileWithinBounds(profile, cavity)).toBe(true);
    });

    it(`stacks scoops upward with overlap for ${containerId}`, () => {
      const profile = buildSoftServeProfile(getCavity(containerId), containerId);
      for (let i = 1; i < profile.scoops.length; i++) {
        const below = profile.scoops[i - 1]!;
        const cur = profile.scoops[i]!;
        expect(cur.seatY).toBeLessThan(below.seatY);
        expect(cur.r).toBeLessThan(below.r);
        expect(cur.seatY).toBeGreaterThan(below.seatY - below.r);
        expect(cur.layer).toBe(below.layer + 1);
      }
    });

    it(`draws a dome with a wavy crease helper for ${containerId}`, () => {
      const profile = buildSoftServeProfile(getCavity(containerId), containerId);
      const scoop = profile.scoops[0]!;
      const dome = scoopDomePath(scoop.cx, scoop.seatY, scoop.r);
      expect(dome).toMatch(/A /);
      expect(dome.match(/Q /g)?.length).toBeGreaterThanOrEqual(4);
      expect(dome.endsWith("Z")).toBe(true);
      // Path helper still works — render may only stroke crease on the top scoop.
      expect(scoopCreasePath(scoop.cx, scoop.seatY, scoop.r).length).toBeGreaterThan(20);
    });
  }

  it("draws 2–3 simple horizontal scoop squiggle strokes", () => {
    const paths = scoopSquigglePaths(100, 120, 40, 3);
    expect(paths).toHaveLength(3);
    for (const d of paths) {
      expect(d.length).toBeGreaterThan(20);
      expect(d.startsWith("M ")).toBe(true);
      expect(d.match(/Q /g)?.length).toBe(4);
      expect(d.includes("Z")).toBe(false);
    }
    expect(scoopSquigglePaths(100, 120, 40, 2)).toHaveLength(2);
  });

  it("rounds mouth ellipse rim corners instead of sharp L joins", () => {
    const cavity = getCavity("cone");
    const path = mouthEllipseClipPath(cavity, "cone", undefined, 1.14);
    // Filleted corners use Q at the rim — not the old sharp L corner stack.
    expect(path.match(/Q /g)?.length).toBeGreaterThanOrEqual(2);
    expect(path).not.toMatch(
      new RegExp(`M [^\\s]+ ${cavity.rimY} L [^\\s]+ ${cavity.rimY} L `),
    );
    expect(path).toContain(`A `);
  });

  it("avoids the old cone clip vertical wall at x=63", () => {
    const cavity = getCavity("cone");
    const path = coneScoopClipPath(cavity);
    // Old path used vertical L walls at hardcoded x=63 that sheared top scoops.
    // Waffle silhouette may still start near rimLeft+1 (=63); the mouth must flare wider.
    expect(path).not.toMatch(/\bL 63\b/);
    expect(path.match(/Q /g)?.length).toBeGreaterThanOrEqual(2);
    expect(path).toContain("A ");
    const arcTo = path.match(/A [^L]+ 0 0 0 ([-\d.]+) /);
    expect(arcTo).not.toBeNull();
    expect(Number(arcTo![1])).toBeLessThan(63);
  });

  it("documents that the cone top scoop extends left of the old clip wall", () => {
    const profile = buildSoftServeProfile(getCavity("cone"), "cone");
    expect(profile.scoops.length).toBe(2);
    const top = profile.scoops[1]!;
    // Top scoop left edge past old x=63 — why upper scoops must stay unclipped.
    expect(top.cx - top.r).toBeLessThan(63);
  });

  it("packs the sundae glass with interior fill under a nested scoop", () => {
    const cavity = getCavity("sundae_glass");
    const profile = buildSoftServeProfile(cavity, "sundae_glass");
    expect(profile.interiorFill).toBe(true);
    expect(profile.layerCount).toBe(profile.scoops.length + 1);
    expect(profile.scoops[0]!.seatY).toBeGreaterThan(cavity.rimY);
    expect(profile.scoops[0]!.seatY - profile.scoops[0]!.r).toBeLessThan(cavity.rimY);
  });

  it("keeps the sundae mouth wider than the bowl floor and nests the equator on the rim", () => {
    const cavity = getCavity("sundae_glass");
    expect(cavity.rimRight - cavity.rimLeft).toBeGreaterThan(
      cavity.floorRight - cavity.floorLeft,
    );
    const rimHalf = getInteriorHalfWidthAtY(cavity, cavity.rimY);
    const profile = buildSoftServeProfile(cavity, "sundae_glass");
    const scoop = profile.scoops[0]!;
    // maxRadius must not silently cap below the overhang radius.
    expect(scoop.r).toBeGreaterThanOrEqual(rimHalf * SCOOP_OVERHANG - 0.05);
    expect(scoop.r).toBeLessThanOrEqual(rimHalf * SCOOP_OVERHANG + 0.5);
    const eqY = scoopEquatorY(scoop.seatY, scoop.r);
    expect(Math.abs(eqY - cavity.rimY)).toBeLessThanOrEqual(4);
  });

  it("locks the approved waffle cone geometry", () => {
    const cavity = getCavity("cone");
    expect(cavity).toMatchObject({
      floorY: 168,
      rimY: 112,
      rimLeft: 62,
      rimRight: 138,
      floorLeft: 98,
      floorRight: 102,
      isOpen: true,
    });
    const profile = buildSoftServeProfile(cavity, "cone");
    expect(profile.scoops.length).toBe(2);
    expect(profile.interiorFill).toBe(false);
    const bottom = profile.scoops[0]!;
    const rimHalf = getInteriorHalfWidthAtY(cavity, cavity.rimY);
    expect(bottom.r).toBeCloseTo(Math.min(rimHalf * SCOOP_OVERHANG, 42), 5);
    expect(bottom.seatY).toBe(cavity.rimY + 5);
  });

  it("anchors toppings on the scoop surface, not above the peak", () => {
    for (const containerId of ICE_CREAM_CONTAINER_IDS) {
      const cavity = getCavity(containerId);
      const profile = buildSoftServeProfile(cavity, containerId);
      const scoop = profile.scoops[profile.scoops.length - 1]!;
      const surface = toppingSurfaceFromScoop(scoop, containerId, cavity.rimY);
      for (let i = 0; i < 12; i++) {
        const pt = pointOnScoopCap(surface, `topping-test-${containerId}`, i, {
          maxFrac: 0.7,
          embed: 1,
        });
        expect(pt.y).toBeGreaterThanOrEqual(surface.yMin - 2);
        expect(Math.abs(pt.x - surface.cx)).toBeLessThanOrEqual(surface.r * 0.72 + 1.5);
      }
      // Cherry-style near-peak sample must not float above the dome.
      const cherry = pointOnScoopCap(surface, `cherry-${containerId}`, 3, {
        maxFrac: 0.35,
      });
      expect(cherry.y).toBeGreaterThanOrEqual(surface.yMin - 2);
    }
  });

  it("puts no fill behind an opaque cone", () => {
    const profile = buildSoftServeProfile(getCavity("cone"), "cone");
    expect(profile.interiorFill).toBe(false);
    expect(profile.layerCount).toBe(profile.scoops.length);
  });

  it("gives each flavor a distinct fill and outline", () => {
    const colors = new Set(ICE_CREAM_FLAVORS.map((f) => f.color));
    const outlines = new Set(ICE_CREAM_FLAVORS.map((f) => f.outline));
    expect(colors.size).toBe(ICE_CREAM_FLAVORS.length);
    expect(outlines.size).toBe(ICE_CREAM_FLAVORS.length);
    expect(ICE_CREAM_FLAVORS.find((f) => f.id === "vanilla")!.color).not.toBe("#FCF9F3");
    expect(ICE_CREAM_FLAVORS.find((f) => f.id === "chocolate")!.color).not.toBe("#C4A882");
  });

  it("is deterministic per container", () => {
    const cavity = getCavity("cup");
    const a = buildSoftServeProfile(cavity, "cup");
    const b = buildSoftServeProfile(cavity, "cup");
    expect(a).toEqual(b);
  });

  it("centers the bottom scoop on the mouth ellipse and overhangs the rim", () => {
    for (const containerId of ICE_CREAM_CONTAINER_IDS) {
      const cavity = getCavity(containerId);
      const profile = buildSoftServeProfile(cavity, containerId);
      const bottom = profile.scoops[0]!;
      const mouthCx = mouthOpeningCenterX(cavity);
      const rimHalf = getInteriorHalfWidthAtY(cavity, cavity.rimY);
      expect(bottom.cx).toBeCloseTo(mouthCx, 1);
      expect(bottom.r).toBeGreaterThan(rimHalf);
      expect(bottom.r).toBeLessThanOrEqual(rimHalf * SCOOP_OVERHANG + 0.5);
    }
  });

  it("offsets the upper scoop so the stack is not a centered tower", () => {
    for (const containerId of ["cone", "cup"] as const) {
      const profile = buildSoftServeProfile(getCavity(containerId), containerId);
      expect(profile.scoops.length).toBe(2);
      expect(Math.abs(profile.scoops[1]!.cx - profile.scoops[0]!.cx)).toBeGreaterThan(3);
    }
  });
});

describe("ice art", () => {
  it("builds a rounded cube with a highlight inside it", () => {
    const geo = getCubeGeometry(8, 8);
    expect(geo.rx).toBeCloseTo(5.6, 5);
    expect(geo.highlight.x).toBeGreaterThan(-geo.halfW);
    expect(geo.highlight.x + geo.highlight.w).toBeLessThan(geo.halfW);
  });

  it("has a sphere path and no path for cubes", () => {
    expect(alternateShapePath("sphere", 8)?.length ?? 0).toBeGreaterThan(10);
    expect(alternateShapePath("classic_cube", 8)).toBeNull();
  });
});

describe("ice pile generation", () => {
  const FULL_COUNTS: Record<(typeof ICE_CONTAINERS)[number], number> = {
    glass_cup: 15,
    pitcher: 18,
    ice_bucket: 24,
  };

  for (const containerId of ICE_CONTAINERS) {
    for (const shape of ICE_SHAPES) {
      it(`builds a deterministic static pile for ${containerId} / ${shape}`, () => {
        const cavity = getCavity(containerId);
        const pile = buildIcePile(cavity, shape, containerId, 10);
        expect(pile.length).toBe(Math.min(10, FULL_COUNTS[containerId]));
        expect(buildIcePile(cavity, shape, containerId, 10)).toEqual(pile);
      });
    }
  }

  it("ignores visualSeed for placement but stays deterministic", () => {
    const cavity = getCavity("glass_cup");
    const a = buildIcePile(cavity, "classic_cube", "glass_cup", 10, "seed-alpha");
    const a2 = buildIcePile(cavity, "classic_cube", "glass_cup", 10, "seed-alpha");
    const b = buildIcePile(cavity, "classic_cube", "glass_cup", 10, "seed-beta");
    expect(a).toEqual(a2);
    expect(a).toEqual(b);
    expect(a.length).toBe(10);
  });

  it("keeps rotated cubes inside inset cavity bounds", () => {
    for (const containerId of ICE_CONTAINERS) {
      for (const maxCubes of [5, 8, 10]) {
        const cavity = getInsetCavity(getCavity(containerId));
        const pile = buildIcePile(
          getCavity(containerId),
          "classic_cube",
          containerId,
          maxCubes,
        );
        for (const cube of pile) {
          const halfW = cube.halfW ?? 8;
          const halfH = cube.halfH ?? 8;
          const ext = rotatedExtents(halfW, halfH, cube.rotate ?? 0);
          const topY = cube.y - ext.halfH;
          const bottomY = cube.y + ext.halfH;
          for (const y of [topY, cube.y, bottomY]) {
            const { left, right } = interiorEdgesAt(cavity, y);
            expect(cube.x - ext.halfW).toBeGreaterThanOrEqual(left - 0.05);
            expect(cube.x + ext.halfW).toBeLessThanOrEqual(right + 0.05);
          }
          expect(cube.bottomY).toBeLessThanOrEqual(
            floorSurfaceY(cavity, cube.x) + 0.1,
          );
        }
      }
    }
  });

  it("rests cubes on the floor or neighbours", () => {
    const cavity = getCavity("glass_cup");
    const pile = buildIcePile(cavity, "classic_cube", "glass_cup", 10);
    const inset = getInsetCavity(cavity);
    const floorCubes = pile.filter(
      (c) => c.bottomY >= inset.floorY - (c.halfH ?? 8) * 1.6,
    );
    expect(floorCubes.length).toBeGreaterThan(0);
  });

  it("never leaves a cube unsupported", () => {
    for (const containerId of ICE_CONTAINERS) {
      for (const shape of ICE_SHAPES) {
        const inset = getInsetCavity(getCavity(containerId));
        const pile = buildIcePile(getCavity(containerId), shape, containerId, 10);
        if (pile.length <= 1) continue;
        for (const cube of pile) {
          const neighbours = pile.filter((o) => o.index !== cube.index && cubesTouch(cube, o));
          const onFloor =
            Math.abs(cube.bottomY - floorSurfaceY(inset, cube.x)) < 0.25;
          expect(onFloor || neighbours.length > 0).toBe(true);
        }
      }
    }
  });

  it("builds composed pyramids that share one melt", () => {
    for (const containerId of ICE_CONTAINERS) {
      const cavity = getCavity(containerId);
      const inset = getInsetCavity(cavity);
      const pile = buildIcePile(cavity, "classic_cube", containerId);
      expect(pile.length).toBe(FULL_COUNTS[containerId]);
      expect(pile.every((c) => c.meltStart === 0)).toBe(true);

      for (const c of pile) {
        const hw = c.halfW ?? 8;
        const hh = c.halfH ?? 8;
        expect(Math.abs(hw - hh) / Math.max(hw, hh)).toBeLessThan(0.35);
      }

      const floorCubes = pile.filter(
        (c) => Math.abs(c.bottomY - floorSurfaceY(inset, c.x)) < 0.25,
      );
      expect(floorCubes.length).toBeGreaterThanOrEqual(2);
      const left = Math.min(...floorCubes.map((c) => c.x - (c.halfW ?? 0)));
      const right = Math.max(...floorCubes.map((c) => c.x + (c.halfW ?? 0)));
      const floorWidth = inset.floorRight - inset.floorLeft;
      expect(right - left).toBeGreaterThan(floorWidth * 0.55);

      const top = Math.min(...pile.map((c) => c.y - (c.halfH ?? 8)));
      expect(top).toBeLessThan(cavity.rimY + 24);
    }
  });

  it("builds a wide mound at mid-cavity height", () => {
    for (const containerId of ICE_CONTAINERS) {
      const cavity = getCavity(containerId);
      const inset = getInsetCavity(cavity);
      const pile = buildIcePile(cavity, "classic_cube", containerId, 10);
      const midY = (inset.rimY + inset.floorY) * 0.55;
      const midW = interiorWidthAt(inset, midY);
      const left = Math.min(...pile.map((c) => c.x - (c.halfW ?? 8)));
      const right = Math.max(...pile.map((c) => c.x + (c.halfW ?? 8)));
      expect(right - left).toBeGreaterThan(midW * 0.5);
    }
  });

  it("uses mixed rotation signs", () => {
    const pile = buildIcePile(getCavity("glass_cup"), "classic_cube", "glass_cup", 10);
    const maxAbsRot = Math.max(...pile.map((c) => Math.abs(c.rotate ?? 0)));
    expect(maxAbsRot).toBeGreaterThan(2.5);
    expect(maxAbsRot).toBeLessThanOrEqual(90);
    const signs = new Set(pile.map((c) => Math.sign(c.rotate ?? 0)).filter((s) => s !== 0));
    expect(signs.has(-1)).toBe(true);
    expect(signs.has(1)).toBe(true);
  });

  it("settles every cube onto the floor or another cube", () => {
    for (const containerId of ICE_CONTAINERS) {
      const inset = getInsetCavity(getCavity(containerId));
      const pile = buildIcePile(getCavity(containerId), "classic_cube", containerId, 10);
      for (const cube of pile) {
        const onFloor = Math.abs(cube.bottomY - floorSurfaceY(inset, cube.x)) < 0.25;
        const supported = pile.some(
          (other) =>
            other.index !== cube.index &&
            other.y > cube.y &&
            cubesTouch(cube, other),
        );
        expect(onFloor || supported).toBe(true);
      }
    }
  });

  it("nests upper cubes into supports rather than invisible rows", () => {
    const pile = buildIcePile(getCavity("glass_cup"), "classic_cube", "glass_cup", 10);
    const inset = getInsetCavity(getCavity("glass_cup"));
    for (const cube of pile) {
      const onFloor = Math.abs(cube.bottomY - floorSurfaceY(inset, cube.x)) < 0.25;
      const supports = pile.filter(
        (other) =>
          other.index !== cube.index &&
          other.y > cube.y &&
          cubesTouch(cube, other),
      );
      expect(onFloor || supports.length > 0).toBe(true);
    }
  });

  it("sorts cubes for back-to-front render", () => {
    const pile = buildIcePile(getCavity("glass_cup"), "classic_cube", "glass_cup", 10);
    const sorted = sortCubesForRender(pile);
    expect(sorted.length).toBe(pile.length);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const pd = prev.depth ?? 1;
      const cd = cur.depth ?? 1;
      expect(pd).toBeLessThanOrEqual(cd);
    }
  });

  it("fills the vessel up toward the rim", () => {
    for (const containerId of ICE_CONTAINERS) {
      const cavity = getCavity(containerId);
      const pile = buildIcePile(cavity, "classic_cube", containerId);
      const top = Math.min(...pile.map((c) => c.y - (c.halfH ?? 8)));
      expect(top).toBeLessThan(cavity.rimY + 24);
    }
  });

  it("keeps the ice bucket and glass vessels see-through", () => {
    expect(getCavity("ice_bucket").hasGlass).toBe(true);
    expect(getCavity("glass_cup").hasGlass).toBe(true);
    expect(getCavity("pitcher").hasGlass).toBe(true);
    expect(getCavity("sundae_glass").hasGlass).toBe(true);
  });

  it("assigns depth bands for painter order", () => {
    const pile = buildIcePile(getCavity("glass_cup"), "classic_cube", "glass_cup", 10);
    expect(pile.some((c) => c.depth !== undefined)).toBe(true);
    const depths = new Set(pile.map((c) => c.depth));
    expect(depths.has(0)).toBe(true);
    expect(depths.has(2)).toBe(true);
  });

  it("respects LOD count via prefix slice", () => {
    const sm = buildIcePile(getCavity("ice_bucket"), "classic_cube", "ice_bucket", 5);
    expect(sm.length).toBe(5);

    const md = buildIcePile(getCavity("glass_cup"), "classic_cube", "glass_cup", 8);
    expect(md.length).toBe(8);

    const lg = buildIcePile(getCavity("pitcher"), "classic_cube", "pitcher", 10);
    expect(lg.length).toBe(10);

    const bucketFull = buildIcePile(getCavity("ice_bucket"), "classic_cube", "ice_bucket", 10);
    expect(bucketFull.length).toBe(10);

    expect(buildIcePile(getCavity("glass_cup"), "classic_cube", "glass_cup").length).toBe(
      FULL_COUNTS.glass_cup,
    );
    expect(buildIcePile(getCavity("pitcher"), "classic_cube", "pitcher").length).toBe(
      FULL_COUNTS.pitcher,
    );
    expect(buildIcePile(getCavity("ice_bucket"), "classic_cube", "ice_bucket").length).toBe(
      FULL_COUNTS.ice_bucket,
    );
  });

  it("assigns the same meltStart to every cube", () => {
    const pile = buildIcePile(getCavity("ice_bucket"), "classic_cube", "ice_bucket", 10);
    expect(pile.length).toBeGreaterThan(1);
    const start = pile[0]!.meltStart;
    expect(pile.every((c) => c.meltStart === start)).toBe(true);
    expect(start).toBe(0);
  });

  it("includes settle keyframes for melt animation", () => {
    const pile = buildIcePile(getCavity("glass_cup"), "classic_cube", "glass_cup", 10);
    expect(pile[0]!.settleY?.length).toBe(4);
  });

  it("pileHash is stable", () => {
    expect(pileHash("glass_cup-classic_cube-0", 1)).toBe(
      pileHash("glass_cup-classic_cube-0", 1),
    );
  });

  it("reports tapered interior half-width at a given y", () => {
    const cavity = getCavity("ice_bucket");
    const rimHalf = getInteriorHalfWidthAtY(cavity, cavity.rimY);
    const floorHalf = getInteriorHalfWidthAtY(cavity, cavity.floorY);
    expect(rimHalf).toBeGreaterThan(floorHalf);
    expect(mouthOpeningCenterX(cavity)).toBeCloseTo(100, 0);
  });
});
