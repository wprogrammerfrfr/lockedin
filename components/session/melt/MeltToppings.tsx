"use client";

import type { IceCreamToppingId } from "@/features/session/melt-catalog";
import type { Scoop } from "@/features/session/melt-soft-serve";
import {
  pointOnScoopCap,
  scoopDomeArc,
  toppingSurfaceFromScoop,
} from "@/features/session/melt-soft-serve";
import { seededRange, seededInt } from "@/features/session/melt-seed";

const SPRINKLE_COLORS = ["#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#FB7185", "#A78BFA"];

function lightenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function MeltToppings({
  toppings,
  scoop,
  seed,
  localMelt,
  maxSprinkles,
  showTiny,
  containerId,
  rimY,
}: {
  toppings: IceCreamToppingId[];
  scoop: Scoop;
  seed: string;
  /** Top scoop melt local 0–1 — toppings sink / fade with it */
  localMelt: number;
  maxSprinkles: number;
  showTiny: boolean;
  containerId: string;
  rimY: number;
}) {
  if (toppings.length === 0 || localMelt >= 1) return null;

  const surface = toppingSurfaceFromScoop(scoop, containerId, rimY);
  const { cx, r } = surface;
  const halfW = Math.max(10, r);
  const opacity = 1 - localMelt * 0.85;
  const embed = localMelt * 2;

  const sprinkleW = Math.max(9, r * 0.26);
  const sprinkleH = Math.max(3.6, r * 0.1);

  return (
    <g opacity={opacity}>
      {/* Sauce under cream so whipped peaks stay readable */}
      {toppings.includes("chocolate_sauce") ? (() => {
        const arc = scoopDomeArc(cx, surface.seatY - r * 0.08 + embed, r * 0.92);
        const drip = seededRange(seed, 2, 4, 9);
        return (
          <path
            d={`${arc}
                C ${cx + halfW * 0.55} ${surface.seatY - r * 0.05 + drip + embed},
                  ${cx + halfW * 0.1} ${surface.seatY + drip * 0.6 + embed},
                  ${cx - halfW * 0.15} ${surface.seatY - r * 0.15 + embed}
                C ${cx - halfW * 0.45} ${surface.seatY - r * 0.2 + drip * 0.4 + embed},
                  ${cx - halfW * 0.75} ${surface.seatY - r * 0.1 + embed},
                  ${cx - halfW * 0.9} ${surface.seatY - r * 0.2 + embed} Z`}
            fill="#4A2C1A"
            opacity={0.9}
          />
        );
      })() : null}

      {toppings.includes("whipped_cream") ? (
        <path
          d={`M ${cx - halfW * 0.55} ${surface.yMin + r * 0.28 + embed}
              Q ${cx - halfW * 0.32} ${surface.yMin - 2 + embed} ${cx - halfW * 0.06} ${surface.yMin + 2 + embed}
              Q ${cx + halfW * 0.1} ${surface.yMin - 6 + embed} ${cx + halfW * 0.3} ${surface.yMin + 3 + embed}
              Q ${cx + halfW * 0.52} ${surface.yMin + 6 + embed} ${cx + halfW * 0.5} ${surface.yMin + r * 0.32 + embed}
              Q ${cx + halfW * 0.22} ${surface.yMin + r * 0.4 + embed} ${cx} ${surface.yMin + r * 0.38 + embed}
              Q ${cx - halfW * 0.24} ${surface.yMin + r * 0.4 + embed} ${cx - halfW * 0.55} ${surface.yMin + r * 0.28 + embed} Z`}
          fill="#FAFAFA"
          stroke="#E2E8F0"
          strokeWidth={1.4}
        />
      ) : null}

      {toppings.includes("sprinkles") && showTiny
        ? Array.from({ length: maxSprinkles }).map((_, i) => {
            const pt = pointOnScoopCap(surface, seed, 10 + i, {
              maxFrac: 0.68,
              embed: 1.2 + embed,
            });
            const rot = seededRange(seed, 30 + i, -40, 40);
            const c = SPRINKLE_COLORS[seededInt(seed, 40 + i, 0, SPRINKLE_COLORS.length - 1)]!;
            const hi = lightenHex(c, 48);
            return (
              <g key={i} transform={`rotate(${rot} ${pt.x} ${pt.y})`}>
                <rect
                  x={pt.x - sprinkleW / 2}
                  y={pt.y - sprinkleH / 2}
                  width={sprinkleW}
                  height={sprinkleH}
                  rx={sprinkleH / 2}
                  fill={c}
                />
                <rect
                  x={pt.x - sprinkleW / 2 + sprinkleH * 0.35}
                  y={pt.y - sprinkleH / 2 + sprinkleH * 0.15}
                  width={sprinkleW * 0.45}
                  height={sprinkleH * 0.35}
                  rx={sprinkleH * 0.2}
                  fill={hi}
                  opacity={0.85}
                />
              </g>
            );
          })
        : null}

      {toppings.includes("cherry") ? (() => {
        const pt = pointOnScoopCap(surface, seed, 3, {
          maxFrac: 0.35,
          embed,
        });
        const x = pt.x + seededRange(seed, 5, -r * 0.12, r * 0.12);
        const y = surface.yMin + r * 0.35 + embed;
        return (
          <g>
            <circle cx={x} cy={y} r={7.5} fill="#DC2626" />
            <circle cx={x - 2.5} cy={y - 2.5} r={2.4} fill="#FCA5A5" opacity={0.75} />
            <path
              d={`M ${x} ${y - 7.5} Q ${x + 6} ${y - 16} ${x + 11} ${y - 12}`}
              stroke="#166534"
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
            />
          </g>
        );
      })() : null}
    </g>
  );
}
