/* Dev-only: renders MeltScene variants to PNGs so the art can be eyeballed. */
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { MeltScene } from "../components/session/MeltScene";
import type { MeltConfig, IceCreamToppingId } from "../features/session/melt-catalog";

const OUT = "scripts/.preview";
mkdirSync(OUT, { recursive: true });

const LIGHT_MAT = "#f8fafc";

const ALL_TOPPINGS: IceCreamToppingId[] = [
  "sprinkles",
  "chocolate_sauce",
  "cherry",
  "whipped_cream",
  "cookie_crumb",
];

const iceCream = (
  containerId: string,
  flavorId: string,
  progress = 0,
  toppings: IceCreamToppingId[] = ["sprinkles", "cherry"],
): MeltConfig => ({
  kind: "iceCream",
  containerId,
  flavorId: flavorId as MeltConfig["flavorId"],
  toppings,
  meltDurationMs: 1,
  displayName: containerId,
  artVersion: 2,
  visualSeed: `preview-${containerId}-${flavorId}`,
});

const ice = (
  containerId: string,
  progress = 0,
  iceShapeId: MeltConfig["iceShapeId"] = "classic_cube",
  visualSeed?: string,
): MeltConfig => ({
  kind: "ice",
  containerId,
  iceShapeId,
  meltDurationMs: 1,
  displayName: containerId,
  artVersion: 2,
  visualSeed: visualSeed ?? `preview-ice-${containerId}-${iceShapeId}`,
});

/** V2.3 acceptance sheet — ice / sundae / cup / cone × melt stages + seed variants. */
const cases: { name: string; config: MeltConfig; progress: number; size?: "sm" | "md" | "lg" }[] = [
  // Ice vessels × 0 / 50 / 100
  { name: "ice-cup-0", config: ice("glass_cup", 0), progress: 0 },
  { name: "ice-cup-50", config: ice("glass_cup", 0.5), progress: 0.5 },
  { name: "ice-cup-100", config: ice("glass_cup", 1), progress: 1 },
  { name: "ice-bucket-0", config: ice("ice_bucket", 0), progress: 0 },
  { name: "ice-bucket-50", config: ice("ice_bucket", 0.5), progress: 0.5 },
  { name: "ice-bucket-100", config: ice("ice_bucket", 1), progress: 1 },
  { name: "ice-pitcher-0", config: ice("pitcher", 0), progress: 0 },
  { name: "ice-pitcher-50", config: ice("pitcher", 0.5), progress: 0.5 },
  { name: "ice-pitcher-100", config: ice("pitcher", 1), progress: 1 },
  // Seed variants — glass cup 0%
  { name: "ice-cup-seed-a", config: ice("glass_cup", 0, "classic_cube", "seed-alpha"), progress: 0 },
  { name: "ice-cup-seed-b", config: ice("glass_cup", 0, "classic_cube", "seed-beta"), progress: 0 },
  { name: "ice-cup-seed-c", config: ice("glass_cup", 0, "classic_cube", "seed-gamma"), progress: 0 },
  { name: "ice-cup-seed-d", config: ice("glass_cup", 0, "classic_cube", "seed-delta"), progress: 0 },
  { name: "ice-cup-seed-e", config: ice("glass_cup", 0, "classic_cube", "seed-epsilon"), progress: 0 },
  { name: "ice-bucket-seed-a", config: ice("ice_bucket", 0, "classic_cube", "seed-alpha"), progress: 0 },
  { name: "ice-pitcher-seed-a", config: ice("pitcher", 0, "classic_cube", "seed-alpha"), progress: 0 },
  // LOD spot checks
  { name: "ice-cup-0-sm", config: ice("glass_cup", 0), progress: 0, size: "sm" },
  { name: "ice-cup-0-md", config: ice("glass_cup", 0), progress: 0, size: "md" },
  // Sundae
  { name: "sundae-choco-0", config: iceCream("sundae_glass", "chocolate"), progress: 0 },
  { name: "sundae-choco-50", config: iceCream("sundae_glass", "chocolate"), progress: 0.5 },
  { name: "sundae-choco-100", config: iceCream("sundae_glass", "chocolate"), progress: 1 },
  { name: "sundae-vanilla-0", config: iceCream("sundae_glass", "vanilla"), progress: 0 },
  { name: "sundae-max-top", config: iceCream("sundae_glass", "strawberry", 0, ALL_TOPPINGS), progress: 0 },
  // Paper cup
  { name: "cup-0", config: iceCream("cup", "vanilla"), progress: 0 },
  { name: "cup-50", config: iceCream("cup", "vanilla"), progress: 0.5 },
  { name: "cup-100", config: iceCream("cup", "vanilla"), progress: 1 },
  { name: "cup-toppings", config: iceCream("cup", "matcha", 0, ALL_TOPPINGS), progress: 0 },
  // Cone regression (must stay visually approved)
  { name: "cone-0", config: iceCream("cone", "vanilla"), progress: 0 },
  { name: "cone-50", config: iceCream("cone", "vanilla"), progress: 0.5 },
  { name: "cone-100", config: iceCream("cone", "vanilla"), progress: 1 },
  { name: "cone-max-top", config: iceCream("cone", "vanilla", 0, ALL_TOPPINGS), progress: 0 },
  // Sphere ice
  { name: "ice-sphere", config: ice("glass_cup", 0, "sphere"), progress: 0 },
];

async function main() {
  const tiles: Buffer[] = [];

  for (const { name, config, progress, size = "lg" } of cases) {
    const markup = renderToStaticMarkup(
      <MeltScene config={config} progress={progress} size={size} animated={false} />,
    );
    const svg = markup.slice(markup.indexOf("<svg"), markup.lastIndexOf("</svg>") + 6);
    const sized = svg.replace("<svg", '<svg width="260" height="240"');
    writeFileSync(`${OUT}/${name}.svg`, sized);
    tiles.push(
      await sharp(Buffer.from(sized))
        .flatten({ background: LIGHT_MAT })
        .resize(260, 240)
        .png()
        .toBuffer(),
    );
    console.log("rendered", name);
  }

  const cols = 3;
  const rows = Math.ceil(tiles.length / cols);
  await sharp({
    create: {
      width: cols * 260,
      height: rows * 240,
      channels: 3,
      background: LIGHT_MAT,
    },
  })
    .composite(
      tiles.map((input, i) => ({
        input,
        left: (i % cols) * 260,
        top: Math.floor(i / cols) * 240,
      })),
    )
    .png()
    .toFile(`${OUT}/sheet-v2.png`);

  console.log("wrote", `${OUT}/sheet-v2.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
