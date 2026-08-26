import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(process.argv[2] ?? process.env.MANOR_V7_SOURCE_PATH ?? "D:\\QQnc");
const pluginRoot = join(sourceRoot, "wwwroot", "source", "plugin", "qqfarm");
const templateRoot = join(pluginRoot, "core", "source", "xml", "mod");
const outputRoot = join(repositoryRoot, "apps", "web", "public", "assets", "manor", "v7-swf", "config");
const originToken = "__MANOR_ORIGIN__";
const moduleRoot = `${originToken}/module`;

const outputs = [
  ["nc_main.php", "load_main_v_20120209.xml"],
  ["nc_data.php", "data_zh_CN_v_20120209.xml"],
  ["nc_addon.php", "addon_v_20120209.xml"],
  ["mc_main.php", "mcini_main_v_20120209.xml"],
  ["mc_data.php", "mcdata_zh_CN_v_20120209.xml"],
  ["mc_card.php", "mccard_zh_CN_v_20120209.xml"]
];

await mkdir(outputRoot, { recursive: true });

for (const [sourceName, outputName] of outputs) {
  const source = await readFile(join(templateRoot, sourceName), "utf8");
  const match = source.match(/<<<XML\s*([\s\S]*?)\s*XML;/);
  if (!match) throw new Error(`Could not extract XML heredoc from ${sourceName}`);

  const apiPath = sourceName.startsWith("mc_")
    ? `${originToken}/api/manor/flash/pasture?mod=`
    : `${originToken}/api/manor/flash/farm?`;
  const xml = applyLocalFeatureFlags(match[1]
    .replaceAll("$url/mync.php?", apiPath)
    .replaceAll("$url/mymc.php?mod=", apiPath)
    .replaceAll("$url", originToken)
    .replace(/(?<![\w/.-])module\//g, `${moduleRoot}/`)
    .replace(/(?<![\w/.-])icon\//g, `${moduleRoot}/icon/`), sourceName);

  if (xml.includes("$url") || xml.includes("mync.php") || xml.includes("mymc.php")) {
    throw new Error(`Generated ${outputName} still contains a legacy runtime URL`);
  }
  await writeFile(join(outputRoot, outputName), `${xml.trim()}\n`, "utf8");
}

function applyLocalFeatureFlags(xml, sourceName) {
  const localized = xml
    .replace("<adSeedTabOpen>1</adSeedTabOpen>", "<adSeedTabOpen>0</adSeedTabOpen>")
    .replace("<snsAdAllowLvl>0</snsAdAllowLvl>", "<snsAdAllowLvl>999</snsAdAllowLvl>")
    .replace(/<shopLinkTip value="交流论坛" url="[^"]*"\s*\/>/u, '<shopLinkTip value="" url=""/>');
  if (sourceName !== "mc_data.php") return localized;

  let replacements = 0;
  const withValidSoundFlags = localized.replace(
    /<animal\b[^>]*\bid="(?:1010|1497|1498|1499)"[^>]*>/gu,
    (animal) => {
      const patched = animal.replace('sound="1"', 'sound="0"');
      if (patched !== animal) replacements += 1;
      return patched;
    }
  );
  if (replacements !== 4) throw new Error(`Expected to disable four missing animal sounds, disabled ${replacements}`);
  return withValidSoundFlags;
}

await populateBoardConfig();

process.stdout.write(`Generated ${outputs.length} Manor V7 Flash configuration files in ${outputRoot}\n`);

async function populateBoardConfig() {
  const boardRoot = join(pluginRoot, "core", "module", "ui", "farm", "diy", "board");
  const boardIds = (await readdir(boardRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^\d+\.swf$/u.test(entry.name))
    .map((entry) => Number.parseInt(entry.name, 10))
    .filter((id) => id > 80_000)
    .sort((left, right) => left - right);
  const dataXml = await readFile(join(outputRoot, "data_zh_CN_v_20120209.xml"), "utf8");
  const assetIdByBoardId = new Map(
    [...dataXml.matchAll(/<asset id="(\d+)" src="__MANOR_ORIGIN__\/module\/ui\/farm\/diy\/board\/(\d+)\.swf"\/>/gu)]
      .map((match) => [Number.parseInt(match[2], 10), Number.parseInt(match[1], 10)])
  );
  const boards = boardIds.map((id) => {
    const assetId = assetIdByBoardId.get(id);
    if (!assetId) throw new Error(`Board ${id} does not have a SWF asset mapping`);
    return { id, asset_id: assetId };
  });
  const addonPath = join(outputRoot, "addon_v_20120209.xml");
  const addonXml = await readFile(addonPath, "utf8");
  const boardSection = [
    '\t<boards type="json">',
    '\t\t<![CDATA[',
    '\t\t{"boards": [',
    boards.map((board) => `\t\t\t${JSON.stringify(board)}`).join(",\n"),
    "\t\t]}",
    "\t\t]]>",
    "\t</boards>"
  ].join("\n");
  const populated = addonXml.replace(
    /\t<boards type="json">\s*<!\[CDATA\[\s*\{"boards": \[[\s\S]*?\]\}\s*\]\]>\s*<\/boards>/u,
    boardSection
  );
  if (populated === addonXml) throw new Error("Could not populate the board section in addon_v_20120209.xml");
  await writeFile(addonPath, populated, "utf8");
}
