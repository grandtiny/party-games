import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(process.argv[2] || process.env.MANOR_V7_SOURCE_PATH || "");
if (!process.argv[2] && !process.env.MANOR_V7_SOURCE_PATH) {
  throw new Error("Pass the QQnc root as the first argument or set MANOR_V7_SOURCE_PATH");
}
const outputDirectory = resolve(process.argv[3] || join(repositoryRoot, "docs", "manor-v7-source"));

const pluginCandidates = [
  sourceRoot,
  join(sourceRoot, "wwwroot", "source", "plugin", "qqfarm"),
  join(sourceRoot, "source", "plugin", "qqfarm"),
];
const pluginRoot = pluginCandidates.find((candidate) => existsSync(join(candidate, "core", "common.php")));
if (!pluginRoot) throw new Error(`QQ Farm V7 plugin root was not found below ${sourceRoot}`);

const coreRoot = join(pluginRoot, "core");
const configRoot = join(coreRoot, "config");
const moduleRoot = join(coreRoot, "module");
const animalPresentationPath = join(coreRoot, "source", "xml", "mod", "mc_data.php");
const config = {
  crops: join(configRoot, "nc", "cropstype.php"),
  cropTimes: join(configRoot, "nc", "cropstime.php"),
  fish: join(configRoot, "nc", "fishtype.php"),
  farmDecorations: join(configRoot, "nc", "itemtype.php"),
  farmTools: join(configRoot, "nc", "toolstype.php"),
  farmUpgrade: join(configRoot, "nc", "upgrade.php"),
  blackUpgrade: join(configRoot, "nc", "upblack.php"),
  animals: join(configRoot, "mc", "animaltype.php"),
  animalTimes: join(configRoot, "mc", "animaltime.php"),
  pastureDecorations: join(configRoot, "mc", "itemtype.php"),
  pastureTools: join(configRoot, "mc", "toolstype.php"),
  hidden: join(configRoot, "_hide.php"),
};
for (const path of Object.values(config)) {
  if (!existsSync(path)) throw new Error(`Required V7 rule source was not found: ${path}`);
}
if (!existsSync(animalPresentationPath)) {
  throw new Error(`Required V7 animal presentation source was not found: ${animalPresentationPath}`);
}

const commonSource = readFileSync(join(coreRoot, "common.php"), "latin1");
const sourceVersion = commonSource.match(/define\('FARM_VERSION',\s*'([^']+)'\)/)?.[1];
if (sourceVersion !== "7.0 Beta1 Build 20120209.1000") {
  throw new Error(`Unexpected QQ Farm source version: ${sourceVersion || "missing"}`);
}

function readPhp(path) {
  return readFileSync(path, "utf8");
}

