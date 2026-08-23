import type { ManorV7Action, ManorV7AnimalHouse, ManorV7Area, ManorV7FriendAction, ManorV7LandTier } from "./types.js";

export function parseManorV7Action(value: unknown): ManorV7Action {
  const input = record(value);
  const type = text(input.type, "操作类型");
  switch (type) {
    case "buy-seed": return { type, cropId: integer(input.cropId), quantity: quantity(input.quantity) };
    case "plant": return { type, landId: integer(input.landId), cropId: integer(input.cropId) };
    case "water":
    case "remove-weeds":
    case "remove-pests":
    case "harvest":
    case "clear-land":
    case "reclaim-land":
      return { type, landId: integer(input.landId) };
    case "fertilize": return { type, landId: integer(input.landId), toolId: integer(input.toolId) };
    case "upgrade-land": return { type, landId: integer(input.landId), tier: landTier(input.tier) };
    case "sell-produce": return { type, cropId: integer(input.cropId), quantity: quantity(input.quantity) };
    case "set-produce-lock": return { type, cropId: integer(input.cropId), locked: boolean(input.locked) };
    case "unlock-fish":
    case "plant-fish":
      return { type, fishId: integer(input.fishId) };
    case "buy-fish-seed":
    case "sell-fish":
      return { type, fishId: integer(input.fishId), quantity: quantity(input.quantity) };
    case "harvest-fish": return { type, serial: integer(input.serial) };
    case "buy-tool": return { type, area: area(input.area), toolId: integer(input.toolId), quantity: quantity(input.quantity) };
    case "buy-animal": return { type, animalId: integer(input.animalId), quantity: quantity(input.quantity) };
    case "raise-animal-from-inventory": return { type, animalId: integer(input.animalId), quantity: quantity(input.quantity) };
    case "use-pasture-can": return { type, serial: integer(input.serial), toolId: integer(input.toolId) };
    case "buy-grass":
    case "buy-grass-to-inventory":
      return { type, quantity: quantity(input.quantity) };
    case "buy-pasture-guard": return { type, guardId: integer(input.guardId) };
    case "feed-grass-from-inventory": return { type, quantity: quantity(input.quantity) };
    case "claim-daily-package":
    case "record-sign-in-visit":
    case "claim-sign-in":
    case "sell-all-produce":
    case "sell-all-pasture-products":
      return { type };
    case "claim-sign-in-streak-reward":
      return { type, days: integer(input.days) };
    case "collect-products":
      return { type, ...(input.animalId === undefined ? {} : { animalId: integer(input.animalId) }) };
    case "harvest-animals":
      return { type, ...(input.serial === undefined ? {} : { serial: integer(input.serial) }) };
    case "start-production":
    case "collect-product":
    case "sell-animal":
      return { type, serial: integer(input.serial) };
    case "sell-animal-product":
    case "sell-harvested-animal":
      return { type, animalId: integer(input.animalId), quantity: quantity(input.quantity) };
    case "collect-manure": return { type };
    case "upgrade-house": return { type, house: animalHouse(input.house) };
    case "buy-decoration":
    case "equip-decoration":
      return { type, area: area(input.area), decorationId: integer(input.decorationId) };
    case "set-board":
      return { type, boardId: nullableInteger(input.boardId) };
    case "set-avatar":
      return { type, avatarId: nullableInteger(input.avatarId) };
    case "open-wild-slot": return { type, slotId: integer(input.slotId) };
    case "adopt-wild-animal": return { type, slotId: integer(input.slotId), animalType: integer(input.animalType) };
    case "claim-wild-return":
    case "donate-wild-animal":
      return { type, slotId: integer(input.slotId) };
    case "attack-wild-animal":
      return {
        type,
        serial: integer(input.serial),
        attackType: text(input.attackType, "驱赶方式"),
        weaponId: integer(input.weaponId)
      };
    case "pickup-wild-crystal": return { type, serial: integer(input.serial) };
    default:
      throw new Error("不支持的 V7 庄园操作");
  }
}

export function parseManorV7FriendAction(value: unknown): ManorV7FriendAction {
  const input = record(value);
  const type = text(input.type, "操作类型");
  switch (type) {
    case "water":
    case "remove-weeds":
    case "remove-pests":
    case "steal-crop":
      return { type, landId: integer(input.landId) };
    case "start-production":
    case "steal-product":
      return { type, serial: integer(input.serial) };
    case "release-wild-animal":
      return {
        type,
        slotId: integer(input.slotId),
        animalType: integer(input.animalType),
        area: area(input.area)
      };
    case "attack-wild-animal":
      return {
        type,
        serial: integer(input.serial),
        attackType: text(input.attackType, "驱赶方式"),
        weaponId: integer(input.weaponId)
      };
    case "pickup-wild-crystal": return { type, serial: integer(input.serial) };
    default:
      throw new Error("不支持的 V7 好友互动");
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("V7 庄园操作格式无效");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) throw new Error(`${label}无效`);
  return value;
}

function integer(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 1_000_000) throw new Error("操作参数无效");
  return value as number;
}

function nullableInteger(value: unknown): number | null {
  return value === null ? null : integer(value);
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("操作参数无效");
  return value;
}

function quantity(value: unknown): number {
  const parsed = integer(value);
  if (parsed < 1 || parsed > 1_000) throw new Error("数量无效");
  return parsed;
}

function area(value: unknown): ManorV7Area {
  if (value !== "farm" && value !== "pasture") throw new Error("庄园区域无效");
  return value;
}

function animalHouse(value: unknown): ManorV7AnimalHouse {
  if (value !== "hutch" && value !== "shed") throw new Error("牧场建筑无效");
  return value;
}

function landTier(value: unknown): Exclude<ManorV7LandTier, "normal"> {
  if (value !== "red" && value !== "black") throw new Error("土地等级无效");
  return value;
}
