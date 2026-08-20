import type {
  ManorFriendFarmActionRequest,
  ManorFriendPastureActionRequest,
  ManorPastureView
} from "@party-games/shared";
import {
  MANOR_CROPS,
  cloneManorFarm,
  drawManorRandom,
  finalizeManorFarmMutation,
  manorEstimatedYield,
  manorMinimumYield,
  recordManorTaskEvent,
  type ManorFarmState,
  type ManorPlotState,
  type ManorRuntimeOptions
} from "./farm.js";
import {
  MANOR_ANIMALS,
  MANOR_GRASS_CAPACITY,
  MANOR_GRASS_PRICE,
  advanceManorPasture,
  type ManorPastureAnimalState
} from "./pasture.js";
import {
  MANOR_FARM_PRANK_LIMIT,
  MANOR_PASTURE_MOSQUITO_LIMIT,
  MANOR_SPECIAL_FEED_LIMIT,
  appendManorActivity,
  manorDogById,
  refreshManorDailyState
} from "./legacy.js";

export interface ManorFriendMutationResult {
  visitor: ManorFarmState;
  owner: ManorFarmState;
  message: string;
}

export interface ManorVisitResult {
  visitor: ManorFarmState;
  changed: boolean;
}

export function applyManorFriendVisit(visitor: ManorFarmState, now: number): ManorVisitResult {
  const next = cloneManorFarm(visitor);
  if (!recordManorTaskEvent(next, "visit-friend")) return { visitor, changed: false };
  return { visitor: finalizeManorFarmMutation(next, now), changed: true };
}

