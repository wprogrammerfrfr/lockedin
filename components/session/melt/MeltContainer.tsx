"use client";

import { useId } from "react";
import type { ContainerCavity } from "@/features/session/melt-cavity";
import {
  getInsetCavity,
  interiorCenterX,
  mouthOpeningCenterX,
} from "@/features/session/melt-cavity";

const WAFFLE = {
  fill: "#E8B46A",
  fillDark: "#C8893E",
  edge: "#A56B2E",
  line: "#C9954A",
  toast: "#B8793A",
};
const PAPER = {
  fill: "#F6EEE2",
  fillDark: "#E8DCC8",
  stroke: "#D9C9B0",
};
const GLASS = {
  fill: "rgba(198,218,232,0.45)",
  /** Front wall still quieter than the back so ice stays primary. */
  fillFront: "rgba(186,210,228,0.11)",
  stroke: "rgba(120,150,175,0.85)",
  sheen: "rgba(255,255,255,0.72)",
  rim: "rgba(240,246,250,0.72)",
  rimStroke: "rgba(130,160,185,0.88)",
  inner: "rgba(160,185,205,0.18)",
  /** Edge band for stemmed glass — readable on light UI without thick outlines. */
  edge: "rgba(150,180,205,0.55)",
};
const BUCKET = {
  fill: "rgba(200,215,225,0.42)",
  stroke: "rgba(100,130,155,0.85)",
  metal: "#8FA3B3",
};

function GlassSham({ cavity }: { cavity: ContainerCavity }) {
  const cx = interiorCenterX(cavity, cavity.floorY);
  const bottomY = cavity.contactY ?? cavity.floorY + 6;
  const left = cavity.floorLeft - 1;
  const right = cavity.floorRight + 1;
  return (
    <g>
      <path
        d={`M ${left} ${cavity.floorY - 7} Q ${cx} ${cavity.floorY - 3} ${right} ${cavity.floorY - 7} L ${right + 0.5} ${bottomY - 2} Q ${cx} ${bottomY + 2} ${left - 0.5} ${bottomY - 2} Z`}
        fill="rgba(190,216,234,0.5)"
      />
      <path
        d={`M ${left + 3} ${cavity.floorY - 3} Q ${cx} ${cavity.floorY + 2} ${right - 3} ${cavity.floorY - 3}`}
        fill="none"
        stroke="rgba(255,255,255,0.58)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d={`M ${left} ${bottomY - 2} Q ${cx} ${bottomY + 2} ${right} ${bottomY - 2}`}
        fill="none"
        stroke={GLASS.rimStroke}
        strokeWidth={1.35}
        strokeLinecap="round"
        opacity={0.75}
      />
    </g>
  );
}

/** Soft back-rim ellipse (sits behind content). */
function BackRimFill({ cavity }: { cavity: ContainerCavity }) {
  const cx = mouthOpeningCenterX(cavity);
  const rx = (cavity.rimRight - cavity.rimLeft) / 2 + 0.5;
  return (
    <ellipse
      cx={cx}
      cy={cavity.rimY}
      rx={rx}
      ry={4.5}
      fill="rgba(220,232,240,0.55)"
    />
  );
}

/**
 * Opaque waffle front wall — closed path with a curved front lip (no flat
 * chord across the scoop). Patterned after PaperFrontWall.
 */
