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
};
for (const [name, count] of Object.entries(expected)) {
  const actual = rows(name);
  if (actual !== count) throw new Error(`${name}: expected ${count} rows, found ${actual}`);
}

const summaryText = readFileSync(join(root, "rules-summary.csv"), "utf8");
if (!summaryText.includes("7.0 Beta1 Build 20120209.1000")) throw new Error("Rule catalog source version drifted");
if (!summaryText.includes("config_bundle_sha256")) throw new Error("Rule catalog fingerprint is missing");

const animalLines = readFileSync(join(root, "catalog-animals.csv"), "utf8").trim().split(/\r?\n/);
if (!animalLines[0]?.includes('"house"')) throw new Error("Animal house classification is missing");
const invalidCoreAnimalHouses = animalLines.slice(1).filter((line) =>
  line.includes('"core-candidate"') && !line.includes('"hutch"') && !line.includes('"shed"')
);
if (invalidCoreAnimalHouses.length > 0) {
  throw new Error(`Core animal house classification is incomplete: ${invalidCoreAnimalHouses.length}`);
}

console.log("QQ Farm V7 rule catalog verification passed");