export function applyManorFriendFarmAction(
  currentVisitor: ManorFarmState,
  currentOwner: ManorFarmState,
  visitorUserId: string,
  action: ManorFriendFarmActionRequest,
  now: number,
  options: ManorRuntimeOptions = {},
  actorDisplayName = "好友"
): ManorFriendMutationResult {
  const visitor = cloneManorFarm(currentVisitor);
  const owner = cloneManorFarm(currentOwner);
  visitor.daily = refreshManorDailyState(visitor.daily, now);
  owner.daily = refreshManorDailyState(owner.daily, now);
  const plot = friendPlot(owner, action.plotId);

  if (action.type === "steal-crop") {
    ensureMature(plot, now);
    if (plot.thiefUserIds?.includes(visitorUserId)) throw new Error("这一季作物已经偷过了");
    const remaining = manorEstimatedYield(plot, now, options.timeScale);
    const minimum = manorMinimumYield(plot, now, options.timeScale);
    const available = remaining - minimum;
    if (available <= 0) throw new Error("来晚了，作物已经达到最低保留产量");
    const cropId = plot.cropId;
    if (!cropId) throw new Error("这块土地还没有作物");
    if (owner.activeDogId && owner.dogFedUntil > now) {
      const dog = manorDogById(owner.activeDogId);
      if (drawManorRandom(owner) < dog.catchChance) {
        const penalty = Math.min(visitor.coins, dogPenalty(owner, cropId));
        visitor.coins -= penalty;
        owner.coins += penalty;
        plot.thiefUserIds = [...(plot.thiefUserIds ?? []), visitorUserId];
        owner.activities = appendManorActivity(
          owner.activities,
          "dog",
          actorDisplayName,
          `${actorDisplayName}偷${cropName(cropId)}时被${dog.name}发现，留下 ${penalty} 金币`,
          now
        );
        return finish(
          visitor,
          owner,
          now,
          `被${dog.name}发现，没有偷到作物，损失 ${penalty} 金币`
        );
      }
    }
    const quantity = Math.min(available, drawStealQuantity(drawManorRandom(owner)));
    plot.stolenYield = (plot.stolenYield ?? 0) + quantity;
    plot.thiefUserIds = [...(plot.thiefUserIds ?? []), visitorUserId];
    visitor.produce[cropId] += quantity;
    recordManorTaskEvent(visitor, "steal-friend");
    owner.activities = appendManorActivity(
      owner.activities,
      "steal",
      actorDisplayName,
      `${actorDisplayName}摘走了 ${quantity} 个${cropName(cropId)}`,
      now
    );
    return finish(visitor, owner, now, `偷到了 ${quantity} 个${cropName(cropId)}`);
  }

  if (action.type === "add-weed" || action.type === "add-pest") {
    ensureGrowing(plot);
    if (visitor.daily.farmPranksUsed >= MANOR_FARM_PRANK_LIMIT) {
      throw new Error("今天使坏的次数已经达到 50 次");
    }
    const weed = action.type === "add-weed";
    const currentLevel = weed
      ? isActive(plot.weedAt, plot.weedClearedAt, now) ? plot.weedLevel ?? 1 : 0
      : isActive(plot.pestAt, plot.pestClearedAt, now) ? plot.pestLevel ?? 1 : 0;
    if (currentLevel >= 3) throw new Error(weed ? "这块地的杂草已经够多了" : "这块地的害虫已经够多了");
    if (weed) {
      plot.weedAt = now;
      plot.weedLevel = currentLevel + 1;
      delete plot.weedClearedAt;
    } else {
      plot.pestAt = now;
      plot.pestLevel = currentLevel + 1;
      delete plot.pestClearedAt;
    }
    visitor.daily.farmPranksUsed += 1;
    owner.activities = appendManorActivity(
      owner.activities,
      "prank",
      actorDisplayName,
      `${actorDisplayName}给第 ${plot.id} 块地${weed ? "放了杂草" : "放了害虫"}`,
      now
    );
    return finish(visitor, owner, now, `${weed ? "放草" : "放虫"}成功，今天还能使坏 ${MANOR_FARM_PRANK_LIMIT - visitor.daily.farmPranksUsed} 次`);
  }

  ensureGrowing(plot);
  if (action.type === "water") {
    if (!isActive(plot.dryAt, plot.wateredAt, now)) throw new Error("这块作物当前不需要浇水");
    plot.wateredAt = now;
  } else if (action.type === "clear-weed") {
    if (!isActive(plot.weedAt, plot.weedClearedAt, now)) throw new Error("这块作物当前没有杂草");
    plot.weedClearedAt = now;
  } else {
    if (!isActive(plot.pestAt, plot.pestClearedAt, now)) throw new Error("这块作物当前没有害虫");
    plot.pestClearedAt = now;
  }
  visitor.coins += 2;
  visitor.experience += 2;
  recordManorTaskEvent(visitor, "help-friend");
  owner.activities = appendManorActivity(
    owner.activities,
    "care",
    actorDisplayName,
    `${actorDisplayName}帮忙${action.type === "water" ? "浇了水" : action.type === "clear-weed" ? "清除了杂草" : "消灭了害虫"}`,
    now
  );
  return finish(visitor, owner, now, "帮助好友照料成功，获得 2 金币和 2 经验");
}

