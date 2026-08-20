import type {
  ManorActionRequest,
  ManorCropId,
  ManorCropView,
  ManorDecorationType,
  ManorDecorationView,
  ManorDogId,
  ManorFarmView,
  ManorFertilizerId,
  ManorFlowerCatalogView,
  ManorFlowerId,
  ManorPlotView,
  ManorRewardItemView
} from "@party-games/shared";
import { MANOR_CROP_DATA } from "./crops.generated.js";
import { MANOR_DECORATIONS, manorDecorationById } from "./decorations.js";
import {
  createManorPasture,
  migrateManorPasture,
  validateManorPasture,
  type ManorPastureState
} from "./pasture.js";
import {
  MANOR_FERTILIZERS,
  MANOR_LEVEL_REWARDS,
  MANOR_STARTER_GIFT,
  manorFertilizerById,
  manorLevelReward,
  type ManorRewardItemDefinition
} from "./rewards.js";
import {
  MANOR_DOGS,
  MANOR_DOG_FOOD_OPTIONS,
  MANOR_FARM_PRANK_LIMIT,
  MANOR_PASTURE_MOSQUITO_LIMIT,
  MANOR_SPECIAL_FEED_LIMIT,
  cloneManorActivities,
  createManorDailyState,
  manorDogById,
  manorWeatherAt,
  refreshManorDailyState,
  validateManorActivities,
  validateManorDailyState,
  type ManorActivityState,
  type ManorDailyState
} from "./legacy.js";
import { MANOR_FLOWERS, manorFlowerById } from "./flowers.js";
import {
  appendManorBusinessTransactions,
  cloneManorBusinessRecords,
  toManorBusinessRecordViews,
  validateManorBusinessRecords,
  type ManorBusinessRecordState,
  type ManorBusinessTransaction
} from "./business.js";

export interface ManorCropDefinition {
  id: ManorCropId;
  sourceId: number;
  name: string;
  emoji: string;
  levelRequired: number;
  seedPrice: number;
  salePrice: number;
  growthSeconds: number;
  regrowthSeconds: number;
  growthStageSeconds: readonly number[];
  baseYield: number;
  experience: number;
  harvestCycles: number;
  purchasable: boolean;
}

export const MANOR_CROPS: readonly ManorCropDefinition[] = MANOR_CROP_DATA;

export interface ManorPlotState {
  id: number;
  cycle: number;
  cropId?: ManorCropId;
  harvestedCycles?: number;
  plantedAt?: number;
  readyAt?: number;
  witheredAt?: number;
  dryAt?: number;
  wateredAt?: number;
  weedAt?: number;
  weedLevel?: number;
  weedClearedAt?: number;
  pestAt?: number;
  pestLevel?: number;
  pestClearedAt?: number;
  fertilizedStage?: number;
  stolenYield?: number;
  thiefUserIds?: string[];
}

export type ManorTaskEvent =
  | "plant"
  | "fertilize"
  | "water"
  | "clear-weed"
  | "clear-pest"
  | "harvest"
  | "clear-plot"
  | "buy-seeds"
  | "sell"
  | "visit-friend"
  | "help-friend"
  | "steal-friend";

export interface ManorTaskDefinition {
  id: number;
  event: ManorTaskEvent;
  name: string;
  description: string;
  rewardCoins: number;
  rewardExperience: number;
}

export interface ManorDecorationPurchaseState {
  sourceId: number;
  validUntil: number;
}

export interface ManorReceivedFlowerState {
  id: number;
  flowerId: ManorFlowerId;
  senderUserId: string;
  senderDisplayName: string;
  message: string;
  createdAt: number;
}

export interface ManorFarmState {
  schemaVersion: 12;
  revision: number;
  coins: number;
  experience: number;
  randomState: number;
  fertilizers: Record<ManorFertilizerId, number>;
  starterGiftClaimed: boolean;
  rewardedThroughOriginalLevel: number;
  pendingLevelRewardLevels: number[];
  decorationEntitlements: number[];
  decorationPurchases: ManorDecorationPurchaseState[];
  activeDecorationIds: number[];
  ownedDogIds: ManorDogId[];
  activeDogId?: ManorDogId;
  dogFedUntil: number;
  daily: ManorDailyState;
  activities: ManorActivityState[];
  businessRecords: ManorBusinessRecordState[];
  nextBusinessRecordId: number;
  receivedFlowers: ManorReceivedFlowerState[];
  nextReceivedFlowerId: number;
  nextTaskId: number;
  unlockedPlotCount: number;
  seeds: Record<ManorCropId, number>;
  produce: Record<ManorCropId, number>;
  plots: ManorPlotState[];
  pasture: ManorPastureState;
  createdAt: number;
  updatedAt: number;
}

export interface ManorRuntimeOptions {
  timeScale?: number;
  legacyBackgroundUrl?: string;
  includeBusinessRecords?: boolean;
}

export const MANOR_PLOT_COUNT = 18;
export const MANOR_INITIAL_PLOT_COUNT = 6;
export const MANOR_MAX_LEVEL_REWARD = MANOR_LEVEL_REWARDS.length;
export const MANOR_FACTORY_RECIPE = { manure: 5, redRoses: 5, coins: 1_000 } as const;

export const MANOR_TASKS: readonly ManorTaskDefinition[] = [
  { id: 0, event: "plant", name: "播下种子", description: "在任意空地种下一颗种子", rewardCoins: 0, rewardExperience: 100 },
  { id: 1, event: "fertilize", name: "使用化肥", description: "给生长中的作物施一次肥", rewardCoins: 50, rewardExperience: 100 },
  { id: 2, event: "water", name: "照料作物", description: "给缺水的作物浇一次水", rewardCoins: 100, rewardExperience: 100 },
  { id: 3, event: "clear-weed", name: "清除杂草", description: "为作物清除一次杂草", rewardCoins: 150, rewardExperience: 100 },
  { id: 4, event: "clear-pest", name: "消灭害虫", description: "为作物清除一次害虫", rewardCoins: 200, rewardExperience: 100 },
  { id: 5, event: "harvest", name: "收获果实", description: "收获一块成熟作物", rewardCoins: 250, rewardExperience: 100 },
  { id: 6, event: "clear-plot", name: "清理土地", description: "清理一块已经枯萎的作物", rewardCoins: 300, rewardExperience: 100 },
  { id: 7, event: "buy-seeds", name: "购买种子", description: "在商店购买任意种子", rewardCoins: 350, rewardExperience: 100 },
  { id: 8, event: "sell", name: "出售果实", description: "从仓库出售任意果实", rewardCoins: 400, rewardExperience: 100 },
  { id: 9, event: "visit-friend", name: "拜访好友", description: "进入一位好友的农场", rewardCoins: 450, rewardExperience: 100 },
  { id: 10, event: "help-friend", name: "帮助好友", description: "为好友完成一次农场或牧场照料", rewardCoins: 500, rewardExperience: 100 },
  { id: 11, event: "steal-friend", name: "顺手牵羊", description: "从好友农场或牧场取得一份产物", rewardCoins: 550, rewardExperience: 100 }
];

export interface ManorLandUnlockRequirement {
  plotId: number;
  levelRequired: number;
  coinCost: number;
}

export const MANOR_LAND_UNLOCKS: readonly ManorLandUnlockRequirement[] = [
  { plotId: 7, levelRequired: 5, coinCost: 10_000 },
  { plotId: 8, levelRequired: 7, coinCost: 20_000 },
  { plotId: 9, levelRequired: 9, coinCost: 30_000 },
  { plotId: 10, levelRequired: 11, coinCost: 50_000 },
  { plotId: 11, levelRequired: 13, coinCost: 70_000 },
  { plotId: 12, levelRequired: 15, coinCost: 90_000 },
  { plotId: 13, levelRequired: 17, coinCost: 120_000 },
  { plotId: 14, levelRequired: 19, coinCost: 150_000 },
  { plotId: 15, levelRequired: 21, coinCost: 180_000 },
  { plotId: 16, levelRequired: 23, coinCost: 230_000 },
  { plotId: 17, levelRequired: 25, coinCost: 300_000 },
  { plotId: 18, levelRequired: 27, coinCost: 500_000 }
];

type PersistedManorFarm = Omit<Partial<ManorFarmState>, "schemaVersion"> & {
  schemaVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  fertilizer?: unknown;
};

