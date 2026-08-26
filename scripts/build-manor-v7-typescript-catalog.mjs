import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventoryRoot = join(repositoryRoot, "docs", "manor-v7-source");
const outputPath = join(repositoryRoot, "packages", "manor-v7", "src", "catalog.generated.ts");

function parseCsv(name) {
  const source = readFileSync(join(inventoryRoot, name), "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const [header, ...data] = rows.filter((entry) => entry.some(Boolean));
  if (!header) throw new Error(`CSV is empty: ${name}`);
  return data.map((entry) => Object.fromEntries(header.map((column, index) => [column, entry[index] ?? ""])));
}

const number = (value) => Number(value || 0);
const bool = (value) => value === "true";
const timings = new Map(
  parseCsv("catalog-timings.csv")
    .filter((row) => row.domain === "farm")
    .map((row) => [number(row.source_id), row.values.split(";").map(number).slice(0, 5)])
);
const crops = parseCsv("catalog-crops.csv")
  // The original SWF runtime supports crops without optional sprout or withered assets.
  .filter((row) => number(row.crop_type) === 1 && number(row.asset_files) >= 4)
  .map((row) => ({
    id: number(row.source_id),
    name: row.name,
    originalLevel: number(row.original_level),
    cropType: number(row.crop_type),
    seedPrice: number(row.seed_price),
    salePrice: number(row.sale_price),
    baseYield: number(row.base_yield),
    experience: number(row.experience),
    growthSeconds: number(row.growth_seconds),
    harvestCycles: Math.max(1, number(row.harvest_cycles)),
    landRequirement: number(row.land_requirement),
    isFlower: bool(row.is_flower),
    isHidden: bool(row.hidden),
    isVip: bool(row.vip_only),
    stageSeconds: timings.get(number(row.source_id)) ?? []
  }));

const animals = parseCsv("catalog-animals.csv")
  // The original pasture runtime needs both animation bundles for all six lifecycle states.
  .filter((row) => row.asset_status === "complete-two-parts")
  .map((row) => {
    const maturitySeconds = number(row.maturity_seconds);
    const productionSeconds = number(row.production_seconds);
    const productionCycleSeconds = number(row.production_cycle_seconds);
    const productionActionSeconds = number(row.production_action_seconds);
    return {
      id: number(row.source_id),
      name: row.name,
      byproductName: row.byproduct_name,
      house: row.house,
      originalLevel: number(row.original_level),
      isHidden: bool(row.hidden),
      isVip: bool(row.vip_only),
      purchasePrice: number(row.purchase_price),
      productPrice: number(row.product_price),
      byproductPrice: number(row.byproduct_price),
      animalHarvestExperience: number(row.animal_harvest_experience),
      byproductHarvestExperience: number(row.byproduct_harvest_experience),
      baseYield: number(row.base_yield),
      consume: number(row.consume),
      cubSeconds: number(row.cub_seconds),
      maturitySeconds,
      productionSeconds,
      productionCycleSeconds,
      productionActionSeconds,
      productionCooldownSeconds: Math.max(0, productionCycleSeconds - productionActionSeconds),
      lifecycleSeconds: maturitySeconds + productionSeconds
    };
  });

const tools = parseCsv("catalog-tools.csv")
  .filter((row) => row.integration_policy === "core-candidate")
  .map((row) => ({
    area: row.area,
    id: number(row.source_id),
    name: row.name,
    itemType: number(row.item_type),
    coinPrice: number(row.coin_price),
    premiumPrice: number(row.premium_price),
    effectSeconds: number(row.effect_seconds),
    isVip: bool(row.vip_only),
    available: bool(row.available)
  }));

const avatars = parseCsv("catalog-avatars.csv")
  .filter((row) => row.asset_status === "complete" && number(row.source_status) === 1)
  .map((row) => ({
    id: number(row.source_id),
    sex: row.sex,
    displayOrder: number(row.display_order),
    assetPath: row.asset_path,
    width: number(row.width),
    height: number(row.height)
  }));

const decorations = parseCsv("catalog-decorations.csv")
  .map((row) => ({
    area: row.area,
    id: number(row.source_id),
    name: row.name,
    setName: row.set_name,
    itemType: number(row.item_type),
    originalLevel: number(row.original_level),
    coinPrice: number(row.coin_price),
    premiumPrice: number(row.premium_price),
    experience: number(row.experience),
    validSeconds: number(row.valid_seconds),
    isHidden: bool(row.hidden),
    isRenderable: row.asset_status === "complete"
  }));

const landUpgrades = parseCsv("catalog-land-upgrades.csv").map((row) => ({
  landType: row.land_type,
  sourceId: number(row.source_id),
  level: number(row.level),
  coins: number(row.coins),
  premium: number(row.premium)
}));

const fish = parseCsv("catalog-fish.csv")
  .filter((row) => (
    number(row.source_id) !== 1 && bool(row.has_fish_asset) && bool(row.has_seed_asset)
  ))
  .map((row) => ({
    id: number(row.source_id),
    name: row.name,
    cycleSeconds: row.cycle_seconds.split(";").filter(Boolean).map(number),
    experience: number(row.experience),
    unlockCrystalType: number(row.unlock_crystal_type),
    unlockCrystalAmount: number(row.unlock_crystal_amount),
    unlockCoins: number(row.unlock_coins),
    matureHours: number(row.mature_hours),
    baseYield: number(row.base_yield),
    poolSize: Math.max(1, number(row.pool_size)),
    isHidden: bool(row.hidden),
    seedPrice: number(row.seed_price),
    salePrice: number(row.sale_price)
  }));

const output = `// Generated from docs/manor-v7-source. Do not edit by hand.\n` +
  `import type { ManorV7AnimalDefinition, ManorV7AvatarDefinition, ManorV7CropDefinition, ManorV7DecorationDefinition, ManorV7FishDefinition, ManorV7LandUpgradeDefinition, ManorV7ToolDefinition } from "./types.js";\n\n` +
  `export const MANOR_V7_CROPS = ${JSON.stringify(crops, null, 2)} as const satisfies readonly ManorV7CropDefinition[];\n\n` +
  `export const MANOR_V7_ANIMALS = ${JSON.stringify(animals, null, 2)} as const satisfies readonly ManorV7AnimalDefinition[];\n\n` +
  `export const MANOR_V7_TOOLS = ${JSON.stringify(tools, null, 2)} as const satisfies readonly ManorV7ToolDefinition[];\n\n` +
  `export const MANOR_V7_AVATARS = ${JSON.stringify(avatars, null, 2)} as const satisfies readonly ManorV7AvatarDefinition[];\n\n` +
  `export const MANOR_V7_DECORATIONS = ${JSON.stringify(decorations, null, 2)} as const satisfies readonly ManorV7DecorationDefinition[];\n\n` +
  `export const MANOR_V7_FISH = ${JSON.stringify(fish, null, 2)} as const satisfies readonly ManorV7FishDefinition[];\n\n` +
  `export const MANOR_V7_LAND_UPGRADES = ${JSON.stringify(landUpgrades, null, 2)} as const satisfies readonly ManorV7LandUpgradeDefinition[];\n`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output, "utf8");
console.log(`Generated ${crops.length} crops, ${animals.length} animals, ${fish.length} fish, ${tools.length} tools, ${avatars.length} avatars, ${decorations.length} decorations and ${landUpgrades.length} land upgrades`);