export function applyManorFriendPastureAction(
  currentVisitor: ManorFarmState,
  currentOwner: ManorFarmState,
  visitorUserId: string,
  action: ManorFriendPastureActionRequest,
  now: number,
  options: ManorRuntimeOptions = {},
  actorDisplayName = "好友"
): ManorFriendMutationResult {
  const visitor = cloneManorFarm(currentVisitor);
  const owner = cloneManorFarm(currentOwner);
  visitor.daily = refreshManorDailyState(visitor.daily, now);
  owner.daily = refreshManorDailyState(owner.daily, now);
  visitor.pasture = advanceManorPasture(visitor.pasture, now, options);
  owner.pasture = advanceManorPasture(owner.pasture, now, options);

  if (action.type === "release-mosquito") {
    const remaining = MANOR_PASTURE_MOSQUITO_LIMIT - visitor.daily.pastureMosquitoesReleased;
    if (remaining <= 0) throw new Error("今天放蚊子的次数已经达到 25 次");
    const available = 8 - owner.pasture.mosquitoSources.length;
    if (available <= 0) throw new Error("好友牧场已经有 8 只蚊子");
    const quantity = Math.min(action.quantity, remaining, available);
    owner.pasture.mosquitoSources.push(...Array.from({ length: quantity }, () => visitorUserId));
    visitor.daily.pastureMosquitoesReleased += quantity;
    owner.pasture.activities = appendManorActivity(
      owner.pasture.activities,
      "prank",
      actorDisplayName,
      `${actorDisplayName}来牧场放了 ${quantity} 只蚊子`,
      now
    );
    return finish(visitor, owner, now, `放了 ${quantity} 只蚊子，今天还能放 ${MANOR_PASTURE_MOSQUITO_LIMIT - visitor.daily.pastureMosquitoesReleased} 只`);
  }

  if (action.type === "clean-mosquito") {
    const mosquitoIndex = owner.pasture.mosquitoSources.findIndex((source) => source !== visitorUserId);
    if (mosquitoIndex < 0) throw new Error("没有可以帮忙清理的蚊子");
    owner.pasture.mosquitoSources.splice(mosquitoIndex, 1);
    visitor.pasture.experience += 3;
    owner.pasture.activities = appendManorActivity(
      owner.pasture.activities,
      "pasture-clean",
      actorDisplayName,
      `${actorDisplayName}帮忙拍了 1 只蚊子`,
      now
    );
    return finish(visitor, owner, now, "拍掉 1 只蚊子，获得 3 点牧场经验");
  }

  if (action.type === "clean-poop") {
    if (owner.pasture.poopCount < 1) throw new Error("好友牧场当前没有便便");
    owner.pasture.poopCount -= 1;
    visitor.pasture.manure += 1;
    owner.pasture.activities = appendManorActivity(
      owner.pasture.activities,
      "pasture-clean",
      actorDisplayName,
      `${actorDisplayName}帮忙清扫了 1 个便便`,
      now
    );
    return finish(visitor, owner, now, "清扫了 1 个便便，已收入你的牧场仓库");
  }

  if (action.type === "feed-grass") {
    const available = Math.floor(MANOR_GRASS_CAPACITY - owner.pasture.grass + 1e-6);
    if (available <= 0) throw new Error("好友的饲料机已经加满");
    const quantity = Math.min(action.quantity, available);
    const cost = quantity * MANOR_GRASS_PRICE;
    if (visitor.coins < cost) throw new Error("金币不足");
    visitor.coins -= cost;
    visitor.pasture.experience += Math.floor(quantity / 10);
    owner.pasture.grass = roundGrass(owner.pasture.grass + quantity);
    recordManorTaskEvent(visitor, "help-friend");
    owner.pasture.activities = appendManorActivity(owner.pasture.activities, "pasture-help", actorDisplayName, `${actorDisplayName}添加了 ${quantity} 份牧草`, now);
    return finish(visitor, owner, now, `为好友添加了 ${quantity} 份牧草`);
  }

  const animal = friendAnimal(owner.pasture.animals, action.animalSerial);
  const definition = MANOR_ANIMALS.find((candidate) => candidate.sourceId === animal.sourceId);
  if (!definition) throw new Error("动物不存在");

  if (action.type === "feed-carrot") {
    if (visitor.produce.carrot < 1) throw new Error("农场仓库没有胡萝卜");
    if (owner.daily.specialFeedsReceived >= MANOR_SPECIAL_FEED_LIMIT) {
      throw new Error("当前牧场今天已经喂满 30 个胡萝卜");
    }
    if (animal.growthSeconds >= definition.lifecycleSeconds) throw new Error("动物生命周期已经结束");
    visitor.produce.carrot -= 1;
    animal.growthSeconds = Math.min(definition.lifecycleSeconds, animal.growthSeconds + 300);
    owner.daily.specialFeedsReceived += 1;
    owner.pasture.activities = appendManorActivity(owner.pasture.activities, "pasture-help", actorDisplayName, `${actorDisplayName}给${definition.name}喂了 1 个胡萝卜`, now);
    return finish(visitor, owner, now, `给${definition.name}喂了胡萝卜，成长时间缩短 5 分钟`);
  }

  if (action.type === "help-production") {
    if (animal.growthSeconds < definition.maturitySeconds) throw new Error("动物还未成熟");
    if (animal.growthSeconds >= definition.lifecycleSeconds) throw new Error("动物生命周期已经结束");
    if (
      animal.productionStartedAtGrowth !== undefined &&
      animal.growthSeconds < animal.productionStartedAtGrowth + definition.productionCycleSeconds
    ) {
      throw new Error("还未到下一次生产时间");
    }
    animal.productionStartedAtGrowth = animal.growthSeconds;
    animal.pendingProduct += definition.baseYield;
    animal.productThiefUserIds = [];
    animal.stolenProduct = 0;
    visitor.pasture.experience += 2;
    recordManorTaskEvent(visitor, "help-friend");
    owner.pasture.activities = appendManorActivity(owner.pasture.activities, "pasture-help", actorDisplayName, `${actorDisplayName}帮助${definition.name}${definition.productionAction}`, now);
    return finish(visitor, owner, now, `帮助${definition.name}${definition.productionAction}成功`);
  }

  if (animal.productThiefUserIds.includes(visitorUserId)) {
    throw new Error("这一轮副产品已经偷过了");
  }
  if (animal.pendingProduct <= definition.baseYield / 2) {
    throw new Error("来晚了，副产品已经达到最低保留数量");
  }
  animal.pendingProduct -= 1;
  animal.stolenProduct += 1;
  animal.productThiefUserIds.push(visitorUserId);
  visitor.pasture.byproducts[definition.sourceId] =
    (visitor.pasture.byproducts[definition.sourceId] ?? 0) + 1;
  recordManorTaskEvent(visitor, "steal-friend");
  owner.pasture.activities = appendManorActivity(owner.pasture.activities, "pasture-steal", actorDisplayName, `${actorDisplayName}偷走了 1 ${definition.byproductUnit}${definition.byproductName}`, now);
  return finish(visitor, owner, now, `偷到了 1 ${definition.byproductUnit}${definition.byproductName}`);
}