export function createManorFarm(
  now: number,
  seedSource: string,
  options: { enableStarterTasks?: boolean } = {}
): ManorFarmState {
  const state: ManorFarmState = {
    schemaVersion: 12,
    revision: 0,
    coins: 120,
    experience: 0,
    randomState: hashSeed(seedSource),
    fertilizers: fertilizerRecord(),
    starterGiftClaimed: false,
    rewardedThroughOriginalLevel: 0,
    pendingLevelRewardLevels: [],
    decorationEntitlements: [],
    decorationPurchases: [],
    activeDecorationIds: [],
    ownedDogIds: [],
    dogFedUntil: 0,
    daily: createManorDailyState(now),
    activities: [],
    businessRecords: [],
    nextBusinessRecordId: 1,
    receivedFlowers: [],
    nextReceivedFlowerId: 1,
    nextTaskId: options.enableStarterTasks ? 0 : MANOR_TASKS.length,
    unlockedPlotCount: MANOR_INITIAL_PLOT_COUNT,
    seeds: cropRecord({ radish: 3 }),
    produce: cropRecord(),
    plots: createEmptyPlots(),
    pasture: createManorPasture(now),
    createdAt: now,
    updatedAt: now
  };
  validateManorFarm(state);
  return state;
}

export function migrateManorFarm(value: unknown, fallbackNow?: number): ManorFarmState {
  if (!value || typeof value !== "object") throw new Error("庄园存档格式无效");
  const candidate = value as PersistedManorFarm;
  if (
    candidate.schemaVersion !== 1 &&
    candidate.schemaVersion !== 2 &&
    candidate.schemaVersion !== 3 &&
    candidate.schemaVersion !== 4 &&
    candidate.schemaVersion !== 5 &&
    candidate.schemaVersion !== 6 &&
    candidate.schemaVersion !== 7 &&
    candidate.schemaVersion !== 8 &&
    candidate.schemaVersion !== 9 &&
    candidate.schemaVersion !== 10 &&
    candidate.schemaVersion !== 11 &&
    candidate.schemaVersion !== 12
  ) {
    throw new Error("庄园存档版本不受支持");
  }
  const migratedPlots = Array.isArray(candidate.plots)
    ? candidate.plots.map((plot) => migratePlot(plot, candidate.schemaVersion ?? 1))
    : [];
  const plots = candidate.schemaVersion === 1
    ? migrateSixPlotFarm(migratedPlots)
    : migratedPlots;
  const createdAt = timestamp(candidate.createdAt, "创建时间");
  const updatedAt = timestamp(candidate.updatedAt, "更新时间");
  const state: ManorFarmState = {
    schemaVersion: 12,
    revision: integer(candidate.revision, "存档修订号"),
    coins: integer(candidate.coins, "金币"),
    experience: integer(candidate.experience, "经验"),
    randomState: integer(candidate.randomState, "随机状态") >>> 0,
    fertilizers: candidate.schemaVersion >= 6
      ? migrateFertilizers(candidate.fertilizers)
      : fertilizerRecord({ ordinary: integer(candidate.fertilizer ?? 0, "普通化肥库存") }),
    starterGiftClaimed: candidate.schemaVersion >= 6
      ? boolean(candidate.starterGiftClaimed, "新手礼包状态")
      : true,
    rewardedThroughOriginalLevel: candidate.schemaVersion >= 6
      ? integer(candidate.rewardedThroughOriginalLevel, "升级奖励进度")
      : originalLevelForExperience(integer(candidate.experience, "经验")),
    pendingLevelRewardLevels: candidate.schemaVersion >= 6
      ? integerArray(candidate.pendingLevelRewardLevels, "待确认升级奖励")
      : [],
    decorationEntitlements: candidate.schemaVersion >= 6
      ? integerArray(candidate.decorationEntitlements, "装扮权益")
      : [],
    decorationPurchases: candidate.schemaVersion >= 8
      ? migrateDecorationPurchases(candidate.decorationPurchases)
      : [],
    activeDecorationIds: candidate.schemaVersion >= 8
      ? integerArray(candidate.activeDecorationIds, "已启用装扮")
      : [],
    ownedDogIds: candidate.schemaVersion >= 10
      ? dogIdArray(candidate.ownedDogIds)
      : [],
    ...(candidate.schemaVersion >= 10 && candidate.activeDogId !== undefined
      ? { activeDogId: dogId(candidate.activeDogId) }
      : {}),
    dogFedUntil: candidate.schemaVersion >= 10
      ? timestamp(candidate.dogFedUntil, "狗粮有效期")
      : 0,
    daily: candidate.schemaVersion >= 10
      ? migrateDailyState(candidate.daily, fallbackNow ?? updatedAt)
      : createManorDailyState(fallbackNow ?? updatedAt),
    activities: candidate.schemaVersion >= 10
      ? migrateActivities(candidate.activities)
      : [],
    businessRecords: candidate.schemaVersion >= 12
      ? migrateBusinessRecords(candidate.businessRecords)
      : [],
    nextBusinessRecordId: candidate.schemaVersion >= 12
      ? integer(candidate.nextBusinessRecordId, "下一经营流水编号")
      : 1,
    receivedFlowers: candidate.schemaVersion >= 11
      ? migrateReceivedFlowers(candidate.receivedFlowers)
      : [],
    nextReceivedFlowerId: candidate.schemaVersion >= 11
      ? integer(candidate.nextReceivedFlowerId, "下一花束编号")
      : 1,
    nextTaskId: candidate.schemaVersion >= 9
      ? integer(candidate.nextTaskId, "新手任务进度")
      : MANOR_TASKS.length,
    unlockedPlotCount: candidate.schemaVersion >= 5
      ? integer(candidate.unlockedPlotCount, "已开垦土地数量")
      : MANOR_PLOT_COUNT,
    seeds: migrateInventory(candidate.seeds, "种子"),
    produce: migrateInventory(candidate.produce, "仓库"),
    plots,
    pasture: migrateManorPasture(
      candidate.schemaVersion >= 7 ? candidate.pasture : undefined,
      fallbackNow ?? updatedAt
    ),
    createdAt,
    updatedAt
  };
  validateManorFarm(state);
  return state;
}