function ConeFrontWall({ cavity }: { cavity: ContainerCavity }) {
  const uid = useId().replace(/:/g, "");
  const cx = mouthOpeningCenterX(cavity);
  // Match the cone silhouette rim corners (path M 63… / 137…).
  const leftOuter = cavity.rimLeft + 1;
  const rightOuter = cavity.rimRight - 1;
  const rimY = cavity.rimY + 1.5;
  const rx = (rightOuter - leftOuter) / 2;
  const ry = 5.2;
  const frontWall = [
    `M ${leftOuter} ${rimY}`,
    `L 91.5 157.5`,
    `Q 100 171 109.5 157`,
    `L ${rightOuter} ${rimY}`,
    // Curved front lip — top edge of the fill (not a straight diameter).
    `A ${rx} ${ry} 0 0 1 ${leftOuter} ${rimY}`,
    "Z",
  ].join(" ");
  const waffleBody = "M 72 126 L 96 158 Q 100 168 105 158 L 129 126 Z";
  const gradId = `waffle-cone-front-${uid}`;
  const hatchId = `waffle-hatch-front-${uid}`;
  const top = 126;
  const bottom = 168;
  const left = 72;
  const right = 129;
  const height = bottom - top;
  const step = 14;
  const diagA: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const diagB: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let x = left - height + step; x <= right; x += step) {
    diagA.push({ x1: x, y1: top, x2: x + height, y2: bottom });
    diagB.push({ x1: x + height, y1: top, x2: x, y2: bottom });
  }

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="70" y1="112" x2="120" y2="168" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={WAFFLE.fill} />
          <stop offset="55%" stopColor="#DFA05A" />
          <stop offset="100%" stopColor={WAFFLE.fillDark} />
        </linearGradient>
        <clipPath id={hatchId}>
          <path d={waffleBody} />
        </clipPath>
      </defs>
      <path
        d={frontWall}
        fill={`url(#${gradId})`}
        stroke={WAFFLE.edge}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M 92 150 Q 100 166 109 150 L 108 157 Q 100 168 93 157 Z"
        fill={WAFFLE.toast}
        opacity={0.35}
      />
      <g
        clipPath={`url(#${hatchId})`}
        stroke={WAFFLE.line}
        strokeWidth={1}
        opacity={0.35}
        strokeLinecap="round"
      >
        {diagA.map((l, idx) => (
          <line key={`fwa-${idx}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
        {diagB.map((l, idx) => (
          <line key={`fwb-${idx}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      </g>
      {/* Soft inner toast along the curved lip only — no chord stroke */}
      <path
        d={`M ${cx - rx + 3} ${rimY} A ${rx - 3} ${ry - 1.2} 0 0 0 ${cx + rx - 3} ${rimY}`}
        fill="none"
        stroke={WAFFLE.toast}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  );
}

/**
 * Front rim arc only — left/right lips + lower ellipse half.
 * Never draws a full ellipse through the scoop dome.
 */
function SundaeFrontRim({ cavity }: { cavity: ContainerCavity }) {
  const cx = mouthOpeningCenterX(cavity);
  const rx = (cavity.rimRight - cavity.rimLeft) / 2 + 1.2;
  const ry = 4.2;
  const rimY = cavity.rimY;
  return (
    <g>
      {/* Lower (front) half of the rim ellipse */}
      <path
        d={`M ${cx - rx} ${rimY} A ${rx} ${ry} 0 0 0 ${cx + rx} ${rimY}`}
        fill="none"
        stroke={GLASS.rimStroke}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - rx} ${rimY} A ${rx} ${ry} 0 0 0 ${cx + rx} ${rimY}`}
        fill="rgba(240,246,250,0.55)"
      />
      {/* Left / right lip ticks */}
      <path
        d={`M ${cx - rx} ${rimY - 1.2} Q ${cx - rx - 0.5} ${rimY} ${cx - rx + 1} ${rimY + 1.5}`}
        fill="none"
        stroke={GLASS.rimStroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + rx} ${rimY - 1.2} Q ${cx + rx + 0.5} ${rimY} ${cx + rx - 1} ${rimY + 1.5}`}
        fill="none"
        stroke={GLASS.rimStroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* UL rim light catch on the left lip */}
      <path
        d={`M ${cx - rx * 0.72} ${rimY - 0.4} A ${rx * 0.85} ${ry * 0.7} 0 0 1 ${cx - rx * 0.1} ${rimY - ry * 0.55}`}
        fill="none"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.85}
      />
    </g>
  );
}