export function canStealPastureProduct(animal: ManorPastureView["animals"][number]): boolean {
  return animal.pendingProduct > animal.minimumProduct;
}

function finish(
  visitor: ManorFarmState,
  owner: ManorFarmState,
  now: number,
  message: string
): ManorFriendMutationResult {
  return {
    visitor: finalizeManorFarmMutation(visitor, now),
    owner: finalizeManorFarmMutation(owner, now),
    message
  };
}

function friendPlot(farm: ManorFarmState, plotId: number): ManorPlotState {
  const plot = farm.plots.find((candidate) => candidate.id === plotId);
  if (!plot || plot.id > farm.unlockedPlotCount) throw new Error("土地不存在或尚未开垦");
  return plot;
}

function ensureGrowing(plot: ManorPlotState): void {
  if (!plot.cropId) throw new Error("这块土地还没有作物");
  if (plot.witheredAt) throw new Error("作物已经枯萎");
}

function ensureMature(plot: ManorPlotState, now: number): void {
  ensureGrowing(plot);
  if (!plot.readyAt || plot.readyAt > now) throw new Error("作物还未成熟");
}

function isActive(eventAt: number | undefined, clearedAt: number | undefined, now: number): boolean {
  return eventAt !== undefined && eventAt <= now && clearedAt === undefined;
}

function drawStealQuantity(random: number): number {
  if (random < 0.5) return 1;
  if (random < 0.7) return 2;
  if (random < 0.8) return 3;
  if (random < 0.95) return 4;
  return 5;
}

function cropName(cropId: string): string {
  return MANOR_CROPS.find((crop) => crop.id === cropId)?.name ?? "果实";
}

function dogPenalty(owner: ManorFarmState, cropId: string): number {
  const salePrice = MANOR_CROPS.find((crop) => crop.id === cropId)?.salePrice ?? 0;
  const branch = drawManorRandom(owner);
  if (branch > 0.8) {
    return salePrice + 4 * (Math.floor(drawManorRandom(owner) * 20) + 1);
  }
  const base = 2 * (Math.floor(drawManorRandom(owner) * 10) + 1);
  const multiplier = Math.floor(drawManorRandom(owner) * 2) + 1;
  return salePrice + base * multiplier;
}

function friendAnimal(
  animals: ManorPastureAnimalState[],
  serial: number
): ManorPastureAnimalState {
  const animal = animals.find((candidate) => candidate.serial === serial);
  if (!animal) throw new Error("动物不存在");
  return animal;
}

function roundGrass(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
