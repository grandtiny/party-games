import { manorV7Animal, manorV7Crop } from "./catalog.js";
import {
  addManorV7Activity,
  advanceManorV7State,
  drawManorV7Random,
  setInventoryQuantity,
  validateManorV7State,
  type ManorV7RuntimeOptions
} from "./state.js";
import type {
  ManorV7FriendAction,
  ManorV7FriendTransitionResult,
  ManorV7State
} from "./types.js";
import { attackIncomingWildAnimal, startManorV7Production } from "./actions.js";
import { MANOR_V7_WILD_STAY_SECONDS, manorV7WildAnimal } from "./wild.js";

export function transitionManorV7FriendStates(
  currentVisitor: ManorV7State,
  currentOwner: ManorV7State,
  visitorUserId: string,
  visitorDisplayName: string,
  ownerUserId: string,
  ownerDisplayName: string,
  action: ManorV7FriendAction,
  now: number,
  options: ManorV7RuntimeOptions = {}
): ManorV7FriendTransitionResult {
  if (!visitorUserId) throw new Error("好友账号无效");
  const visitor = advanceManorV7State(currentVisitor, now, options);
  const owner = advanceManorV7State(currentOwner, now, options);
  let message: string;

  if (action.type === "release-wild-animal") {
    const slot = visitor.pasture.wild.slots.find((item) => item.slotId === action.slotId);
    if (!slot || slot.animalType !== action.animalType) throw new Error("野生动物槽位无效");
    if (slot.status !== 1 || slot.remainingReleases < 1) throw new Error("该野生动物当前不能放养");
    if (owner.pasture.wild.incomingAnimals.length >= 3) throw new Error("好友家的野生动物位置已满");
    const definition = manorV7WildAnimal(slot.animalType);
    const returnAt = now + MANOR_V7_WILD_STAY_SECONDS * 1_000;
    slot.status = 2;
    slot.currentBlood = definition.blood;
    slot.remainingReleases -= 1;
    slot.targetUserId = ownerUserId;
    slot.targetDisplayName = ownerDisplayName;
    slot.targetArea = action.area;
    slot.releasedAt = now;
    slot.returnAt = returnAt;
    slot.restUntil = null;
    visitor.pasture.wild.moralExperience += definition.releaseMoral;
    owner.pasture.wild.incomingAnimals.push({
      serial: owner.pasture.wild.nextIncomingSerial,
      ownerUserId: visitorUserId,
      ownerDisplayName: visitorDisplayName,
      ownerSlotId: slot.slotId,
      animalType: slot.animalType,
      area: action.area,
      blood: definition.blood,
      status: 2,
      arrivedAt: now,
      returnAt,
      attacks: []
    });
    owner.pasture.wild.nextIncomingSerial += 1;
    message = `把${definition.name}放养到${ownerDisplayName}的${action.area === "farm" ? "农场" : "牧场"}`;
    addManorV7Activity(visitor, "pasture", message, now);
    addManorV7Activity(owner, "pasture", `${visitorDisplayName}放养了一只${definition.name}`, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "attack-wild-animal") {
    const result = attackIncomingWildAnimal(
      owner,
      action.serial,
      action.attackType,
      action.weaponId,
      visitorDisplayName,
      now,
      visitorUserId,
      visitor,
      owner
    );
    message = result.successful ? `成功驱赶野生动物，造成 ${result.damage} 点伤害` : "驱赶野生动物失败";
    addManorV7Activity(visitor, "pasture", `在${ownerDisplayName}家${message}`, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "pickup-wild-crystal") {
    const index = owner.pasture.wild.crystalDrops.findIndex((drop) => drop.serial === action.serial);
    const drop = owner.pasture.wild.crystalDrops[index];
    if (!drop) throw new Error("水晶已经被捡走了");
    owner.pasture.wild.crystalDrops.splice(index, 1);
    setInventoryQuantity(
      visitor.pasture.wild.crystalInventory,
      drop.crystalId,
      inventoryQuantity(visitor.pasture.wild.crystalInventory, drop.crystalId) + drop.quantity
    );
    message = `捡到了 ${drop.quantity} 颗水晶`;
    addManorV7Activity(visitor, "pasture", `在${ownerDisplayName}家${message}`, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "steal-product") {
    const animalState = owner.pasture.animals.find((item) => item.serial === action.serial);
    if (!animalState || animalState.pendingProduct < 1) throw new Error("该动物没有可偷取的副产品");
    if (animalState.productThiefUserIds.includes(visitorUserId)) throw new Error("这一轮副产品已经偷过了");
    const animal = manorV7Animal(animalState.animalId);
    const remaining = animalState.pendingProduct - animalState.stolenProduct;
    if (remaining <= Math.floor(animal.baseYield / 2)) throw new Error("来晚了，副产品已经达到最低保留数量");
    animalState.stolenProduct += 1;
    animalState.productThiefUserIds.push(visitorUserId);
    setInventoryQuantity(
      visitor.pasture.productInventory,
      animal.id,
      inventoryQuantity(visitor.pasture.productInventory, animal.id) + 1
    );
    message = `偷到了 1 份${animal.byproductName}`;
    addManorV7Activity(owner, "pasture", `${visitorDisplayName}拿走了 1 份${animal.byproductName}`, now);
    addManorV7Activity(visitor, "pasture", `从${ownerDisplayName}的牧场拿到了 1 份${animal.byproductName}`, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "start-production") {
    const animal = startManorV7Production(owner, action.serial);
    visitor.pastureExperience += 2;
    message = `帮${ownerDisplayName}把${animal.name}送去生产`;
    addManorV7Activity(owner, "pasture", `${visitorDisplayName}帮忙把${animal.name}送去生产`, now);
    addManorV7Activity(visitor, "pasture", message, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  const land = owner.farm.lands.find((item) => item.id === action.landId && item.unlocked);
  if (!land?.cropId) throw new Error("这块土地没有作物");
  const crop = manorV7Crop(land.cropId);

  if (action.type === "steal-crop") {
    if (land.harvests >= crop.harvestCycles || land.growthSeconds < crop.growthSeconds) throw new Error("作物尚未成熟");
    if (land.thiefUserIds.includes(visitorUserId)) throw new Error("这一季作物已经偷过了");
    const minimum = Math.floor(crop.baseYield * 0.6);
    const available = crop.baseYield - land.stolen - minimum;
    if (available < 1) throw new Error("来晚了，作物已经达到最低保留产量");
    const quantity = Math.min(available, drawStealQuantity(drawManorV7Random(owner)));
    land.stolen += quantity;
    land.thiefUserIds.push(visitorUserId);
    setInventoryQuantity(
      visitor.farm.produceInventory,
      crop.id,
      inventoryQuantity(visitor.farm.produceInventory, crop.id) + quantity
    );
    message = `偷到了 ${quantity} 个${crop.name}`;
    addManorV7Activity(owner, "farm", `${visitorDisplayName}摘走了 ${quantity} 个${crop.name}`, now);
    addManorV7Activity(visitor, "farm", `从${ownerDisplayName}的农场摘到了 ${quantity} 个${crop.name}`, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "water") {
    if (land.watered) throw new Error("这块土地不需要浇水");
    land.watered = true;
    message = `帮${ownerDisplayName}浇了水`;
  } else if (action.type === "remove-weeds") {
    if (!land.weeds) throw new Error("这块土地没有杂草");
    land.weeds = false;
    message = `帮${ownerDisplayName}清除了杂草`;
  } else {
    if (!land.pests) throw new Error("这块土地没有害虫");
    land.pests = false;
    message = `帮${ownerDisplayName}清除了害虫`;
  }
  visitor.farmExperience += 2;
  addManorV7Activity(owner, "farm", `${visitorDisplayName}${message.slice(ownerDisplayName.length + 1)}`, now);
  addManorV7Activity(visitor, "farm", message, now);
  return finish(currentVisitor, currentOwner, visitor, owner, message, now);
}

function finish(
  currentVisitor: ManorV7State,
  currentOwner: ManorV7State,
  visitor: ManorV7State,
  owner: ManorV7State,
  message: string,
  now: number
): ManorV7FriendTransitionResult {
  visitor.revision = currentVisitor.revision + 1;
  owner.revision = currentOwner.revision + 1;
  visitor.updatedAt = now;
  owner.updatedAt = now;
  validateManorV7State(visitor);
  validateManorV7State(owner);
  return { visitor, owner, message };
}

function inventoryQuantity(inventory: readonly { sourceId: number; quantity: number }[], sourceId: number): number {
  return inventory.find((entry) => entry.sourceId === sourceId)?.quantity ?? 0;
}

function drawStealQuantity(value: number): number {
  if (value < 0.5) return 1;
  if (value < 0.7) return 2;
  if (value < 0.8) return 3;
  if (value < 0.95) return 4;
  return 5;
}