/** Bowl-shaped front overlay — follows sundae curves, open at the mouth. */
function SundaeFrontWall({ cavity }: { cavity: ContainerCavity }) {
  const cx = mouthOpeningCenterX(cavity);
  const rimY = cavity.rimY;
  const floorY = cavity.floorY;
  const leftOuter = cavity.rimLeft - 1;
  const rightOuter = cavity.rimRight + 1;
  const leftInner = cx - (cavity.rimRight - cavity.rimLeft) * 0.22;
  const rightInner = cx + (cavity.rimRight - cavity.rimLeft) * 0.22;
  const floorL = cavity.floorLeft - 1;
  const floorR = cavity.floorRight + 1;
  const midY = (rimY + floorY) * 0.55;

  const leftWall = [
    `M ${leftOuter} ${rimY}`,
    `C ${leftOuter - 1} ${midY}, ${floorL - 1} ${floorY - 8}, ${floorL} ${floorY}`,
    `L ${floorL + 6} ${floorY}`,
    `C ${leftInner - 2} ${floorY - 6}, ${leftInner} ${midY}, ${leftInner} ${rimY}`,
    "Z",
  ].join(" ");
  const rightWall = [
    `M ${rightOuter} ${rimY}`,
    `C ${rightOuter + 1} ${midY}, ${floorR + 1} ${floorY - 8}, ${floorR} ${floorY}`,
    `L ${floorR - 6} ${floorY}`,
    `C ${rightInner + 2} ${floorY - 6}, ${rightInner} ${midY}, ${rightInner} ${rimY}`,
    "Z",
  ].join(" ");
  const neckBand = [
    `M ${floorL} ${floorY - 2}`,
    `Q ${cx} ${floorY + 3} ${floorR} ${floorY - 2}`,
    `L ${floorR - 3} ${floorY + 1}`,
    `Q ${cx} ${floorY + 5} ${floorL + 3} ${floorY + 1}`,
    "Z",
  ].join(" ");

  return (
    <g>
      <path d={leftWall} fill={GLASS.fillFront} />
      <path d={rightWall} fill={GLASS.fillFront} />
      <path d={neckBand} fill={GLASS.edge} opacity={0.55} />
    </g>
  );
}

/**
 * Side-band front wall — occludes edge ice while leaving the center open
 * so the pile still reads clearly inside the glass (matches SundaeFrontWall).
 */
function GlassFrontWall({
  cavity,
  sheenX = 82,
}: {
  cavity: ContainerCavity;
  containerId: string;
  sheenX?: number;
}) {
  const rimY = cavity.rimY;
  const floorY = cavity.floorY;
  const cx = mouthOpeningCenterX(cavity);
  const leftOuter = cavity.rimLeft - 0.5;
  const rightOuter = cavity.rimRight + 0.5;
  const floorL = cavity.floorLeft - 0.5;
  const floorR = cavity.floorRight + 0.5;
  // Keep ~55% of the mouth clear so cubes stay the primary read.
  const band = (cavity.rimRight - cavity.rimLeft) * 0.22;
  const leftInner = leftOuter + band;
  const rightInner = rightOuter - band;
  const midY = (rimY + floorY) * 0.55;

  const leftWall = [
    `M ${leftOuter} ${rimY}`,
    `C ${leftOuter - 1} ${midY}, ${floorL - 1} ${floorY - 6}, ${floorL} ${floorY}`,
    `L ${floorL + 5} ${floorY}`,
    `C ${leftInner - 1} ${floorY - 5}, ${leftInner} ${midY}, ${leftInner} ${rimY}`,
    "Z",
  ].join(" ");
  const rightWall = [
    `M ${rightOuter} ${rimY}`,
    `C ${rightOuter + 1} ${midY}, ${floorR + 1} ${floorY - 6}, ${floorR} ${floorY}`,
    `L ${floorR - 5} ${floorY}`,
    `C ${rightInner + 1} ${floorY - 5}, ${rightInner} ${midY}, ${rightInner} ${rimY}`,
    "Z",
  ].join(" ");

  return (
    <g>
      <path d={leftWall} fill={GLASS.fillFront} />
      <path d={rightWall} fill={GLASS.fillFront} />
      {/* Soft UL sheen blob — not a vertical construction stroke */}
      <ellipse
        cx={sheenX}
        cy={rimY + 22}
        rx={4.5}
        ry={14}
        fill={GLASS.sheen}
        opacity={0.5}
        transform={`rotate(-12 ${sheenX} ${rimY + 22})`}
      />
      {/* Quiet floor contact shade — keeps the tumbler grounded without a window */}
      <path
        d={`M ${floorL + 2} ${floorY - 1} Q ${cx} ${floorY + 3} ${floorR - 2} ${floorY - 1}`}
        fill="none"
        stroke={GLASS.edge}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.35}
      />
    </g>
  );
}

