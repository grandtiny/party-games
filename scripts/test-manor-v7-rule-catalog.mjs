import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(process.argv[2] || join(repositoryRoot, "docs", "manor-v7-source"));

function rows(name) {
  const lines = readFileSync(join(root, name), "utf8").trim().split(/\r?\n/);
  return Math.max(0, lines.length - 1);
}

const expected = {
  "catalog-crops.csv": 589,
  "catalog-animals.csv": 178,
  "catalog-fish.csv": 17,
  "catalog-decorations.csv": 821,
  "catalog-tools.csv": 91,
  "catalog-avatars.csv": 326,
};
for (const [name, count] of Object.entries(expected)) {
  const actual = rows(name);
  if (actual !== count) throw new Error(`${name}: expected ${count} rows, found ${actual}`);
}

const summaryText = readFileSync(join(root, "rules-summary.csv"), "utf8");
if (!summaryText.includes("7.0 Beta1 Build 20120209.1000")) throw new Error("Rule catalog source version drifted");
if (!summaryText.includes("config_bundle_sha256")) throw new Error("Rule catalog fingerprint is missing");
const expectedRuntimeDefinitions = {
  crop_runtime_definitions: 577,
  animal_runtime_definitions: 177,
  fish_runtime_definitions: 16,
  decoration_runtime_definitions: 821,
  decoration_renderable_definitions: 816,
};
for (const [key, count] of Object.entries(expectedRuntimeDefinitions)) {
  if (!summaryText.includes(`"${key}","${count}"`)) {
    throw new Error(`${key}: expected ${count}`);
  }
}

const animalLines = readFileSync(join(root, "catalog-animals.csv"), "utf8").trim().split(/\r?\n/);
if (!animalLines[0]?.includes('"house"')) throw new Error("Animal house classification is missing");
const invalidCoreAnimalHouses = animalLines.slice(1).filter((line) =>
  line.includes('"core-candidate"') && !line.includes('"hutch"') && !line.includes('"shed"')
);
if (invalidCoreAnimalHouses.length > 0) {
  throw new Error(`Core animal house classification is incomplete: ${invalidCoreAnimalHouses.length}`);
}

const decorationText = readFileSync(join(root, "catalog-decorations.csv"), "utf8");
const decorationLines = decorationText.trim().split(/\r?\n/);
if (!decorationLines[0]?.includes('"asset_status"')) throw new Error("Decoration asset audit is missing");
const blockedDecorationIds = decorationLines.slice(1)
  .filter((line) => line.includes('"blocked-assets"'))
  .map((line) => Number(line.match(/^"[^"]+","(\d+)"/)?.[1] ?? 0));
if (blockedDecorationIds.join(",") !== "21,26,31,627,669") {
  throw new Error(`Unexpected blocked decoration catalog: ${blockedDecorationIds.join(",")}`);
}
if (decorationLines.filter((line) => line.includes('"hidden-cosmetic"')).length !== 187) {
  throw new Error("Renderable hidden decoration count drifted");
}
if (decorationLines.filter((line) => line.includes('"shop-candidate"')).length !== 629) {
  throw new Error("Decoration shop candidate count drifted");
}

console.log("QQ Farm V7 rule catalog verification passed");
