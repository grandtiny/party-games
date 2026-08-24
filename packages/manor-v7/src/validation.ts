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
    case "upgrade-land": return {
      type,
      landId: integer(input.landId),
      tier: landTier(input.tier),
      ...(input.useVip === undefined ? {} : { useVip: boolean(input.useVip) })
    };
    case "sell-produce": return { type, cropId: integer(input.cropId), quantity: quantity(input.quantity) };
    case "sell-seed": return { type, cropId: integer(input.cropId), quantity: quantity(input.quantity) };
    case "sell-selected-seeds": return { type, cropIds: integerArray(input.cropIds) };
    case "set-produce-lock": return { type, cropId: integer(input.cropId), locked: boolean(input.locked) };
    case "unlock-fish":
    case "plant-fish":
      return { type, fishId: integer(input.fishId) };
    case "register-fish-pool":
    case "sell-all-cubs":
    case "process-manure-fertilizer":
      return { type };
    case "delete-received-flowers":
      return { type, giftIds: integerArray(input.giftIds) };
    case "set-fish-lock": return { type, fishId: integer(input.fishId), locked: boolean(input.locked) };
    case "fertilize-fish": return { type, serial: integer(input.serial), toolId: integer(input.toolId) };
    case "buy-fish-seed":
    case "sell-fish":
      return { type, fishId: integer(input.fishId), quantity: quantity(input.quantity) };
    case "harvest-fish": return { type, serial: integer(input.serial) };
    case "buy-tool": return {
      type,
      area: area(input.area),
      toolId: integer(input.toolId),
      quantity: quantity(input.quantity),
      ...(input.itemType === undefined ? {} : { itemType: integer(input.itemType) }),
      ...(input.useVip === undefined ? {} : { useVip: boolean(input.useVip) })
    };
    case "buy-farm-dog": return { type, dogId: integer(input.dogId) };
    case "buy-dog-food": {
      const days = integer(input.days);
      if (days !== 1 && days !== 7) throw new Error("狗粮天数无效");
      return { type, days };
    }
    case "set-active-dog": return { type, dogId: nullableInteger(input.dogId) };
    case "block-friend":
    case "unblock-friend":
      return { type, userId: boundedText(input.userId, 128) };
    case "buy-animal": return { type, animalId: integer(input.animalId), quantity: quantity(input.quantity) };
    case "raise-animal-from-inventory": return { type, animalId: integer(input.animalId), quantity: quantity(input.quantity) };
    case "use-pasture-can": return { type, serial: integer(input.serial), toolId: integer(input.toolId) };
    case "buy-grass":
    case "buy-grass-to-inventory":
      return { type, quantity: quantity(input.quantity) };
    case "buy-pasture-guard": return { type, guardId: integer(input.guardId) };
    case "set-pasture-guard-active": return { type, guardId: integer(input.guardId), active: boolean(input.active) };
    case "pay-pasture-guard": return { type, guardId: integer(input.guardId), days: quantity(input.days) };
    case "feed-grass-from-inventory": return { type, quantity: quantity(input.quantity) };
    case "claim-daily-package":
    case "record-sign-in-visit":
    case "claim-sign-in":
    case "sell-all-produce":
    case "sell-all-pasture-products":
    case "clear-mosquito":
    case "catch-own-mouse":
      return { type };
    case "claim-sign-in-streak-reward":
      return { type, days: integer(input.days) };
    case "accept-tutorial-task":
    case "complete-tutorial-task":
    case "show-research-guide":
    case "clear-activities":
    case "claim-vip-return-gift":
    case "generate-seasonal-animal-drop":
    case "claim-halloween-candy-seeds":
    case "claim-cookie-sprites":
    case "exchange-halloween-candy-pumpkin":
    case "exchange-halloween-cookie-baby":
    case "exchange-halloween-carnival-gift":
    case "claim-spring-festival-gift":
    case "claim-reunion-fish-gift":
      return { type };
    case "redeem-code":
      return { type, code: boundedText(input.code, 64) };
    case "claim-level-rewards":
      return { type, area: area(input.area), throughLevel: integer(input.throughLevel) };
    case "collect-products":
      return { type, ...(input.animalId === undefined ? {} : { animalId: integer(input.animalId) }) };
    case "harvest-animals":
      return { type, ...(input.serial === undefined ? {} : { serial: integer(input.serial) }) };
    case "start-production":
    case "collect-product":
    case "sell-animal":
    case "donate-animal":
      return { type, serial: integer(input.serial) };
    case "sell-cub": return { type, animalId: integer(input.animalId), quantity: quantity(input.quantity) };
    case "sell-animal-product":
    case "sell-harvested-animal":
      return { type, animalId: integer(input.animalId), quantity: quantity(input.quantity) };
    case "collect-manure": return { type };
    case "upgrade-house": return { type, house: animalHouse(input.house) };
    case "start-research": return { type, house: animalHouse(input.house), animalId: integer(input.animalId) };
    case "collect-research": return { type, house: animalHouse(input.house) };
    case "use-research-hourglass": return { type, house: animalHouse(input.house), toolId: integer(input.toolId) };
    case "special-feed": return { type, serial: integer(input.serial) };
    case "set-parade": return { type, info: boundedText(input.info, 512), patternId: integer(input.patternId) };
    case "buy-decoration":
    case "renew-decoration":
      return {
        type,
        area: area(input.area),
        decorationId: integer(input.decorationId),
        ...(input.useVip === undefined ? {} : { useVip: boolean(input.useVip) })
      };
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
    case "sell-wild-crystal":
      return { type, crystalId: integer(input.crystalId), quantity: quantity(input.quantity) };
    case "pickup-wild-crystal": return { type, serial: integer(input.serial) };
    default:
      throw new Error("不支持的 V7 庄园操作");
  }
}

export function parseManorV7FriendAction(value: unknown): ManorV7FriendAction {
  const input = record(value);
  const type = text(input.type, "操作类型");
  switch (type) {
    case "generate-seasonal-animal-drop":
    case "offer-halloween-candy":
    case "offer-halloween-cookie":
      return { type };
    case "adopt-seasonal-animal":
      return { type, animalId: integer(input.animalId) };
    case "water":
    case "remove-weeds":
    case "remove-pests":
    case "steal-crop":
    case "add-weeds":
    case "add-pests":
      return { type, landId: integer(input.landId) };
    case "steal-fish": return { type, serial: integer(input.serial) };
    case "fertilize-fish": return {
      type,
      serial: integer(input.serial),
      ...(input.toolId === undefined ? {} : { toolId: integer(input.toolId) })
    };
    case "special-feed": return { type, serial: integer(input.serial) };
    case "clean-manure": return { type, quantity: quantity(input.quantity) };
    case "buy-grass-for-friend": return { type, quantity: quantity(input.quantity) };
    case "add-mosquito": return { type, quantity: quantity(input.quantity ?? 1) };
    case "remove-mosquito":
    case "catch-mouse":
      return { type };
    case "send-flower": return {
      type,
      flowerId: integer(input.flowerId),
      message: boundedText(input.message, 200)
    };
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

function boundedText(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) throw new Error("操作参数无效");
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

function integerArray(value: unknown): number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1_000) throw new Error("操作参数无效");
  return value.map(integer);
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
