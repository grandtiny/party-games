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
  options: ManorRuntimeOptions = {}
): ManorFriendMutationResult {
  const visitor = cloneManorFarm(currentVisitor);
  const owner = cloneManorFarm(currentOwner);
  const plot = friendPlot(owner, action.plotId);

  if (action.type === "steal-crop") {
    ensureMature(plot, now);
    if (plot.thiefUserIds?.includes(visitorUserId)) throw new Error("这一季作物已经偷过了");
    const remaining = manorEstimatedYield(plot, now, options.timeScale);
    const minimum = manorMinimumYield(plot, now, options.timeScale);
    const available = remaining - minimum;
    if (available <= 0) throw new Error("来晚了，作物已经达到最低保留产量");
    const quantity = Math.min(available, drawStealQuantity(drawManorRandom(owner)));
    const cropId = plot.cropId;
    if (!cropId) throw new Error("这块土地还没有作物");
    plot.stolenYield = (plot.stolenYield ?? 0) + quantity;
    plot.thiefUserIds = [...(plot.thiefUserIds ?? []), visitorUserId];
    visitor.produce[cropId] += quantity;
    recordManorTaskEvent(visitor, "steal-friend");
    return finish(visitor, owner, now, `偷到了 ${quantity} 个${cropName(cropId)}`);
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
  return finish(visitor, owner, now, "帮助好友照料成功，获得 2 金币和 2 经验");
}

export function applyManorFriendPastureAction(
  currentVisitor: ManorFarmState,
  currentOwner: ManorFarmState,
  visitorUserId: string,
  action: ManorFriendPastureActionRequest,
  now: number,
  options: ManorRuntimeOptions = {}
): ManorFriendMutationResult {
  const visitor = cloneManorFarm(currentVisitor);
  const owner = cloneManorFarm(currentOwner);
  visitor.pasture = advanceManorPasture(visitor.pasture, now, options);
  owner.pasture = advanceManorPasture(owner.pasture, now, options);

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
    return finish(visitor, owner, now, `为好友添加了 ${quantity} 份牧草`);
  }

  const animal = friendAnimal(owner.pasture.animals, action.animalSerial);
  const definition = MANOR_ANIMALS.find((candidate) => candidate.sourceId === animal.sourceId);
  if (!definition) throw new Error("动物不存在");

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