/** Lower/front rim arc only; never stamps a filled ellipse over the ice. */
function GlassFrontRim({
  cavity,
  containerId,
  stroke = GLASS.rimStroke,
}: {
  cavity: ContainerCavity;
  containerId: string;
  stroke?: string;
}) {
  const inset = getInsetCavity(cavity);
  const spoutInset = containerId === "pitcher" ? 4 : 0;
  const left = inset.rimLeft - spoutInset;
  const right = inset.rimRight;
  const cx = (left + right) / 2;
  const rx = (right - left) / 2;
  const ry = 4.2;
  return (
    <g fill="none" stroke={stroke} strokeLinecap="round">
      <path
        d={`M ${left} ${cavity.rimY} A ${rx} ${ry} 0 0 0 ${right} ${cavity.rimY}`}
        strokeWidth={1.9}
      />
      <path
        d={`M ${left} ${cavity.rimY - 1.2} Q ${left - 0.5} ${cavity.rimY} ${left + 1} ${cavity.rimY + 1.5}`}
        strokeWidth={1.5}
      />
      <path
        d={`M ${right} ${cavity.rimY - 1.2} Q ${right + 0.5} ${cavity.rimY} ${right - 1} ${cavity.rimY + 1.5}`}
        strokeWidth={1.5}
      />
      <path
        d={`M ${cx - rx * 0.72} ${cavity.rimY - 0.4} A ${rx * 0.85} ${ry * 0.7} 0 0 1 ${cx - rx * 0.1} ${cavity.rimY - ry * 0.55}`}
        stroke="rgba(255,255,255,0.8)"
        strokeWidth={1.5}
        opacity={0.85}
      />
    </g>
  );
}

/** Rolled paper rim — short torus (outer darker band + cream inner lip). */
function PaperRim({ cavity }: { cavity: ContainerCavity }) {
  const cx = mouthOpeningCenterX(cavity);
  const rx = (cavity.rimRight - cavity.rimLeft) / 2 + 1.5;
  const ry = 4.2;
  return (
    <g>
      <ellipse
        cx={cx}
        cy={cavity.rimY}
        rx={rx}
        ry={ry}
        fill={PAPER.fillDark}
        stroke={PAPER.stroke}
        strokeWidth={1.1}
      />
      <ellipse
        cx={cx}
        cy={cavity.rimY}
        rx={rx - 2.2}
        ry={ry - 1.5}
        fill="#FFFCF0"
        stroke={PAPER.stroke}
        strokeWidth={0.9}
      />
    </g>
  );
}