export function applyManorAction(
  current: ManorFarmState,
  action: ManorActionRequest,
  now: number,
  options: ManorRuntimeOptions = {}
): ManorFarmState {
  validateManorFarm(current);
  const state = cloneState(current);
  state.daily = refreshManorDailyState(state.daily, now);
  const crop = "cropId" in action ? cropById(action.cropId) : undefined;
  const plot = "plotId" in action ? plotById(state, action.plotId) : undefined;
  const level = levelForExperience(state.experience);
  const businessTransactions: ManorBusinessTransaction[] = [];
  if (plot && action.type !== "reclaim-plot") ensurePlotUnlocked(state, plot);

  switch (action.type) {
    case "buy-seeds": {
      if (!crop) throw new Error("作物不存在");
      if (!crop.purchasable) throw new Error("特殊种子无法在商店购买");
      if (level < crop.levelRequired) throw new Error(`达到 ${crop.levelRequired} 级后解锁`);
      const cost = crop.seedPrice * action.quantity;
      if (state.coins < cost) throw new Error("金币不足");
      state.coins -= cost;
      state.seeds[crop.id] += action.quantity;
      businessTransactions.push({ kind: "purchase", area: "farm", itemName: `${crop.name}种子`, quantity: action.quantity, unitPrice: crop.seedPrice });
      break;
    }
    case "plant": {
      if (!crop || !plot) throw new Error("土地或作物不存在");
      if (plot.cropId) throw new Error("这块土地已有作物");
      if (state.seeds[crop.id] < 1) throw new Error("种子不足");
      state.seeds[crop.id] -= 1;
      plot.cropId = crop.id;
      plot.harvestedCycles = 0;
      plot.cycle += 1;
      state.experience += 2;
      startGrowthCycle(state, plot, now, crop.growthSeconds, options.timeScale);
      break;
    }
    case "water": {
      ensureGrowing(plot);
      if (!isCareEventActive(plot.dryAt, plot.wateredAt, now)) throw new Error("当前不需要浇水");
      plot.wateredAt = now;
      rewardCareAction(state);
      break;
    }
    case "clear-weed": {
      ensureGrowing(plot);
      if (!plot.weedAt || plot.weedAt > now) throw new Error("当前没有杂草");
      if (plot.weedClearedAt) throw new Error("杂草已经清除");
      plot.weedClearedAt = now;
      rewardCareAction(state);
      break;
    }
    case "clear-pest": {
      ensureGrowing(plot);
      if (!plot.pestAt || plot.pestAt > now) throw new Error("当前没有害虫");
      if (plot.pestClearedAt) throw new Error("害虫已经清除");
      plot.pestClearedAt = now;
      rewardCareAction(state);
      break;
    }
    case "fertilize": {
      ensureGrowing(plot);
      if (!plot.readyAt || plot.readyAt <= now) throw new Error("成熟作物不需要施肥");
      const fertilizer = manorFertilizerById(action.fertilizerId);
      if (state.fertilizers[fertilizer.id] < 1) throw new Error(`${fertilizer.name}不足`);
      applyFertilizer(plot, cropById(plot.cropId), now, fertilizer.effectSeconds, options.timeScale);
      state.fertilizers[fertilizer.id] -= 1;
      break;
    }
    case "harvest": {
      ensurePlanted(plot);
      if (plot.witheredAt) throw new Error("作物已经枯萎，请用锄头清理");
      if (!plot.readyAt || plot.readyAt > now) throw new Error("作物尚未成熟");
      const plantedCrop = cropById(plot.cropId);
      const yieldCount = estimatedYield(plot, plantedCrop, now, options.timeScale);
      state.produce[plantedCrop.id] += yieldCount;
      state.experience += plantedCrop.experience;
      const harvestedCycles = (plot.harvestedCycles ?? 0) + 1;
      plot.harvestedCycles = harvestedCycles;
      if (harvestedCycles < plantedCrop.harvestCycles) {
        startGrowthCycle(state, plot, now, plantedCrop.regrowthSeconds, options.timeScale);
      } else {
        markWithered(plot, now);
      }
      break;
    }
    case "clear-plot": {
      ensurePlanted(plot);
      if (!plot.witheredAt) throw new Error("只有枯萎作物需要锄地清理");
      state.experience += 3;
      awardHiddenSeed(state);
      clearPlot(plot);
      break;
    }
    case "reclaim-plot": {
      if (!plot) throw new Error("土地不存在");
      const expectedPlotId = state.unlockedPlotCount + 1;
      if (plot.id <= state.unlockedPlotCount) throw new Error("这块土地已经开垦");
      if (plot.id !== expectedPlotId) throw new Error(`请先开垦第 ${expectedPlotId} 块土地`);
      const requirement = landUnlockRequirement(plot.id);
      if (level < requirement.levelRequired) {
        throw new Error(`达到 ${requirement.levelRequired} 级后才能开垦`);
      }
      if (state.coins < requirement.coinCost) throw new Error("金币不足");
      state.coins -= requirement.coinCost;
      state.unlockedPlotCount = plot.id;
      break;
    }
    case "buy-fertilizer": {
      const coinPrice = manorFertilizerById("ordinary").coinPrice;
      if (coinPrice === undefined) throw new Error("普通化肥暂不可购买");
      const cost = coinPrice * action.quantity;
      if (state.coins < cost) throw new Error("金币不足");
      state.coins -= cost;
      state.fertilizers.ordinary += action.quantity;
      businessTransactions.push({ kind: "purchase", area: "farm", itemName: "普通化肥", quantity: action.quantity, unitPrice: coinPrice });
      break;
    }
    case "claim-starter-gift": {
      if (state.starterGiftClaimed) throw new Error("新手礼包已经领取");
      for (const item of MANOR_STARTER_GIFT) awardRewardItem(state, item);
      state.starterGiftClaimed = true;
      break;
    }
    case "acknowledge-level-rewards": {
      if (state.pendingLevelRewardLevels.length === 0) throw new Error("没有待确认的升级奖励");
      state.pendingLevelRewardLevels = [];
      break;
    }
    case "buy-decoration": {
      const decoration = manorDecorationById(action.sourceId);
      if (!decoration.purchasable) throw new Error("历史活动装扮不开放购买");
      if (level < decoration.levelRequired) {
        throw new Error(`达到 ${decoration.levelRequired} 级后解锁`);
      }
      if (isDecorationOwned(state, decoration.sourceId, now)) throw new Error("已经拥有这件装扮");
      if (state.coins < decoration.coinPrice) throw new Error("金币不足");
      state.coins -= decoration.coinPrice;
      state.experience += decoration.experience;
      state.decorationPurchases = state.decorationPurchases.filter(
        (purchase) => purchase.sourceId !== decoration.sourceId
      );
      state.decorationPurchases.push({
        sourceId: decoration.sourceId,
        validUntil: now + decoration.validSeconds * 1_000
      });
      activateDecoration(state, decoration.sourceId);
      businessTransactions.push({ kind: "purchase", area: "farm", itemName: decoration.name, quantity: 1, unitPrice: decoration.coinPrice });
      break;
    }
    case "activate-decoration": {
      const decoration = manorDecorationById(action.sourceId);
      if (!isDecorationOwned(state, decoration.sourceId, now)) throw new Error("尚未拥有或装扮已过期");
      activateDecoration(state, decoration.sourceId);
      break;
    }
    case "deactivate-decoration": {
      manorDecorationById(action.sourceId);
      if (!state.activeDecorationIds.includes(action.sourceId)) throw new Error("这件装扮当前未启用");
      state.activeDecorationIds = state.activeDecorationIds.filter((id) => id !== action.sourceId);
      break;
    }
    case "sell": {
      if (!crop) throw new Error("作物不存在");
      if (state.produce[crop.id] < action.quantity) throw new Error("仓库数量不足");
      state.produce[crop.id] -= action.quantity;
      state.coins += crop.salePrice * action.quantity;
      businessTransactions.push({ kind: "sale", area: "farm", itemName: crop.name, quantity: action.quantity, unitPrice: crop.salePrice });
      break;
    }
    case "sell-all": {
      for (const sellCrop of MANOR_CROPS) {
        const quantity = state.produce[sellCrop.id];
        if (quantity < 1) continue;
        state.produce[sellCrop.id] = 0;
        state.coins += sellCrop.salePrice * quantity;
        businessTransactions.push({ kind: "sale", area: "farm", itemName: sellCrop.name, quantity, unitPrice: sellCrop.salePrice });
      }
      if (businessTransactions.length === 0) throw new Error("农场仓库没有可出售的作物");
      break;
    }
    case "buy-dog": {
      const dog = manorDogById(action.dogId);
      if (state.ownedDogIds.includes(dog.id)) throw new Error("已经拥有这只看门狗");
      if (state.coins < dog.price) throw new Error("金币不足");
      state.coins -= dog.price;
      state.ownedDogIds.push(dog.id);
      state.activeDogId = dog.id;
      if (state.dogFedUntil < now) state.dogFedUntil = now + 86_400_000;
      businessTransactions.push({ kind: "purchase", area: "farm", itemName: dog.name, quantity: 1, unitPrice: dog.price });
      break;
    }
    case "activate-dog": {
      manorDogById(action.dogId);
      if (!state.ownedDogIds.includes(action.dogId)) throw new Error("尚未拥有这只看门狗");
      state.activeDogId = action.dogId;
      break;
    }
    case "buy-dog-food": {
      if (state.ownedDogIds.length === 0) throw new Error("请先购买一只看门狗");
      const option = MANOR_DOG_FOOD_OPTIONS.find((candidate) => candidate.days === action.days);
      if (!option) throw new Error("狗粮不存在");
      if (state.coins < option.coinPrice) throw new Error("金币不足");
      state.coins -= option.coinPrice;
      state.dogFedUntil = Math.max(now, state.dogFedUntil) + option.days * 86_400_000;
      businessTransactions.push({ kind: "purchase", area: "farm", itemName: `${option.days}天狗粮`, quantity: 1, unitPrice: option.coinPrice });
      break;
    }
    case "craft-instant-fertilizer": {
      const redRose = cropBySourceId(41);
      const manureCost = MANOR_FACTORY_RECIPE.manure * action.quantity;
      const roseCost = MANOR_FACTORY_RECIPE.redRoses * action.quantity;
      const coinCost = MANOR_FACTORY_RECIPE.coins * action.quantity;
      if (state.pasture.manure < manureCost) throw new Error("牧场便便不足");
      if (state.produce[redRose.id] < roseCost) throw new Error("红玫瑰不足");
      if (state.coins < coinCost) throw new Error("金币不足");
      state.pasture.manure -= manureCost;
      state.produce[redRose.id] -= roseCost;
      state.coins -= coinCost;
      state.fertilizers.instant += action.quantity;
      break;
    }
  }

  if (businessTransactions.length > 0) {
    const business = appendManorBusinessTransactions(
      state.businessRecords,
      state.nextBusinessRecordId,
      businessTransactions,
      now
    );
    state.businessRecords = business.records;
    state.nextBusinessRecordId = business.nextId;
  }

  const taskEvent = taskEventForAction(action.type);
  if (taskEvent) recordManorTaskEvent(state, taskEvent);
  awardReachedLevelRewards(state);
  state.revision += 1;
  state.updatedAt = now;
  validateManorFarm(state);
  return state;
}

