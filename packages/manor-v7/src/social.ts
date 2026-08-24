import { manorV7Animal, manorV7Crop, manorV7Fish, manorV7ToolByType } from "./catalog.js";
import {
  addManorV7Activity,
  advanceManorV7State,
  drawManorV7Random,
  MANOR_V7_GRASS_CAPACITY,
  MANOR_V7_GRASS_PRICE,
  manorV7EffectiveYield,
  setInventoryQuantity,
  validateManorV7State,
  type ManorV7RuntimeOptions
} from "./state.js";
import { manorV7Flower } from "./flowers.js";
import type {
  ManorV7FriendAction,
  ManorV7FriendTransitionResult,
  ManorV7State
} from "./types.js";
import {
  attackIncomingWildAnimal,
  manorV7FishStage,
  manorV7SpecialFeedCropId,
  startManorV7Production
} from "./actions.js";
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

  if (owner.friendFilterUserIds.includes(visitorUserId)) throw new Error("对方暂未允许你进入庄园");

  if (action.type === "send-flower") {
    const flower = manorV7Flower(action.flowerId);
    for (const requirement of flower.requirements) {
      if (inventoryQuantity(visitor.farm.produceInventory, requirement.cropId) < requirement.quantity) {
        throw new Error("包装花束所需鲜花不足");
      }
    }
    for (const requirement of flower.requirements) {
      setInventoryQuantity(
        visitor.farm.produceInventory,
        requirement.cropId,
        inventoryQuantity(visitor.farm.produceInventory, requirement.cropId) - requirement.quantity
      );
    }
    owner.receivedFlowers.push({
      id: owner.nextFlowerGiftId,
      flowerId: flower.id,
      fromUserId: visitorUserId,
      fromDisplayName: visitorDisplayName,
      message: action.message,
      sentAt: now
    });
    owner.nextFlowerGiftId += 1;
    owner.receivedFlowers = owner.receivedFlowers.slice(-200);
    message = `向${ownerDisplayName}赠送了${flower.name}`;
    addManorV7Activity(visitor, "farm", message, now);
    addManorV7Activity(owner, "farm", `${visitorDisplayName}送来了${flower.name}`, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

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
    const guard = owner.pasture.guards.find((item) => item.active && item.remainingSeconds > 0);
    if (guard && drawManorV7Random(owner) < 0.3) {
      const penalty = Math.min(visitor.coins, 40 + Math.floor(drawManorV7Random(owner) * 41));
      visitor.coins -= penalty;
      owner.coins += penalty;
      animalState.productThiefUserIds.push(visitorUserId);
      message = `被看守员发现，损失 ${penalty} 金币`;
      addManorV7Activity(owner, "pasture", `看守员阻止了${visitorDisplayName}偷取副产品`, now);
      addManorV7Activity(visitor, "pasture", message, now);
      return finish(currentVisitor, currentOwner, visitor, owner, message, now);
    }
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

  if (action.type === "steal-fish") {
    const fishState = owner.farm.fishPool.fish.find((item) => item.serial === action.serial);
    if (!fishState) throw new Error("鱼不存在");
    const fish = manorV7Fish(fishState.fishId);
    const maturity = fish.cycleSeconds.at(-1) ?? fish.matureHours * 3_600;
    if (fishState.growthSeconds < maturity) throw new Error("鱼还没有成熟");
    if (fishState.thiefUserIds.includes(visitorUserId)) throw new Error("这条鱼已经偷过了");
    const available = fish.baseYield - fishState.stolen - Math.ceil(fish.baseYield / 2);
    if (available < 1) throw new Error("成鱼已经达到最低保留数量");
    const quantity = Math.min(available, drawManorV7Random(owner) < 0.5 ? 1 : 2);
    fishState.stolen += quantity;
    fishState.thiefUserIds.push(visitorUserId);
    setInventoryQuantity(
      visitor.farm.fishPool.produceInventory,
      fish.id,
      inventoryQuantity(visitor.farm.fishPool.produceInventory, fish.id) + quantity
    );
    message = `偷到了 ${quantity} 条${fish.name}`;
    addManorV7Activity(owner, "farm", `${visitorDisplayName}捞走了 ${quantity} 条${fish.name}`, now);
    addManorV7Activity(visitor, "farm", message, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "fertilize-fish") {
    const fishState = owner.farm.fishPool.fish.find((item) => item.serial === action.serial);
    if (!fishState) throw new Error("鱼不存在");
    const tool = manorV7ToolByType("farm", action.toolId ?? 1, 24);
    const available = inventoryQuantity(visitor.farm.fishPool.toolInventory, tool.id);
    if (available < 1) throw new Error("鱼食库存不足");
    setInventoryQuantity(visitor.farm.fishPool.toolInventory, tool.id, available - 1);
    const fish = manorV7Fish(fishState.fishId);
    const maturity = fish.cycleSeconds.at(-1) ?? fish.matureHours * 3_600;
    const stage = manorV7FishStage(fish.id, fishState.growthSeconds);
    if (stage >= fish.cycleSeconds.length) throw new Error("鱼已经成熟，不需要再喂食");
    if (fishState.fedStage === stage + 1) throw new Error("当前生长阶段已经使用过鱼食");
    fishState.growthSeconds = Math.min(maturity, fishState.growthSeconds + tool.effectSeconds);
    fishState.fedStage = stage + 1;
    message = `帮${ownerDisplayName}喂了鱼`;
    addManorV7Activity(owner, "farm", `${visitorDisplayName}帮忙喂了鱼`, now);
    addManorV7Activity(visitor, "farm", message, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "special-feed") {
    if (owner.pasture.specialFeed.remaining < 1) throw new Error("好友今天的特殊喂养次数已经用完");
    const animalState = owner.pasture.animals.find((item) => item.serial === action.serial);
    if (!animalState) throw new Error("动物不存在");
    const cropId = manorV7SpecialFeedCropId(animalState.animalId);
    const available = inventoryQuantity(visitor.farm.produceInventory, cropId);
    if (available < 1) throw new Error("特殊作物库存不足");
    setInventoryQuantity(visitor.farm.produceInventory, cropId, available - 1);
    animalState.growthSeconds = Math.min(
      manorV7Animal(animalState.animalId).lifecycleSeconds,
      animalState.growthSeconds + 300
    );
    owner.pasture.specialFeed.remaining -= 1;
    message = `给${ownerDisplayName}的${manorV7Animal(animalState.animalId).name}喂了特殊作物`;
    addManorV7Activity(
      owner,
      "pasture",
      `${visitorDisplayName}给你的${manorV7Animal(animalState.animalId).name}喂了特殊作物`,
      now
    );
    addManorV7Activity(visitor, "pasture", message, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "clean-manure") {
    if (owner.pasture.manure < 1) throw new Error("好友牧场没有可清理的便便");
    const quantity = Math.min(action.quantity, owner.pasture.manure);
    const rewarded = Math.min(quantity, visitor.farm.manureCollection.remaining);
    owner.pasture.manure -= quantity;
    if (rewarded > 0) {
      visitor.farm.manureCollection.remaining -= rewarded;
      setInventoryQuantity(
        visitor.pasture.materialInventory,
        1506,
        inventoryQuantity(visitor.pasture.materialInventory, 1506) + rewarded
      );
      visitor.pastureExperience += rewarded;
    }
    message = rewarded > 0
      ? `帮${ownerDisplayName}清理了 ${quantity} 份便便，获得 ${rewarded} 份便便`
      : `帮${ownerDisplayName}清理了 ${quantity} 份便便，今日收集数量已达上限`;
    addManorV7Activity(owner, "pasture", `${visitorDisplayName}帮忙清理了 ${quantity} 份便便`, now);
    addManorV7Activity(visitor, "pasture", message, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "buy-grass-for-friend") {
    const available = Math.floor(MANOR_V7_GRASS_CAPACITY - owner.pasture.grass + 1e-6);
    if (available < 1) throw new Error("好友的饲料机已经加满");
    const quantity = Math.min(action.quantity, available);
    const cost = quantity * MANOR_V7_GRASS_PRICE;
    if (visitor.coins < cost) throw new Error("金币不足");
    visitor.coins -= cost;
    visitor.pastureExperience += Math.floor(quantity / 10);
    owner.pasture.grass = Math.round((owner.pasture.grass + quantity) * 1_000_000) / 1_000_000;
    message = `为${ownerDisplayName}购买了 ${quantity} 棵牧草`;
    addManorV7Activity(owner, "pasture", `${visitorDisplayName}为你购买了 ${quantity} 棵牧草`, now);
    addManorV7Activity(visitor, "pasture", message, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "add-mosquito") {
    if (owner.pasture.mosquitoes.sourceUserIds.includes(visitorUserId)) throw new Error("已经放过蚊子了");
    if (visitor.pasture.mosquitoActions.remaining < action.quantity) {
      throw new Error(`今天最多还能放 ${visitor.pasture.mosquitoActions.remaining} 只蚊子`);
    }
    visitor.pasture.mosquitoActions.remaining -= action.quantity;
    owner.pasture.mosquitoes.sourceUserIds.push(...Array.from({ length: action.quantity }, () => visitorUserId));
    message = `在${ownerDisplayName}的牧场放了 ${action.quantity} 只蚊子`;
    addManorV7Activity(owner, "pasture", `${visitorDisplayName}在牧场放了 ${action.quantity} 只蚊子`, now);
    addManorV7Activity(visitor, "pasture", message, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "remove-mosquito") {
    if (!owner.pasture.mosquitoes.sourceUserIds.length) throw new Error("牧场没有蚊子");
    owner.pasture.mosquitoes.sourceUserIds.shift();
    visitor.pastureExperience += 3;
    message = `帮${ownerDisplayName}拍掉了蚊子`;
    addManorV7Activity(owner, "pasture", `${visitorDisplayName}帮忙拍掉了蚊子`, now);
    addManorV7Activity(visitor, "pasture", message, now);
    return finish(currentVisitor, currentOwner, visitor, owner, message, now);
  }

  if (action.type === "catch-mouse") {
    if (!owner.pasture.mousePresent) throw new Error("牧场没有老鼠");
    owner.pasture.mousePresent = false;
    const reward = 50 + Math.floor(drawManorV7Random(owner) * 51);
    visitor.coins += reward;
    message = `抓到老鼠，获得 ${reward} 金币`;
    addManorV7Activity(owner, "pasture", `${visitorDisplayName}帮忙抓走了老鼠`, now);
    addManorV7Activity(visitor, "pasture", message, now);
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
    if (owner.farm.dog.activeId !== null && owner.farm.dog.feedSeconds > 0) {
      const caughtChance = owner.farm.dog.activeId > 1 ? 0.4 : 0.2;
      if (drawManorV7Random(owner) < caughtChance) {
        const penalty = Math.min(visitor.coins, 40 + Math.floor(drawManorV7Random(owner) * 41));
        visitor.coins -= penalty;
        owner.coins += penalty;
        land.thiefUserIds.push(visitorUserId);
        message = `被看门动物发现，损失 ${penalty} 金币`;
        addManorV7Activity(owner, "farm", `看门动物阻止了${visitorDisplayName}摘取果实`, now);
        addManorV7Activity(visitor, "farm", message, now);
        return finish(currentVisitor, currentOwner, visitor, owner, message, now);
      }
    }
    const output = manorV7EffectiveYield(land);
    const minimum = Math.floor(output * 0.6);
    const available = output - land.stolen - minimum;
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

  if (action.type === "add-weeds" || action.type === "add-pests") {
    if (visitor.farm.badActions.remaining < 1) throw new Error("今天的使坏次数已经用完");
    if (action.type === "add-weeds") {
      if (land.weeds) throw new Error("这块土地已经有杂草");
      land.weeds = true;
      message = `给${ownerDisplayName}的土地放了杂草`;
    } else {
      if (land.pests) throw new Error("这块土地已经有害虫");
      land.pests = true;
      message = `给${ownerDisplayName}的土地放了害虫`;
    }
    visitor.farm.badActions.remaining -= 1;
  } else if (action.type === "water") {
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