/** Opaque front wall — hides scoop belly so the cup reads as paper, not glass. */
function PaperFrontWall({ cavity }: { cavity: ContainerCavity }) {
  const cx = mouthOpeningCenterX(cavity);
  const rimY = cavity.rimY;
  const floorY = cavity.floorY + 2;
  const leftOuter = cavity.rimLeft - 1;
  const rightOuter = cavity.rimRight + 1;
  const floorL = cavity.floorLeft - 1;
  const floorR = cavity.floorRight + 1;
  const rx = (cavity.rimRight - cavity.rimLeft) / 2 + 1.5;
  const floorRx = (floorR - floorL) / 2;
  // Soft curved floor — left wall → shallow base arc → right wall → front rim arc.
  const frontWall = [
    `M ${leftOuter} ${rimY}`,
    `L ${floorL} ${floorY - 1}`,
    `Q ${cx} ${floorY + 3.5} ${floorR} ${floorY - 1}`,
    `L ${rightOuter} ${rimY}`,
    `A ${rx} 4.2 0 0 1 ${leftOuter} ${rimY}`,
    "Z",
  ].join(" ");

  // Vertical flutes that taper with the cup silhouette.
  const fluteCount = 7;
  const flutes = Array.from({ length: fluteCount }, (_, i) => {
    const t = (i + 1) / (fluteCount + 1);
    const topX = leftOuter + (rightOuter - leftOuter) * t;
    const botX = floorL + (floorR - floorL) * t;
    return `M ${topX} ${rimY + 6} L ${botX} ${floorY - 6}`;
  });

  return (
    <g>
      <path
        d={frontWall}
        fill={PAPER.fill}
        stroke={PAPER.stroke}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {/* Dixie-style flutes + mid seam */}
      <g
        stroke={PAPER.stroke}
        strokeWidth={0.85}
        opacity={0.16}
        strokeLinecap="round"
        fill="none"
      >
        {flutes.map((d) => (
          <path key={d} d={d} />
        ))}
        <path
          d={`M ${leftOuter + 4} ${rimY + (floorY - rimY) * 0.42} Q ${cx} ${rimY + (floorY - rimY) * 0.48} ${rightOuter - 4} ${rimY + (floorY - rimY) * 0.42}`}
        />
      </g>
      {/* Bottom rim ring */}
      <ellipse
        cx={cx}
        cy={floorY + 0.5}
        rx={floorRx + 0.5}
        ry={2.2}
        fill="none"
        stroke={PAPER.stroke}
        strokeWidth={1.1}
        opacity={0.55}
      />
      {/* Thickened front rolled lip — lower arc only */}
      <path
        d={`M ${leftOuter} ${rimY} A ${rx} 4.2 0 0 0 ${rightOuter} ${rimY}`}
        fill="none"
        stroke={PAPER.fillDark}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <path
        d={`M ${leftOuter} ${rimY} A ${rx} 4.2 0 0 0 ${rightOuter} ${rimY}`}
        fill="none"
        stroke={PAPER.stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - rx * 0.7} ${rimY - 0.5} A ${rx * 0.8} 2.6 0 0 1 ${cx - rx * 0.1} ${rimY - 2.4}`}
        fill="none"
        stroke="rgba(255,252,246,0.75)"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </g>
  );
}

export function MeltContainerLayers({
  containerId,
  cavity,
  role,
  showSheen,
}: {
  containerId: string;
  cavity: ContainerCavity;
  role: "back" | "front";
  showSheen?: boolean;
}) {
  const uid = useId().replace(/:/g, "");

  if (containerId === "cone") {
    // Slightly irregular waffle silhouette — not a perfect triangle.
    const cone =
      "M 63 113 C 72 110.5, 128 110.5, 137 113.5 L 109.5 157 Q 100 171 91.5 157.5 Z";
    // Hatch the lower body only — leave rim clear for the scoop tuck.
    const waffleBody = "M 72 126 L 96 158 Q 100 168 105 158 L 129 126 Z";
    if (role === "back") {
      const gradId = `waffle-cone-${uid}`;
      const hatchId = `waffle-hatch-${uid}`;
      const top = 126;
      const bottom = 168;
      const left = 72;
      const right = 129;
      const height = bottom - top;
      const step = 14;
      const diagA: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const diagB: { x1: number; y1: number; x2: number; y2: number }[] = [];
      for (let x = left - height + step; x <= right; x += step) {
        diagA.push({ x1: x, y1: top, x2: x + height, y2: bottom });
        diagB.push({ x1: x + height, y1: top, x2: x, y2: bottom });
      }
      return (
        <g>
          <defs>
            <linearGradient id={gradId} x1="70" y1="112" x2="120" y2="168" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={WAFFLE.fill} />
              <stop offset="55%" stopColor="#DFA05A" />
              <stop offset="100%" stopColor={WAFFLE.fillDark} />
            </linearGradient>
            <clipPath id={hatchId}>
              <path d={waffleBody} />
            </clipPath>
          </defs>
          <path
            d={cone}
            fill={`url(#${gradId})`}
            stroke={WAFFLE.edge}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          {/* Soft toasted lower edge */}
          <path
            d="M 92 150 Q 100 166 109 150 L 108 157 Q 100 168 93 157 Z"
            fill={WAFFLE.toast}
            opacity={0.35}
          />
          {/* Sparse diamond waffle hatch */}
          <g
            clipPath={`url(#${hatchId})`}
            stroke={WAFFLE.line}
            strokeWidth={1}
            opacity={0.35}
            strokeLinecap="round"
          >
            {diagA.map((l, idx) => (
              <line key={`wa-${idx}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            ))}
            {diagB.map((l, idx) => (
              <line key={`wb-${idx}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            ))}
          </g>
          {/* UL highlight */}
          <path
            d="M 76 118 Q 88 122 92 138"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.5}
          />
        </g>
      );
    }
    return <ConeFrontWall cavity={cavity} />;
  }

  if (containerId === "cup") {
    // Soft curved floor so the silhouette matches a paper-cup base ring.
    const cup =
      "M 67 110 C 72 107.5, 128 107.5, 133 110 L 124.5 160 Q 100 166 76.5 160 Z";
    if (role === "back") {
      const gradId = `paper-cup-${uid}`;
      return (
        <g>
          <defs>
            <linearGradient id={gradId} x1="70" y1="108" x2="120" y2="170" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FBF6EE" />
              <stop offset="55%" stopColor={PAPER.fill} />
              <stop offset="100%" stopColor={PAPER.fillDark} />
            </linearGradient>
          </defs>
          <path
            d={cup}
            fill={`url(#${gradId})`}
            stroke={PAPER.stroke}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          {/* Back rim sits behind the scoop */}
          <PaperRim cavity={cavity} />
        </g>
      );
    }
    return <PaperFrontWall cavity={cavity} />;
  }

  if (containerId === "sundae_glass") {
    // One connected silhouette: elliptical rim → curved bowl → neck → stem → foot.
    // Coordinates match CONTAINER_CAVITY.sundae_glass (rim 68–132 @ 100, floor 90–110 @ 140).
    const glass =
      [
        "M 68 100",
        "C 72 96, 128 96, 132 100",
        "C 136 118, 128 132, 118 140",
        "Q 100 148 82 140",
        "C 72 132, 64 118, 68 100",
        "Z",
      ].join(" ");
    const stem =
      [
        "M 95 140",
        "C 96 148, 96.5 156, 97.5 164",
        "Q 100 170 102.5 164",
        "C 103.5 156, 104 148, 105 140",
        "Q 100 144 95 140",
        "Z",
      ].join(" ");
    // Flat footplate — stable stand, no smiling crescent.
    const foot =
      "M 84 166 L 116 166 Q 118 166 118 168 L 118 170 Q 118 171 116 171 L 84 171 Q 82 171 82 170 L 82 168 Q 82 166 84 166 Z";
    const innerBowl =
      [
        "M 76 104",
        "C 80 101, 120 101, 124 104",
        "C 126 118, 120 130, 112 137",
        "Q 100 142 88 137",
        "C 80 130, 74 118, 76 104",
        "Z",
      ].join(" ");
    // Edge band via outer stroke + slightly stronger stem/foot fill.
    if (role === "back") {
      return (
        <g>
          <path d={stem} fill={GLASS.edge} stroke={GLASS.rimStroke} strokeWidth={1} opacity={0.9} />
          <path d={foot} fill={GLASS.edge} />
          <path d={foot} fill="none" stroke={GLASS.rimStroke} strokeWidth={1.2} opacity={0.7} />
          <path d={glass} fill={GLASS.fill} stroke={GLASS.rimStroke} strokeWidth={1.6} strokeLinejoin="round" opacity={0.95} />
          <path d={innerBowl} fill="rgba(230,242,250,0.35)" />
          <BackRimFill cavity={cavity} />
        </g>
      );
    }
    return (
      <g>
        <SundaeFrontWall cavity={cavity} />
        {showSheen ? (
          <ellipse
            cx={80}
            cy={118}
            rx={3.5}
            ry={14}
            fill={GLASS.sheen}
            opacity={0.55}
            transform="rotate(-14 80 118)"
          />
        ) : null}
        <SundaeFrontRim cavity={cavity} />
      </g>
    );
  }

  if (containerId === "ice_bucket") {
    const bucket =
      "M 58 98 C 62 93, 138 93, 142 98 L 134 163 Q 100 175 66 163 Z";
    if (role === "back") {
      return (
        <g>
          <path
            d={bucket}
            fill={BUCKET.fill}
            stroke={BUCKET.stroke}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <path
            d="M 64 114 Q 100 119 136 114"
            fill="none"
            stroke={BUCKET.metal}
            strokeWidth={2.8}
            opacity={0.65}
          />
          <BackRimFill cavity={cavity} />
        </g>
      );
    }
    return (
      <g>
        <GlassFrontWall cavity={cavity} containerId={containerId} sheenX={74} />
        {showSheen ? (
          <ellipse
            cx={74}
            cy={126}
            rx={4}
            ry={16}
            fill={GLASS.sheen}
            opacity={0.45}
            transform="rotate(-10 74 126)"
          />
        ) : null}
        <GlassFrontRim
          cavity={cavity}
          containerId={containerId}
          stroke={BUCKET.stroke}
        />
      </g>
    );
  }

  if (containerId === "pitcher") {
    const body =
      "M 66 96 Q 70 96 72 100 C 75 95, 125 95, 128 100 C 132 118, 129 143, 122 164 Q 100 173 78 164 C 71 143, 68 118, 72 100 Q 69 99 66 96 Z";
    const handle = "M 127 115 C 145 115, 149 126, 147 137 C 145 148, 137 153, 124 151";
    if (role === "back") {
      return (
        <g>
          <path
            d={handle}
            fill="none"
            stroke="rgba(169,199,219,0.6)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
          <path
            d={handle}
            fill="none"
            stroke="rgba(245,251,255,0.72)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.75}
          />
          <path
            d={body}
            fill={GLASS.fill}
            stroke={GLASS.stroke}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <BackRimFill cavity={cavity} />
        </g>
      );
    }
    return (
      <g>
        <GlassFrontWall cavity={cavity} containerId={containerId} sheenX={82} />
        <GlassSham cavity={cavity} />
        {showSheen ? (
          <ellipse
            cx={82}
            cy={124}
            rx={3.5}
            ry={14}
            fill={GLASS.sheen}
            opacity={0.5}
            transform="rotate(-12 82 124)"
          />
        ) : null}
        <GlassFrontRim cavity={cavity} containerId={containerId} />
      </g>
    );
  }

  // glass_cup default
  const tumbler =
    "M 74 102 C 77 97, 123 97, 126 102 C 130 120, 128 146, 122 164 Q 100 173 78 164 C 72 146, 70 120, 74 102 Z";
  if (role === "back") {
    return (
      <g>
        <path
          d={tumbler}
          fill={GLASS.fill}
          stroke={GLASS.stroke}
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
        <BackRimFill cavity={cavity} />
        {/* Soft inner tint only — avoid a hard empty-window rectangle */}
        <path
          d="M 84 112 Q 100 110 116 112 L 114 148 Q 100 152 86 148 Z"
          fill={GLASS.inner}
          opacity={0.55}
        />
      </g>
    );
  }
  return (
    <g>
      <GlassFrontWall cavity={cavity} containerId={containerId} sheenX={82} />
      <GlassSham cavity={cavity} />
      {showSheen ? (
        <ellipse
          cx={82}
          cy={124}
          rx={3.8}
          ry={14}
          fill={GLASS.sheen}
          opacity={0.55}
          transform="rotate(-12 82 124)"
        />
      ) : null}
      <GlassFrontRim cavity={cavity} containerId={containerId} />
    </g>
  );
}