function entries(path) {
  const rows = [];
  const source = readPhp(path);
  const pattern = /^\s*["']?(\d+)["']?\s*=>\s*array\s*\((.*)\),?\s*$/gm;
  for (const match of source.matchAll(pattern)) rows.push({ key: Number(match[1]), body: match[2] });
  return rows;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function field(body, name, fallback = "") {
  const pattern = new RegExp(`["']${escapeRegExp(name)}["']\\s*=>\\s*(?:"((?:\\\\.|[^"])*)"|'((?:\\\\.|[^'])*)'|(-?\\d+|true|false))`);
  const match = body.match(pattern);
  if (!match) return fallback;
  return (match[1] ?? match[2] ?? match[3] ?? fallback).replaceAll('\\"', '"').replaceAll("\\'", "'");
}

function numberArray(body, name) {
  const match = body.match(new RegExp(`["']${escapeRegExp(name)}["']\\s*=>\\s*array\\s*\\(([^)]*)\\)`));
  return match ? [...match[1].matchAll(/-?\d+/g)].map((item) => Number(item[0])) : [];
}

const hiddenSource = readPhp(config.hidden);
function hiddenIds(name) {
  const match = hiddenSource.match(new RegExp(`\\$_HIDE\\['${escapeRegExp(name)}'\\]\\s*=\\s*array\\((.*?)\\);`, "s"));
  if (!match) throw new Error(`Hidden ID list was not found: ${name}`);
  return new Set([...match[1].matchAll(/\d+/g)].map((item) => Number(item[0])));
}

// Keep filesystem access synchronous and deterministic for generated catalogs.
const awaitImportFs = await import("node:fs");

const hiddenCrops = hiddenIds("seed");
const hiddenAnimals = hiddenIds("animal");
const hiddenFish = hiddenIds("fish");
const hiddenFarmDecorations = hiddenIds("item");
const hiddenPastureDecorations = hiddenIds("mcitem");

const cropAssetDirectory = join(moduleRoot, "ui", "allcrops");
const cropFiles = new Set(awaitImportFs.readdirSync(cropAssetDirectory));
const crops = entries(config.crops).map(({ key, body }) => {
  const id = Number(field(body, "cId", String(key)));
  const expectedFiles = ["Seed", "0", "1", "2", "3", "4"].map((token) => `Crop_${id}_${token}.swf`);
  const foundFiles = expectedFiles.filter((name) => cropFiles.has(name));
  const hidden = hiddenCrops.has(id);
  const vipOnly = field(body, "isvip", "0") === "1";
  const assetStatus = foundFiles.length === 0 ? "missing" : foundFiles.length === expectedFiles.length ? "complete-six-files" : "partial";
  const integrationPolicy = hidden
    ? "excluded-hidden"
    : assetStatus === "complete-six-files" || (vipOnly && foundFiles.length >= 4)
      ? "core-candidate"
      : "blocked-assets";
  return {
    source_id: id,
    name: field(body, "cName"),
    original_level: Number(field(body, "cLevel", "0")),
    crop_type: Number(field(body, "cType", "0")),
    seed_price: Number(field(body, "price", "0")),
    sale_price: Number(field(body, "sale", "0")),
    base_yield: Number(field(body, "output", "0")),
    experience: Number(field(body, "cropExp", "0")),
    growth_seconds: Number(field(body, "growthCycle", "0")),
    harvest_cycles: Number(field(body, "maturingTime", "0")),
    land_requirement: Number(field(body, "isRed", "0")),
    is_flower: field(body, "isFlower", "0") === "1",
    hidden,
    vip_only: vipOnly,
    asset_status: assetStatus,
    asset_files: foundFiles.length,
    integration_policy: integrationPolicy,
  };
});

const animalAnimationDirectory = join(moduleRoot, "mc", "farm", "aswf");
const animalIconDirectory = join(moduleRoot, "mc", "farm", "icon");
const animalProductDirectory = join(moduleRoot, "mc", "farm", "product");
const animalFiles = new Set(awaitImportFs.readdirSync(animalAnimationDirectory));
const animalIconFiles = new Set(awaitImportFs.readdirSync(animalIconDirectory));
const animalProductFiles = new Set(awaitImportFs.readdirSync(animalProductDirectory));
const animalPresentationSource = readPhp(animalPresentationPath);
const animalHouses = new Map();
for (const match of animalPresentationSource.matchAll(/<animal\b[^>]*\bhouse="([窝棚])"[^>]*\bid="(\d+)"|<animal\b[^>]*\bid="(\d+)"[^>]*\bhouse="([窝棚])"/g)) {
  const id = Number(match[2] ?? match[3]);
  const house = match[1] ?? match[4];
  animalHouses.set(id, house === "窝" ? "hutch" : "shed");
}
const animals = entries(config.animals).map(({ key, body }) => {
  const id = Number(field(body, "cId", String(key)));
  const parts = [0, 1].filter((part) => animalFiles.has(`a${id}_${part}.swf`));
  const hidden = hiddenAnimals.has(id);
  const assetStatus = parts.length === 0 ? "missing" : parts.length === 2 ? "complete-two-parts" : "partial";
  return {
    source_id: id,
    name: field(body, "cName"),
    byproduct_name: field(body, "bName"),
    house: animalHouses.get(id) ?? "unknown",
    original_level: Number(field(body, "cLevel", "0")),
    purchase_price: Number(field(body, "price", "0")),
    product_price: Number(field(body, "productprice", "0")),
    byproduct_price: Number(field(body, "byproductprice", "0")),
    animal_harvest_experience: Number(field(body, "harvestpExp", "0")),
    byproduct_harvest_experience: Number(field(body, "harvestbExp", "0")),
    base_yield: Number(field(body, "output", "0")),
    consume: Number(field(body, "consum", "0")),
    cub_seconds: Number(field(body, "cub", "0")),
    maturity_seconds: Number(field(body, "maturingTime", "0")),
    production_seconds: Number(field(body, "procreation", "0")),
    production_cycle_seconds: Number(field(body, "cycle", "0")),
    production_action_seconds: Number(field(body, "productime", "0")),
    vip_only: field(body, "isvip", "0") === "1",
    hidden,
    has_icon: animalIconFiles.has(`a${id}.png`),
    has_product_asset: animalProductFiles.has(`p${id}.swf`),
    asset_status: assetStatus,
    integration_policy: hidden ? "excluded-hidden" : assetStatus === "complete-two-parts" ? "core-candidate" : "blocked-assets",
  };
});

const fishAssetDirectory = join(moduleRoot, "ui", "farm", "fish");
const fishFiles = new Set(awaitImportFs.readdirSync(fishAssetDirectory).map((name) => name.toLowerCase()));
const fish = entries(config.fish).map(({ key, body }) => {
  const id = Number(field(body, "id", String(key)));
  const cycles = numberArray(body, "cycle");
  const crystals = numberArray(body, "lock_crystal");
  const hidden = hiddenFish.has(id);
  const visible = field(body, "show", "0") === "1";
  const hasFishAsset = fishFiles.has(`fish_${String(id).padStart(2, "0")}.swf`);
  const hasSeedAsset = fishFiles.has(`fish_seed_${String(id).padStart(2, "0")}.swf`);
  const integrationPolicy = id === 1 ? "excluded-test" : hidden ? "excluded-hidden" : hasFishAsset && hasSeedAsset ? "core-candidate" : "blocked-assets";
  return {
    source_id: id,
    name: field(body, "crop_name"),
    cycle_seconds: cycles.join(";"),
    experience: Number(field(body, "exp", "0")),
    unlock_crystal_type: crystals[0] ?? 0,
    unlock_crystal_amount: crystals[1] ?? 0,
    unlock_coins: Number(field(body, "lock_money", "0")),
    mature_hours: Number(field(body, "mature", "0")),
    base_yield: Number(field(body, "output", "0")),
    pool_size: Number(field(body, "pool_size", "1")),
    seed_price: Number(field(body, "price", "0")),
    sale_price: Number(field(body, "sale", "0")),
    hidden,
    visible,
    has_fish_asset: hasFishAsset,
    has_seed_asset: hasSeedAsset,
    integration_policy: integrationPolicy,
  };
});

function decorations(path, area, hiddenSet) {
  return entries(path).map(({ key, body }) => {
    const id = Number(field(body, "itemId", String(key)));
    const coinPrice = Number(field(body, "price", "0"));
    const premiumPrice = Number(field(body, "FBPrice", "0"));
    const hidden = hiddenSet.has(id);
    const assetDirectory = area === "farm"
      ? join(moduleRoot, "ui", "farm", "diy")
      : join(moduleRoot, "mc", "farm", "diy");
    const mainAsset = area === "farm" ? `${id}.swf` : `z1_${id}_1.swf`;
    const previewAsset = area === "farm" ? `${id}.jpg` : `z1_${id}_1_shop.jpg`;
    const detailAsset = area === "farm" ? `${id}b.jpg` : null;
    const hasMainAsset = existsSync(join(assetDirectory, mainAsset));
    const hasPreviewAsset = existsSync(join(assetDirectory, previewAsset));
    const hasDetailAsset = detailAsset === null || existsSync(join(assetDirectory, detailAsset));
    const missingAssets = [
      hasMainAsset ? null : "main",
      hasPreviewAsset ? null : "preview",
      hasDetailAsset ? null : "detail",
    ].filter(Boolean);
    const assetStatus = missingAssets.length === 0 ? "complete" : `missing-${missingAssets.join("+")}`;
    return {
      area,
      source_id: id,
      name: field(body, "itemName"),
      set_name: field(body, "itemDesc"),
      item_type: Number(field(body, "itemType", "0")),
      original_level: Number(field(body, "level", "0")),
      coin_price: coinPrice,
      premium_price: premiumPrice,
      discounted_premium_price: Number(field(body, "YFBPrice", "0")),
      experience: Number(field(body, "exp", "0")),
      valid_seconds: Number(field(body, "itemValidTime", "0")),
      hidden,
      has_main_asset: hasMainAsset,
      has_preview_asset: hasPreviewAsset,
      has_detail_asset: hasDetailAsset,
      asset_status: assetStatus,
      integration_policy: assetStatus !== "complete"
        ? "blocked-assets"
        : hidden
          ? "hidden-cosmetic"
          : "shop-candidate",
    };
  });
}

function tools(path, area) {
  return entries(path).map(({ key, body }) => {
    const id = Number(field(body, "tId", field(body, "id", String(key))));
    const vipOnly = field(body, "is_vip", "0") === "1";
    return {
      area,
      source_id: id,
      name: field(body, "tName", field(body, "name")),
      item_type: Number(field(body, "type", "0")),
      coin_price: Number(field(body, "price", "0")),
      premium_price: Number(field(body, "FBPrice", field(body, "qdprice", "0"))),
      discounted_premium_price: Number(field(body, "YFBPrice", field(body, "yqdprice", "0"))),
      effect_seconds: Number(field(body, "effect", "0")),
      vip_only: vipOnly,
      available: field(body, "status", "1") !== "0",
      integration_policy: "core-candidate",
    };
  });
}

function timingRows(path, domain) {
  return entries(path).map(({ key, body }) => ({ source_id: key, domain, values: [...body.matchAll(/-?\d+/g)].map((item) => Number(item[0])).join(";") }));
}

const decorationRows = [
  ...decorations(config.farmDecorations, "farm", hiddenFarmDecorations),
  ...decorations(config.pastureDecorations, "pasture", hiddenPastureDecorations),
];
const toolRows = [...tools(config.farmTools, "farm"), ...tools(config.pastureTools, "pasture")];
const timing = [...timingRows(config.cropTimes, "farm"), ...timingRows(config.animalTimes, "pasture")];
const landUpgradeRows = [
  ...entries(config.farmUpgrade).map(({ key, body }) => ({ land_type: "standard", source_id: key, level: Number(field(body, "level", "0")), coins: Number(field(body, "money", "0")), premium: Number(field(body, "yb", "0")) })),
  ...entries(config.blackUpgrade).map(({ key, body }) => ({ land_type: "black", source_id: key, level: Number(field(body, "level", "0")), coins: Number(field(body, "money", "0")), premium: Number(field(body, "yb", "0")) })),
];

function csv(rows) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const encode = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `${columns.map(encode).join(",")}\n${rows.map((row) => columns.map((column) => encode(row[column])).join(",")).join("\n")}\n`;
}

function writeCsv(name, rows) {
  writeFileSync(join(outputDirectory, name), csv(rows), "utf8");
}

mkdirSync(outputDirectory, { recursive: true });
writeCsv("catalog-crops.csv", crops.sort((a, b) => a.source_id - b.source_id));
writeCsv("catalog-animals.csv", animals.sort((a, b) => a.source_id - b.source_id));
writeCsv("catalog-fish.csv", fish.sort((a, b) => a.source_id - b.source_id));
writeCsv("catalog-decorations.csv", decorationRows.sort((a, b) => a.area.localeCompare(b.area) || a.source_id - b.source_id));
writeCsv("catalog-tools.csv", toolRows.sort((a, b) => a.area.localeCompare(b.area) || a.source_id - b.source_id));
writeCsv("catalog-timings.csv", timing.sort((a, b) => a.domain.localeCompare(b.domain) || a.source_id - b.source_id));
writeCsv("catalog-land-upgrades.csv", landUpgradeRows);

const configHash = createHash("sha256");
for (const path of Object.values(config).sort()) configHash.update(createHash("sha256").update(readFileSync(path)).digest("hex"));
configHash.update(createHash("sha256").update(readFileSync(animalPresentationPath)).digest("hex"));
const summary = [
  { key: "source_version", value: sourceVersion },
  { key: "config_bundle_sha256", value: configHash.digest("hex") },
  { key: "crop_rows", value: crops.length },
  { key: "crop_core_candidates", value: crops.filter((row) => row.integration_policy === "core-candidate").length },
  { key: "animal_rows", value: animals.length },
  { key: "animal_core_candidates", value: animals.filter((row) => row.integration_policy === "core-candidate").length },
  { key: "fish_rows", value: fish.length },
  { key: "fish_core_candidates", value: fish.filter((row) => row.integration_policy === "core-candidate").length },
  { key: "farm_decoration_rows", value: decorationRows.filter((row) => row.area === "farm").length },
  { key: "pasture_decoration_rows", value: decorationRows.filter((row) => row.area === "pasture").length },
  { key: "decoration_shop_candidates", value: decorationRows.filter((row) => row.integration_policy === "shop-candidate").length },
  { key: "decoration_hidden_candidates", value: decorationRows.filter((row) => row.integration_policy === "hidden-cosmetic").length },
  { key: "decoration_blocked_assets", value: decorationRows.filter((row) => row.integration_policy === "blocked-assets").length },
  { key: "farm_tool_rows", value: toolRows.filter((row) => row.area === "farm").length },
  { key: "pasture_tool_rows", value: toolRows.filter((row) => row.area === "pasture").length },
  { key: "timing_rows", value: timing.length },
  { key: "land_upgrade_rows", value: landUpgradeRows.length },
];
writeCsv("rules-summary.csv", summary);

console.log(JSON.stringify(Object.fromEntries(summary.map((row) => [row.key, row.value])), null, 2));