export function recordManorTaskEvent(
  state: ManorFarmState,
  event: ManorTaskEvent
): ManorTaskDefinition | undefined {
  const task = MANOR_TASKS[state.nextTaskId];
  if (!task || task.event !== event) return undefined;
  state.nextTaskId += 1;
  state.coins += task.rewardCoins;
  state.experience += task.rewardExperience;
  awardReachedLevelRewards(state);
  return task;
}

export function cloneManorFarm(state: ManorFarmState): ManorFarmState {
  return cloneState(state);
}

export function toManorFlowerCatalog(state: ManorFarmState): ManorFlowerCatalogView[] {
  validateManorFarm(state);
  return MANOR_FLOWERS.map((flower) => {
    const requirements = flower.requirements.map((requirement) => {
      const crop = cropBySourceId(requirement.sourceId);
      return {
        cropId: crop.id,
        sourceId: crop.sourceId,
        cropName: crop.name,
        quantity: requirement.quantity,
        available: state.produce[crop.id]
      };
    });
    return {
      id: flower.id,
      name: flower.name,
      description: flower.description,
      assetUrl: flower.assetUrl,
      requirements,
      canSend: requirements.every((requirement) => requirement.available >= requirement.quantity)
    };
  });
}

export function manorEstimatedYield(
  plot: ManorPlotState,
  now: number,
  timeScale = 1
): number {
  if (!plot.cropId) throw new Error("这块土地还没有作物");
  return estimatedYield(plot, cropById(plot.cropId), now, timeScale);
}

export function manorMinimumYield(plot: ManorPlotState, now: number, timeScale = 1): number {
  const remaining = manorEstimatedYield(plot, now, timeScale);
  return Math.max(1, Math.floor((remaining + (plot.stolenYield ?? 0)) * 0.6));
}

export function drawManorRandom(state: ManorFarmState): number {
  const drawn = nextRandom(state.randomState);
  state.randomState = drawn.state;
  return drawn.value;
}

export function finalizeManorFarmMutation(state: ManorFarmState, now: number): ManorFarmState {
  awardReachedLevelRewards(state);
  state.revision += 1;
  state.updatedAt = now;
  validateManorFarm(state);
  return state;
}

function taskEventForAction(type: ManorActionRequest["type"]): ManorTaskEvent | undefined {
  switch (type) {
    case "plant":
    case "fertilize":
    case "water":
    case "clear-weed":
    case "clear-pest":
    case "harvest":
    case "clear-plot":
    case "buy-seeds":
    case "sell":
      return type;
    case "sell-all":
      return "sell";
    default:
      return undefined;
  }
}

export function toManorFarmView(
  state: ManorFarmState,
  displayName: string,
  now: number,
  options: ManorRuntimeOptions = {}
): ManorFarmView {
  validateManorFarm(state);
  const level = levelForExperience(state.experience);
  const currentLevelStart = experienceForLevel(level);
  const nextLevelExperience = experienceForLevel(level + 1);
  const catalog: ManorCropView[] = MANOR_CROPS.map((crop) => ({
    ...crop,
    growthSeconds: Math.max(1, Math.round(growthDurationMs(crop, options.timeScale) / 1_000)),
    regrowthSeconds: Math.max(1, Math.round(scaledDurationMs(crop.regrowthSeconds, options.timeScale) / 1_000)),
    growthStageSeconds: crop.growthStageSeconds.map((seconds) =>
      Math.max(1, Math.round(scaledDurationMs(seconds, options.timeScale) / 1_000))
    ),
    unlocked: level >= crop.levelRequired,
    seeds: state.seeds[crop.id],
    produce: state.produce[crop.id]
  }));
  const plots: ManorPlotView[] = state.plots.map((plot) =>
    toPlotView(plot, now, options.timeScale, state.unlockedPlotCount)
  );
  const decorations = MANOR_DECORATIONS.map((decoration) =>
    toDecorationView(state, decoration.sourceId, level, now)
  );
  const activeDecorations: Partial<Record<ManorDecorationType, ManorDecorationView>> = {};
  for (const decoration of decorations) {
    if (decoration.active) activeDecorations[decoration.category] = decoration;
  }
  const daily = refreshManorDailyState(state.daily, now);
  const redRose = cropBySourceId(41);
  const craftable = Math.min(
    Math.floor(state.pasture.manure / MANOR_FACTORY_RECIPE.manure),
    Math.floor(state.produce[redRose.id] / MANOR_FACTORY_RECIPE.redRoses),
    Math.floor(state.coins / MANOR_FACTORY_RECIPE.coins)
  );
  return {
    serverTime: now,
    revision: state.revision,
    profile: {
      displayName,
      coins: state.coins,
      level,
      experience: state.experience,
      currentLevelExperience: currentLevelStart,
      nextLevelExperience
    },
    inventory: {
      fertilizers: MANOR_FERTILIZERS.map((fertilizer) => ({
        id: fertilizer.id,
        sourceId: fertilizer.sourceId,
        name: fertilizer.name,
        amount: state.fertilizers[fertilizer.id],
        effectSeconds: Math.max(
          1,
          Math.round(scaledDurationMs(fertilizer.effectSeconds, options.timeScale) / 1_000)
        ),
        ...(fertilizer.coinPrice === undefined ? {} : { coinPrice: fertilizer.coinPrice })
      }))
    },
    weather: manorWeatherAt(now),
    dog: {
      catalog: MANOR_DOGS.map((dog) => ({
        ...dog,
        owned: state.ownedDogIds.includes(dog.id),
        active: state.activeDogId === dog.id
      })),
      fedUntil: state.dogFedUntil,
      fed: Boolean(state.activeDogId && state.dogFedUntil > now),
      foodOptions: MANOR_DOG_FOOD_OPTIONS.map((option) => ({ ...option }))
    },
    factory: {
      recipe: { ...MANOR_FACTORY_RECIPE },
      available: {
        manure: state.pasture.manure,
        redRoses: state.produce[redRose.id],
        coins: state.coins
      },
      craftable
    },
    dailyLimits: {
      farmPranksRemaining: MANOR_FARM_PRANK_LIMIT - daily.farmPranksUsed,
      pastureMosquitoesRemaining:
        MANOR_PASTURE_MOSQUITO_LIMIT - daily.pastureMosquitoesReleased,
      specialFeedsRemaining: MANOR_SPECIAL_FEED_LIMIT - daily.specialFeedsReceived
    },
    activities: cloneManorActivities(state.activities),
    businessRecords: options.includeBusinessRecords === false
      ? []
      : toManorBusinessRecordViews(state.businessRecords),
    flowerBasket: [...state.receivedFlowers]
      .sort((left, right) => right.createdAt - left.createdAt || right.id - left.id)
      .map((receipt) => {
        const flower = manorFlowerById(receipt.flowerId);
        return {
          ...receipt,
          name: flower.name,
          description: flower.description,
          assetUrl: flower.assetUrl
        };
      }),
    starterGift: {
      claimed: state.starterGiftClaimed,
      items: MANOR_STARTER_GIFT.map(toRewardItemView)
    },
    pendingLevelRewards: state.pendingLevelRewardLevels.map((originalLevel) => {
      const reward = manorLevelReward(originalLevel);
      return {
        originalLevel,
        displayLevel: reward.displayLevel,
        items: [toRewardItemView(reward.item)]
      };
    }),
    tasks: {
      completedCount: state.nextTaskId,
      total: MANOR_TASKS.length,
      ...(MANOR_TASKS[state.nextTaskId]
        ? {
            current: {
              id: MANOR_TASKS[state.nextTaskId]!.id,
              name: MANOR_TASKS[state.nextTaskId]!.name,
              description: MANOR_TASKS[state.nextTaskId]!.description,
              rewardCoins: MANOR_TASKS[state.nextTaskId]!.rewardCoins,
              rewardExperience: MANOR_TASKS[state.nextTaskId]!.rewardExperience
            }
          }
        : {})
    },
    decorations: {
      catalog: decorations,
      active: activeDecorations
    },
    catalog,
    plots,
    art: options.legacyBackgroundUrl
      ? { source: "legacy", backgroundUrl: options.legacyBackgroundUrl }
      : { source: "built-in" }
  };
}

