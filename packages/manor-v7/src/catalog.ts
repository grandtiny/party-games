import {
  MANOR_V7_ANIMALS,
  MANOR_V7_AVATARS,
  MANOR_V7_CROPS as MANOR_V7_GENERATED_CROPS,
  MANOR_V7_DECORATIONS,
  MANOR_V7_FISH,
  MANOR_V7_LAND_UPGRADES,
  MANOR_V7_TOOLS
} from "./catalog.generated.js";
import type {
  ManorV7AnimalDefinition,
  ManorV7Area,
  ManorV7AvatarDefinition,
  ManorV7CropDefinition,
  ManorV7DecorationDefinition,
  ManorV7FishDefinition,
  ManorV7LandTier,
  ManorV7ToolDefinition
} from "./types.js";
import {
  manorV7EffectiveCropSalePrice,
  manorV7EffectiveCropSeedPrice
} from "./seasonal.js";

export const MANOR_V7_CROPS: readonly ManorV7CropDefinition[] = MANOR_V7_GENERATED_CROPS.map((crop) => ({
  ...crop,
  seedPrice: manorV7EffectiveCropSeedPrice(crop.id, crop.seedPrice),
  salePrice: manorV7EffectiveCropSalePrice(crop.id, crop.salePrice)
}));

const cropMap = new Map<number, ManorV7CropDefinition>(MANOR_V7_CROPS.map((item) => [item.id, item]));
const animalMap = new Map<number, ManorV7AnimalDefinition>(MANOR_V7_ANIMALS.map((item) => [item.id, item]));
const avatarMap = new Map<number, ManorV7AvatarDefinition>(MANOR_V7_AVATARS.map((item) => [item.id, item]));
const fishMap = new Map<number, ManorV7FishDefinition>(MANOR_V7_FISH.map((item) => [item.id, item]));
const defaultPastureDecorations = [
  {
    area: "pasture",
    id: 105,
    name: "默认牧场",
    setName: "QQ牧场",
    itemType: 101,
    originalLevel: 0,
    coinPrice: 0,
    premiumPrice: 0,
    experience: 0,
    validSeconds: 1,
    isHidden: true,
    isRenderable: true
  }
] as const satisfies readonly ManorV7DecorationDefinition[];

export const MANOR_V7_BOARD_IDS = [
  90020, 90021, 90022, 90023, 90024, 90025, 90026, 90027, 90028, 90029,
  90030, 90031, 90032, 90473, 90474, 90475
] as const;

export function manorV7Crop(id: number): ManorV7CropDefinition {
  const item = cropMap.get(id);
  if (!item) throw new Error("作物不存在或未接入 V7 素材");
  return item;
}

export function manorV7Animal(id: number): ManorV7AnimalDefinition {
  const item = animalMap.get(id);
  if (!item) throw new Error("动物不存在或未接入 V7 素材");
  return item;
}

export function manorV7Avatar(id: number): ManorV7AvatarDefinition {
  const item = avatarMap.get(id);
  if (!item) throw new Error("农场形象不存在或未接入 V7 素材");
  return item;
}

export function manorV7Fish(id: number): ManorV7FishDefinition {
  const item = fishMap.get(id);
  if (!item) throw new Error("鱼种不存在或未接入 V7 素材");
  return item;
}

export function manorV7Tool(area: ManorV7Area, id: number): ManorV7ToolDefinition {
  const item = MANOR_V7_TOOLS.find((candidate) => candidate.area === area && candidate.id === id);
  if (!item) throw new Error("工具不存在");
  return item;
}

export function manorV7ToolByType(area: ManorV7Area, id: number, itemType: number): ManorV7ToolDefinition {
  const item = MANOR_V7_TOOLS.find((candidate) => (
    candidate.area === area && candidate.id === id && candidate.itemType === itemType
  ));
  if (!item) throw new Error("工具不存在");
  return item;
}

export function manorV7LocalCoinPrice(coinPrice: number, premiumPrice: number): number {
  if (coinPrice > 0) return coinPrice;
  if (premiumPrice > 0) return premiumPrice * 1_000;
  return 0;
}

export function manorV7ToolCoinPrice(tool: ManorV7ToolDefinition): number {
  return manorV7LocalCoinPrice(tool.coinPrice, tool.premiumPrice);
}

export function manorV7DecorationCoinPrice(decoration: ManorV7DecorationDefinition): number {
  return manorV7LocalCoinPrice(decoration.coinPrice, decoration.premiumPrice);
}

export function manorV7PastureGuard(id: number): ManorV7ToolDefinition {
  const item = MANOR_V7_TOOLS.find((candidate) => (
    candidate.area === "pasture" && candidate.itemType === 106 && candidate.id === id
  ));
  if (!item) throw new Error("牧场看守不存在");
  return item;
}

export function manorV7Decoration(area: ManorV7Area, id: number): ManorV7DecorationDefinition {
  const item = defaultPastureDecorations.find((candidate) => candidate.area === area && candidate.id === id)
    ?? MANOR_V7_DECORATIONS.find((candidate) => candidate.area === area && candidate.id === id);
  if (!item) throw new Error("装扮不存在");
  return item;
}

export function manorV7Board(id: number): number {
  if (!MANOR_V7_BOARD_IDS.includes(id as (typeof MANOR_V7_BOARD_IDS)[number])) {
    throw new Error("告示牌不存在或未接入 V7 素材");
  }
  return id;
}

export function manorV7LandUpgrade(tier: Exclude<ManorV7LandTier, "normal">, upgradedCount: number) {
  const landType = tier === "red" ? "standard" : "black";
  const item = MANOR_V7_LAND_UPGRADES.find((candidate) =>
    candidate.landType === landType && candidate.sourceId === upgradedCount
  );
  if (!item) throw new Error("没有可用的土地升级规则");
  return item;
}

export {
  MANOR_V7_ANIMALS,
  MANOR_V7_AVATARS,
  MANOR_V7_DECORATIONS,
  MANOR_V7_FISH,
  MANOR_V7_LAND_UPGRADES,
  MANOR_V7_TOOLS
};
