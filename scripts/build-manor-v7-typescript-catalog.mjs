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
const signInRewardAnimalIds = new Set([1055, 1056]);
const timings = new Map(
  parseCsv("catalog-timings.csv")
    .filter((row) => row.domain === "farm")
    .map((row) => [number(row.source_id), row.values.split(";").map(number).slice(0, 5)])
);
const crops = parseCsv("catalog-crops.csv")
  .filter((row) =>
    row.integration_policy === "core-candidate" ||
    (
      number(row.land_requirement) === 2 &&
      row.integration_policy === "blocked-assets" &&
      number(row.asset_files) >= 4 &&
      !bool(row.hidden) &&
      !bool(row.vip_only)
    )
  )
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
    stageSeconds: timings.get(number(row.source_id)) ?? []
  }));

const animals = parseCsv("catalog-animals.csv")
  .filter((row) => (
    row.integration_policy === "core-candidate" || signInRewardAnimalIds.has(number(row.source_id))
  ))
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
    available: bool(row.available)
  }));

const decorations = parseCsv("catalog-decorations.csv")
  .filter((row) => row.integration_policy === "deferred-cosmetic")
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
    validSeconds: number(row.valid_seconds)
  }));

const landUpgrades = parseCsv("catalog-land-upgrades.csv").map((row) => ({
  landType: row.land_type,
  sourceId: number(row.source_id),
  level: number(row.level),
  coins: number(row.coins),
  premium: number(row.premium)
}));

const fish = parseCsv("catalog-fish.csv")
  .filter((row) => row.integration_policy === "core-candidate")
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
    seedPrice: number(row.seed_price),
    salePrice: number(row.sale_price)
  }));

const output = `// Generated from docs/manor-v7-source. Do not edit by hand.\n` +
  `import type { ManorV7AnimalDefinition, ManorV7CropDefinition, ManorV7DecorationDefinition, ManorV7FishDefinition, ManorV7LandUpgradeDefinition, ManorV7ToolDefinition } from "./types.js";\n\n` +
  `export const MANOR_V7_CROPS = ${JSON.stringify(crops, null, 2)} as const satisfies readonly ManorV7CropDefinition[];\n\n` +
  `export const MANOR_V7_ANIMALS = ${JSON.stringify(animals, null, 2)} as const satisfies readonly ManorV7AnimalDefinition[];\n\n` +
  `export const MANOR_V7_TOOLS = ${JSON.stringify(tools, null, 2)} as const satisfies readonly ManorV7ToolDefinition[];\n\n` +
  `export const MANOR_V7_DECORATIONS = ${JSON.stringify(decorations, null, 2)} as const satisfies readonly ManorV7DecorationDefinition[];\n\n` +
  `export const MANOR_V7_FISH = ${JSON.stringify(fish, null, 2)} as const satisfies readonly ManorV7FishDefinition[];\n\n` +
  `export const MANOR_V7_LAND_UPGRADES = ${JSON.stringify(landUpgrades, null, 2)} as const satisfies readonly ManorV7LandUpgradeDefinition[];\n`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output, "utf8");
console.log(`Generated ${crops.length} crops, ${animals.length} animals, ${fish.length} fish, ${tools.length} tools, ${decorations.length} decorations and ${landUpgrades.length} land upgrades`);