export function validateManorFarm(state: ManorFarmState): void {
  if (state.schemaVersion !== 12) throw new Error("庄园存档版本无效");
  for (const [label, value] of [
    ["修订号", state.revision],
    ["金币", state.coins],
    ["经验", state.experience],
    ["随机状态", state.randomState],
    ["新手任务进度", state.nextTaskId],
    ["升级奖励进度", state.rewardedThroughOriginalLevel],
    ["已开垦土地数量", state.unlockedPlotCount],
    ["创建时间", state.createdAt],
    ["更新时间", state.updatedAt]
  ] as const) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${label}无效`);
  }
  if (typeof state.starterGiftClaimed !== "boolean") throw new Error("新手礼包状态无效");
  if (!Number.isInteger(state.dogFedUntil) || state.dogFedUntil < 0) {
    throw new Error("狗粮有效期无效");
  }
  const ownedDogIds = new Set(state.ownedDogIds);
  if (
    ownedDogIds.size !== state.ownedDogIds.length ||
    state.ownedDogIds.some((id) => !MANOR_DOGS.some((dog) => dog.id === id)) ||
    (state.activeDogId !== undefined && !ownedDogIds.has(state.activeDogId))
  ) {
    throw new Error("看门狗状态无效");
  }
  validateManorDailyState(state.daily);
  validateManorActivities(state.activities);
  validateManorBusinessRecords(state.businessRecords, state.nextBusinessRecordId);
  if (!Number.isInteger(state.nextReceivedFlowerId) || state.nextReceivedFlowerId < 1) {
    throw new Error("下一花束编号无效");
  }
  const receivedFlowerIds = new Set<number>();
  for (const receipt of state.receivedFlowers) {
    manorFlowerById(receipt.flowerId);
    if (
      !Number.isInteger(receipt.id) ||
      receipt.id < 1 ||
      receivedFlowerIds.has(receipt.id) ||
      typeof receipt.senderUserId !== "string" ||
      receipt.senderUserId.length < 1 ||
      typeof receipt.senderDisplayName !== "string" ||
      receipt.senderDisplayName.length < 1 ||
      typeof receipt.message !== "string" ||
      receipt.message.length > 120 ||
      !Number.isInteger(receipt.createdAt) ||
      receipt.createdAt < 0
    ) {
      throw new Error("花篮记录无效");
    }
    receivedFlowerIds.add(receipt.id);
  }
  if (state.receivedFlowers.some((receipt) => receipt.id >= state.nextReceivedFlowerId)) {
    throw new Error("下一花束编号无效");
  }
  if (state.nextTaskId > MANOR_TASKS.length) throw new Error("新手任务进度无效");
  for (const fertilizer of MANOR_FERTILIZERS) {
    if (!Number.isInteger(state.fertilizers[fertilizer.id]) || state.fertilizers[fertilizer.id] < 0) {
      throw new Error(`${fertilizer.name}库存无效`);
    }
  }
  if (state.rewardedThroughOriginalLevel > MANOR_MAX_LEVEL_REWARD) {
    throw new Error("升级奖励进度无效");
  }
  const pendingRewards = new Set(state.pendingLevelRewardLevels);
  if (
    pendingRewards.size !== state.pendingLevelRewardLevels.length ||
    state.pendingLevelRewardLevels.some((level) =>
      !Number.isInteger(level) || level < 1 || level > state.rewardedThroughOriginalLevel
    )
  ) {
    throw new Error("待确认升级奖励无效");
  }
  const decorationEntitlements = new Set(state.decorationEntitlements);
  const knownDecorationIds = new Set(MANOR_DECORATIONS.map((decoration) => decoration.sourceId));
  if (
    decorationEntitlements.size !== state.decorationEntitlements.length ||
    state.decorationEntitlements.some((id) => !Number.isInteger(id) || !knownDecorationIds.has(id))
  ) {
    throw new Error("装扮权益无效");
  }
  const purchaseIds = new Set<number>();
  for (const purchase of state.decorationPurchases) {
    if (
      !Number.isInteger(purchase.sourceId) ||
      !knownDecorationIds.has(purchase.sourceId) ||
      purchaseIds.has(purchase.sourceId) ||
      !Number.isInteger(purchase.validUntil) ||
      purchase.validUntil < 0
    ) {
      throw new Error("装扮购买记录无效");
    }
    purchaseIds.add(purchase.sourceId);
  }
  const activeIds = new Set<number>();
  const activeTypes = new Set<ManorDecorationType>();
  for (const sourceId of state.activeDecorationIds) {
    const decoration = manorDecorationById(sourceId);
    if (
      activeIds.has(sourceId) ||
      activeTypes.has(decoration.category) ||
      (!decorationEntitlements.has(sourceId) && !purchaseIds.has(sourceId))
    ) {
      throw new Error("已启用装扮无效");
    }
    activeIds.add(sourceId);
    activeTypes.add(decoration.category);
  }
  if (
    state.unlockedPlotCount < MANOR_INITIAL_PLOT_COUNT ||
    state.unlockedPlotCount > MANOR_PLOT_COUNT
  ) {
    throw new Error("已开垦土地数量无效");
  }
  if (state.plots.length !== MANOR_PLOT_COUNT) throw new Error("庄园土地数量无效");
  const ids = new Set<number>();
  for (const plot of state.plots) {
    if (!Number.isInteger(plot.id) || plot.id < 1 || plot.id > MANOR_PLOT_COUNT || ids.has(plot.id)) {
      throw new Error("土地编号无效");
    }
    ids.add(plot.id);
    if (!Number.isInteger(plot.cycle) || plot.cycle < 0) throw new Error("土地轮次无效");
    if (
      plot.stolenYield !== undefined &&
      (!Number.isInteger(plot.stolenYield) || plot.stolenYield < 0)
    ) {
      throw new Error("作物被偷数量无效");
    }
    if (
      plot.thiefUserIds !== undefined &&
      (new Set(plot.thiefUserIds).size !== plot.thiefUserIds.length ||
        plot.thiefUserIds.some((userId) => typeof userId !== "string" || userId.length === 0))
    ) {
      throw new Error("作物偷取记录无效");
    }
    for (const [label, value] of [["杂草", plot.weedLevel], ["害虫", plot.pestLevel]] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 3)) {
        throw new Error(`${label}数量无效`);
      }
    }
    if (plot.id > state.unlockedPlotCount && (plot.cropId || plot.cycle !== 0)) {
      throw new Error("未开垦土地包含作物状态");
    }
    const careValues = [
      plot.dryAt,
      plot.wateredAt,
      plot.weedAt,
      plot.weedClearedAt,
      plot.pestAt,
      plot.pestClearedAt
    ];
    if (careValues.some((value) => value !== undefined && (!Number.isInteger(value) || value < 0))) {
      throw new Error("作物照料时间无效");
    }
    if (plot.cropId) {
      const crop = cropById(plot.cropId);
      const harvestedCycles = plot.harvestedCycles;
      if (harvestedCycles === undefined || !Number.isInteger(harvestedCycles) || harvestedCycles < 0 || harvestedCycles > crop.harvestCycles) {
        throw new Error("作物收获季数无效");
      }
      if (plot.witheredAt) {
        if (
          harvestedCycles !== crop.harvestCycles ||
          plot.plantedAt ||
          plot.readyAt ||
          careValues.some((value) => value !== undefined) ||
          plot.weedLevel !== undefined ||
          plot.pestLevel !== undefined ||
          plot.fertilizedStage !== undefined
        ) {
          throw new Error("枯萎作物状态无效");
        }
      } else if (!plot.plantedAt || !plot.readyAt || plot.readyAt <= plot.plantedAt) {
        throw new Error("作物时间无效");
      } else {
        if (plot.wateredAt !== undefined && plot.dryAt === undefined) throw new Error("浇水状态无效");
        if (plot.weedClearedAt !== undefined && plot.weedAt === undefined) throw new Error("除草状态无效");
        if (plot.pestClearedAt !== undefined && plot.pestAt === undefined) throw new Error("除虫状态无效");
        if (
          plot.fertilizedStage !== undefined &&
          (!Number.isInteger(plot.fertilizedStage) || plot.fertilizedStage < 0 || plot.fertilizedStage > 4)
        ) {
          throw new Error("施肥阶段无效");
        }
      }
    } else if (
      plot.harvestedCycles !== undefined ||
      plot.plantedAt ||
      plot.readyAt ||
      plot.witheredAt ||
      careValues.some((value) => value !== undefined) ||
      plot.weedLevel !== undefined ||
      plot.pestLevel !== undefined ||
      plot.fertilizedStage !== undefined ||
      plot.stolenYield !== undefined ||
      plot.thiefUserIds !== undefined
    ) {
      throw new Error("空地包含作物状态");
    }
  }
  for (const crop of MANOR_CROPS) {
    if (!Number.isInteger(state.seeds[crop.id]) || state.seeds[crop.id] < 0) {
      throw new Error("种子库存无效");
    }
    if (!Number.isInteger(state.produce[crop.id]) || state.produce[crop.id] < 0) {
      throw new Error("仓库库存无效");
    }
  }
  validateManorPasture(state.pasture);
}

export function levelForExperience(experience: number): number {
  let level = 1;
  while (level < 50 && experience >= experienceForLevel(level + 1)) level += 1;
  return level;
}

export function experienceForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * (level - 1) * level;
}

function toRewardItemView(item: ManorRewardItemDefinition): ManorRewardItemView {
  return {
    kind: item.kind,
    sourceId: item.sourceId,
    name: item.name,
    quantity: item.quantity,
    available: item.kind !== "decoration" || MANOR_DECORATIONS.some(
      (decoration) => decoration.sourceId === item.sourceId
    )
  };
}

function toDecorationView(
  state: ManorFarmState,
  sourceId: number,
  level: number,
  now: number
): ManorDecorationView {
  const decoration = manorDecorationById(sourceId);
  const purchase = state.decorationPurchases.find((candidate) => candidate.sourceId === sourceId);
  const permanent = state.decorationEntitlements.includes(sourceId);
  const owned = permanent || Boolean(purchase && purchase.validUntil > now);
  return {
    ...decoration,
    unlocked: level >= decoration.levelRequired,
    owned,
    active: owned && state.activeDecorationIds.includes(sourceId),
    ...(!permanent && purchase ? { validUntil: purchase.validUntil } : {})
  };
}

function toPlotView(
  plot: ManorPlotState,
  now: number,
  timeScale = 1,
  unlockedPlotCount = MANOR_PLOT_COUNT
): ManorPlotView {
  const unlocked = plot.id <= unlockedPlotCount;
  const requirement = unlocked ? undefined : landUnlockRequirement(plot.id);
  const landDetails = {
    unlocked,
    nextUnlock: !unlocked && plot.id === unlockedPlotCount + 1,
    ...(requirement
      ? { unlockLevel: requirement.levelRequired, unlockCost: requirement.coinCost }
      : {})
  };
  if (!plot.cropId) {
    return {
      id: plot.id,
      ...landDetails,
      status: "empty",
      progress: 0,
      watered: false,
      weed: false,
      weedLevel: 0,
      pest: false,
      pestLevel: 0
    };
  }
  const crop = cropById(plot.cropId);
  const cropDetails = {
    cropId: crop.id,
    cropSourceId: crop.sourceId,
    cropName: crop.name,
    cropEmoji: crop.emoji,
    harvestedCycles: plot.harvestedCycles ?? 0,
    harvestCycles: crop.harvestCycles
  };
  if (plot.witheredAt) {
    return {
      id: plot.id,
      ...landDetails,
      status: "withered",
      ...cropDetails,
      witheredAt: plot.witheredAt,
      progress: 1,
      watered: false,
      weed: false,
      weedLevel: 0,
      pest: false,
      pestLevel: 0
    };
  }
  if (!plot.plantedAt || !plot.readyAt) throw new Error("作物时间无效");
  const duration = plot.readyAt - plot.plantedAt;
  const progress = Math.max(0, Math.min(1, (now - plot.plantedAt) / duration));
  const remainingYield = estimatedYield(plot, crop, now, timeScale);
  const originalYield = remainingYield + (plot.stolenYield ?? 0);
  return {
    id: plot.id,
    ...landDetails,
    status: now >= plot.readyAt ? "mature" : "growing",
    ...cropDetails,
    plantedAt: plot.plantedAt,
    readyAt: plot.readyAt,
    progress,
    watered: !isCareEventActive(plot.dryAt, plot.wateredAt, now),
    weed: isCareEventActive(plot.weedAt, plot.weedClearedAt, now),
    weedLevel: isCareEventActive(plot.weedAt, plot.weedClearedAt, now) ? plot.weedLevel ?? 1 : 0,
    pest: isCareEventActive(plot.pestAt, plot.pestClearedAt, now),
    pestLevel: isCareEventActive(plot.pestAt, plot.pestClearedAt, now) ? plot.pestLevel ?? 1 : 0,
    ...(plot.fertilizedStage === undefined ? {} : { fertilizedStage: plot.fertilizedStage }),
    visualStageThresholds: plot.harvestedCycles && plot.harvestedCycles > 0
      ? [0, 0, 0, 0]
      : crop.growthStageSeconds.slice(0, 4).map((seconds) => seconds / crop.growthSeconds),
    estimatedYield: remainingYield,
    minimumYield: Math.max(1, Math.floor(originalYield * 0.6)),
    stolenYield: plot.stolenYield ?? 0
  };
}

function estimatedYield(
  plot: ManorPlotState,
  crop: ManorCropDefinition,
  now: number,
  timeScale = 1
): number {
  const interval = scaledDurationMs(300, timeScale);
  const penalty = Math.min(
    50,
    careEventPenalty(plot.dryAt, plot.wateredAt, now, interval, 2) +
      careEventPenalty(plot.weedAt, plot.weedClearedAt, now, interval, plot.weedLevel ?? 1) +
      careEventPenalty(plot.pestAt, plot.pestClearedAt, now, interval, plot.pestLevel ?? 1)
  );
  const originalYield = Math.max(1, Math.ceil(crop.baseYield * (100 - penalty) / 100));
  return Math.max(0, originalYield - (plot.stolenYield ?? 0));
}

function cropById(id: ManorCropId): ManorCropDefinition {
  const crop = MANOR_CROPS.find((candidate) => candidate.id === id);
  if (!crop) throw new Error("作物不存在");
  return crop;
}

function cropBySourceId(sourceId: number): ManorCropDefinition {
  const crop = MANOR_CROPS.find((candidate) => candidate.sourceId === sourceId);
  if (!crop) throw new Error("奖励作物配置不存在");
  return crop;
}

function plotById(state: ManorFarmState, id: number): ManorPlotState {
  const plot = state.plots.find((candidate) => candidate.id === id);
  if (!plot) throw new Error("土地不存在");
  return plot;
}

function landUnlockRequirement(plotId: number): ManorLandUnlockRequirement {
  const requirement = MANOR_LAND_UNLOCKS.find((candidate) => candidate.plotId === plotId);
  if (!requirement) throw new Error("土地开垦配置不存在");
  return requirement;
}

function ensurePlotUnlocked(state: ManorFarmState, plot: ManorPlotState): void {
  if (plot.id > state.unlockedPlotCount) throw new Error("这块土地尚未开垦");
}

function ensurePlanted(plot: ManorPlotState | undefined): asserts plot is ManorPlotState & {
  cropId: ManorCropId;
} {
  if (!plot?.cropId) throw new Error("这块土地还没有作物");
}

function ensureGrowing(plot: ManorPlotState | undefined): asserts plot is ManorPlotState & {
  cropId: ManorCropId;
} {
  ensurePlanted(plot);
  if (plot.witheredAt) throw new Error("作物已经枯萎，请用锄头清理");
}

function clearPlot(plot: ManorPlotState): void {
  delete plot.cropId;
  delete plot.harvestedCycles;
  delete plot.plantedAt;
  delete plot.readyAt;
  delete plot.witheredAt;
  delete plot.stolenYield;
  delete plot.thiefUserIds;
  clearCareState(plot);
}

function clearCareState(plot: ManorPlotState): void {
  delete plot.dryAt;
  delete plot.wateredAt;
  delete plot.weedAt;
  delete plot.weedLevel;
  delete plot.weedClearedAt;
  delete plot.pestAt;
  delete plot.pestLevel;
  delete plot.pestClearedAt;
  delete plot.fertilizedStage;
}

function growthDurationMs(crop: ManorCropDefinition, timeScale = 1): number {
  return scaledDurationMs(crop.growthSeconds, timeScale);
}

function scaledDurationMs(seconds: number, timeScale = 1): number {
  const scale = Number.isFinite(timeScale) ? Math.max(1, Math.min(3_600, timeScale)) : 1;
  return Math.max(1_000, Math.round((seconds * 1_000) / scale));
}

function startGrowthCycle(
  state: ManorFarmState,
  plot: ManorPlotState,
  now: number,
  durationSeconds: number,
  timeScale = 1
): void {
  const duration = scaledDurationMs(durationSeconds, timeScale);
  const dry = nextRandom(state.randomState);
  const weed = nextRandom(dry.state);
  const pest = nextRandom(weed.state);
  state.randomState = pest.state;
  delete plot.witheredAt;
  delete plot.stolenYield;
  delete plot.thiefUserIds;
  clearCareState(plot);
  plot.plantedAt = now;
  plot.readyAt = now + duration;
  if (dry.value < 0.55) {
    const dryAt = now + Math.round(duration * (0.2 + dry.value * 0.4));
    if (manorWeatherAt(dryAt).id !== "rainy") plot.dryAt = dryAt;
  }
  if (weed.value < 0.6) {
    plot.weedAt = now + Math.round(duration * (0.28 + weed.value * 0.35));
    plot.weedLevel = 1;
  }
  if (pest.value < 0.5) {
    plot.pestAt = now + Math.round(duration * (0.5 + pest.value * 0.4));
    plot.pestLevel = 1;
  }
}

function rewardCareAction(state: ManorFarmState): void {
  state.coins += 2;
  state.experience += 2;
}

function isCareEventActive(eventAt: number | undefined, clearedAt: number | undefined, now: number): boolean {
  return eventAt !== undefined && eventAt <= now && clearedAt === undefined;
}

function careEventPenalty(
  eventAt: number | undefined,
  clearedAt: number | undefined,
  now: number,
  interval: number,
  multiplier: number
): number {
  if (!isCareEventActive(eventAt, clearedAt, now) || eventAt === undefined) return 0;
  return (Math.ceil((now - eventAt) / interval) + 1) * multiplier;
}

function applyFertilizer(
  plot: ManorPlotState & { cropId: ManorCropId },
  crop: ManorCropDefinition,
  now: number,
  effectSeconds: number,
  timeScale = 1
): void {
  if (!plot.plantedAt || !plot.readyAt) throw new Error("作物时间无效");
  const schedule = crop.growthStageSeconds.map((seconds) => scaledDurationMs(seconds, timeScale));
  const cycleOffset = (plot.harvestedCycles ?? 0) > 0 ? schedule[2] ?? 0 : 0;
  const elapsed = cycleOffset + Math.max(0, now - plot.plantedAt);
  const stage = schedule.findIndex((stageEnd) => elapsed < stageEnd);
  if (stage < 0) throw new Error("成熟作物不需要施肥");
  if (plot.fertilizedStage === stage) throw new Error("当前生长阶段已经施过肥");

  const stageEnd = schedule[stage];
  if (stageEnd === undefined) throw new Error("作物生长阶段无效");
  const applied = Math.min(
    scaledDurationMs(effectSeconds, timeScale),
    stageEnd - elapsed
  );
  if (applied <= 0) throw new Error("当前生长阶段无法继续施肥");

  plot.fertilizedStage = stage;
  plot.plantedAt -= applied;
  plot.readyAt -= applied;
  shiftFutureCareEvent(plot, "dryAt", now, applied);
  shiftFutureCareEvent(plot, "weedAt", now, applied);
  shiftFutureCareEvent(plot, "pestAt", now, applied);
}

function shiftFutureCareEvent(
  plot: ManorPlotState,
  key: "dryAt" | "weedAt" | "pestAt",
  now: number,
  amount: number
): void {
  const eventAt = plot[key];
  if (eventAt !== undefined && eventAt > now) plot[key] = Math.max(now, eventAt - amount);
}

function markWithered(plot: ManorPlotState, now: number): void {
  delete plot.plantedAt;
  delete plot.readyAt;
  clearCareState(plot);
  plot.witheredAt = now;
}

function awardHiddenSeed(state: ManorFarmState): void {
  const rewardRoll = nextRandom(state.randomState);
  state.randomState = rewardRoll.state;
  if (rewardRoll.value >= 0.1) return;

  const hiddenCrops = MANOR_CROPS.filter((crop) => !crop.purchasable);
  const cropRoll = nextRandom(state.randomState);
  const quantityRoll = nextRandom(cropRoll.state);
  state.randomState = quantityRoll.state;
  const crop = hiddenCrops[Math.floor(cropRoll.value * hiddenCrops.length)];
  if (!crop) throw new Error("隐藏种子目录为空");
  state.seeds[crop.id] += quantityRoll.value < 0.5 ? 1 : 2;
}

function awardReachedLevelRewards(state: ManorFarmState): void {
  const reachedOriginalLevel = originalLevelForExperience(state.experience);
  for (
    let originalLevel = state.rewardedThroughOriginalLevel + 1;
    originalLevel <= reachedOriginalLevel;
    originalLevel += 1
  ) {
    awardRewardItem(state, manorLevelReward(originalLevel).item);
    state.pendingLevelRewardLevels.push(originalLevel);
  }
  state.rewardedThroughOriginalLevel = Math.max(
    state.rewardedThroughOriginalLevel,
    reachedOriginalLevel
  );
}

function isDecorationOwned(state: ManorFarmState, sourceId: number, now: number): boolean {
  if (state.decorationEntitlements.includes(sourceId)) return true;
  return state.decorationPurchases.some(
    (purchase) => purchase.sourceId === sourceId && purchase.validUntil > now
  );
}

function activateDecoration(state: ManorFarmState, sourceId: number): void {
  const category = manorDecorationById(sourceId).category;
  state.activeDecorationIds = state.activeDecorationIds.filter(
    (activeId) => manorDecorationById(activeId).category !== category
  );
  state.activeDecorationIds.push(sourceId);
}

function awardRewardItem(state: ManorFarmState, item: ManorRewardItemDefinition): void {
  switch (item.kind) {
    case "seed": {
      const crop = cropBySourceId(item.sourceId);
      state.seeds[crop.id] += item.quantity;
      break;
    }
    case "fertilizer":
      state.fertilizers[item.fertilizerId] += item.quantity;
      break;
    case "decoration":
      if (!state.decorationEntitlements.includes(item.sourceId)) {
        state.decorationEntitlements.push(item.sourceId);
      }
      break;
  }
}

function originalLevelForExperience(experience: number): number {
  return Math.min(MANOR_MAX_LEVEL_REWARD, Math.max(0, levelForExperience(experience) - 1));
}

function cropRecord(initial: Partial<Record<ManorCropId, number>> = {}): Record<ManorCropId, number> {
  return Object.fromEntries(
    MANOR_CROPS.map((crop) => [crop.id, initial[crop.id] ?? 0])
  ) as Record<ManorCropId, number>;
}

function fertilizerRecord(
  initial: Partial<Record<ManorFertilizerId, number>> = {}
): Record<ManorFertilizerId, number> {
  return {
    ordinary: initial.ordinary ?? 0,
    fast: initial.fast ?? 0,
    instant: initial.instant ?? 0
  };
}

function createEmptyPlots(startId = 1, count = MANOR_PLOT_COUNT): ManorPlotState[] {
  return Array.from({ length: count }, (_, index) => ({ id: startId + index, cycle: 0 }));
}

function migrateSixPlotFarm(plots: ManorPlotState[]): ManorPlotState[] {
  if (plots.length !== 6) throw new Error("旧版庄园土地数量无效");
  const ids = new Set(plots.map((plot) => plot.id));
  if (ids.size !== 6 || plots.some((plot) => plot.id < 1 || plot.id > 6)) {
    throw new Error("旧版庄园土地编号无效");
  }
  return [...plots, ...createEmptyPlots(7, MANOR_PLOT_COUNT - 6)];
}

function cloneState(state: ManorFarmState): ManorFarmState {
  return {
    ...state,
    fertilizers: { ...state.fertilizers },
    pendingLevelRewardLevels: [...state.pendingLevelRewardLevels],
    decorationEntitlements: [...state.decorationEntitlements],
    decorationPurchases: state.decorationPurchases.map((purchase) => ({ ...purchase })),
    activeDecorationIds: [...state.activeDecorationIds],
    ownedDogIds: [...state.ownedDogIds],
    daily: { ...state.daily },
    activities: cloneManorActivities(state.activities),
    businessRecords: cloneManorBusinessRecords(state.businessRecords),
    receivedFlowers: state.receivedFlowers.map((receipt) => ({ ...receipt })),
    seeds: { ...state.seeds },
    produce: { ...state.produce },
    plots: state.plots.map((plot) => ({
      ...plot,
      ...(plot.thiefUserIds ? { thiefUserIds: [...plot.thiefUserIds] } : {})
    })),
    pasture: migrateManorPasture(state.pasture, state.updatedAt)
  };
}

function migrateDecorationPurchases(value: unknown): ManorDecorationPurchaseState[] {
  if (!Array.isArray(value)) throw new Error("装扮购买记录无效");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("装扮购买记录无效");
    const purchase = entry as Partial<ManorDecorationPurchaseState>;
    return {
      sourceId: integer(purchase.sourceId, "装扮编号"),
      validUntil: timestamp(purchase.validUntil, "装扮有效期")
    };
  });
}

function dogId(value: unknown): ManorDogId {
  if (value !== 1 && value !== 3) throw new Error("看门狗编号无效");
  return value;
}

function dogIdArray(value: unknown): ManorDogId[] {
  if (!Array.isArray(value)) throw new Error("看门狗列表无效");
  return value.map(dogId);
}

function migrateDailyState(value: unknown, now: number): ManorDailyState {
  if (!value || typeof value !== "object") return createManorDailyState(now);
  const daily = value as Partial<ManorDailyState>;
  const migrated: ManorDailyState = {
    day: typeof daily.day === "string" ? daily.day : createManorDailyState(now).day,
    farmPranksUsed: integer(daily.farmPranksUsed ?? 0, "农场使坏次数"),
    pastureMosquitoesReleased: integer(
      daily.pastureMosquitoesReleased ?? 0,
      "牧场放蚊次数"
    ),
    specialFeedsReceived: integer(daily.specialFeedsReceived ?? 0, "胡萝卜喂养次数")
  };
  validateManorDailyState(migrated);
  return refreshManorDailyState(migrated, now);
}

function migrateActivities(value: unknown): ManorActivityState[] {
  if (!Array.isArray(value)) throw new Error("庄园动态记录无效");
  const activities = value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("庄园动态记录无效");
    const activity = entry as Partial<ManorActivityState>;
    return {
      id: integer(activity.id, "动态编号"),
      kind: activity.kind as ManorActivityState["kind"],
      actorName: text(activity.actorName, "动态用户"),
      message: text(activity.message, "动态内容"),
      createdAt: timestamp(activity.createdAt, "动态时间")
    };
  });
  validateManorActivities(activities);
  return activities;
}

function migrateReceivedFlowers(value: unknown): ManorReceivedFlowerState[] {
  if (!Array.isArray(value)) throw new Error("花篮记录无效");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("花篮记录无效");
    const receipt = entry as Partial<ManorReceivedFlowerState>;
    const flowerId = integer(receipt.flowerId, "花束编号") as ManorFlowerId;
    manorFlowerById(flowerId);
    if (typeof receipt.message !== "string") throw new Error("花束赠言无效");
    return {
      id: integer(receipt.id, "花篮记录编号"),
      flowerId,
      senderUserId: text(receipt.senderUserId, "赠花用户"),
      senderDisplayName: text(receipt.senderDisplayName, "赠花用户名称"),
      message: receipt.message,
      createdAt: timestamp(receipt.createdAt, "赠花时间")
    };
  });
}

function migrateBusinessRecords(value: unknown): ManorBusinessRecordState[] {
  if (!Array.isArray(value)) throw new Error("经营流水记录无效");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("经营流水记录无效");
    const record = entry as Partial<ManorBusinessRecordState>;
    if (
      (record.kind !== "purchase" && record.kind !== "sale") ||
      (record.area !== "farm" && record.area !== "pasture")
    ) {
      throw new Error("经营流水记录无效");
    }
    return {
      id: integer(record.id, "经营流水编号"),
      kind: record.kind,
      area: record.area,
      itemName: text(record.itemName, "经营流水项目"),
      quantity: integer(record.quantity, "经营流水数量"),
      unitPrice: integer(record.unitPrice, "经营流水单价"),
      totalCoins: integer(record.totalCoins, "经营流水金额"),
      createdAt: timestamp(record.createdAt, "经营流水时间")
    };
  });
}

function migrateFertilizers(
  value: Partial<Record<ManorFertilizerId, number>> | undefined
): Record<ManorFertilizerId, number> {
  const result = fertilizerRecord(value);
  for (const fertilizer of MANOR_FERTILIZERS) {
    result[fertilizer.id] = integer(result[fertilizer.id], `${fertilizer.name}库存`);
  }
  return result;
}

function migrateInventory(
  value: Partial<Record<ManorCropId, number>> | undefined,
  label: string
): Record<ManorCropId, number> {
  const result = cropRecord(value);
  for (const crop of MANOR_CROPS) result[crop.id] = integer(result[crop.id], label);
  return result;
}

function migratePlot(
  value: unknown,
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
): ManorPlotState {
  if (!value || typeof value !== "object") throw new Error("土地存档格式无效");
  const plot = value as Partial<ManorPlotState>;
  const cropId = plot.cropId === undefined ? undefined : validCropId(plot.cropId);
  return {
    id: integer(plot.id, "土地编号"),
    cycle: integer(plot.cycle, "土地轮次"),
    ...(cropId ? { cropId } : {}),
    ...(cropId ? { harvestedCycles: integer(plot.harvestedCycles ?? 0, "作物收获季数") } : {}),
    ...optionalTimestamp("plantedAt", plot.plantedAt),
    ...optionalTimestamp("readyAt", plot.readyAt),
    ...optionalTimestamp("witheredAt", plot.witheredAt),
    ...(schemaVersion >= 4 ? optionalTimestamp("dryAt", plot.dryAt) : {}),
    ...(schemaVersion >= 4 ? optionalTimestamp("wateredAt", plot.wateredAt) : {}),
    ...optionalTimestamp("weedAt", plot.weedAt),
    ...(schemaVersion >= 10 && plot.weedLevel !== undefined
      ? { weedLevel: integer(plot.weedLevel, "杂草数量") }
      : plot.weedAt !== undefined ? { weedLevel: 1 } : {}),
    ...optionalTimestamp("weedClearedAt", plot.weedClearedAt),
    ...optionalTimestamp("pestAt", plot.pestAt),
    ...(schemaVersion >= 10 && plot.pestLevel !== undefined
      ? { pestLevel: integer(plot.pestLevel, "害虫数量") }
      : plot.pestAt !== undefined ? { pestLevel: 1 } : {}),
    ...optionalTimestamp("pestClearedAt", plot.pestClearedAt),
    ...(schemaVersion >= 4 && plot.fertilizedStage !== undefined
      ? { fertilizedStage: integer(plot.fertilizedStage, "施肥阶段") }
      : {}),
    ...(schemaVersion >= 9 && plot.stolenYield !== undefined
      ? { stolenYield: integer(plot.stolenYield, "作物被偷数量") }
      : {}),
    ...(schemaVersion >= 9 && plot.thiefUserIds !== undefined
      ? { thiefUserIds: stringArray(plot.thiefUserIds, "作物偷取记录") }
      : {})
  };
}

function optionalTimestamp<K extends keyof ManorPlotState>(key: K, value: unknown): Partial<ManorPlotState> {
  return value === undefined ? {} : ({ [key]: timestamp(value, String(key)) } as Partial<ManorPlotState>);
}

function validCropId(value: unknown): ManorCropId {
  if (typeof value !== "string" || !MANOR_CROPS.some((crop) => crop.id === value)) {
    throw new Error("作物编号无效");
  }
  return value as ManorCropId;
}

function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`${label}无效`);
  return Number(value);
}

function integerArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) throw new Error(`${label}无效`);
  return value.map((item) => integer(item, label));
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label}无效`);
  }
  return [...value];
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1) throw new Error(`${label}无效`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label}无效`);
  return value;
}

function timestamp(value: unknown, label: string): number {
  return integer(value, label);
}

function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0 || 1;
}

function nextRandom(state: number): { state: number; value: number } {
  let next = state >>> 0 || 1;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { state: next, value: next / 4_294_967_296 };
}
