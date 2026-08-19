import type {
  ManorActionRequest,
  ManorCropId,
  ManorCropView,
  ManorDecorationType,
  ManorDecorationView,
  ManorFarmView,
  ManorFertilizerId,
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
  weedClearedAt?: number;
  pestAt?: number;
  pestClearedAt?: number;
  fertilizedStage?: number;
}

export interface ManorDecorationPurchaseState {
  sourceId: number;
  validUntil: number;
}

export interface ManorFarmState {
  schemaVersion: 8;
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
}

export const MANOR_PLOT_COUNT = 18;
export const MANOR_INITIAL_PLOT_COUNT = 6;
export const MANOR_MAX_LEVEL_REWARD = MANOR_LEVEL_REWARDS.length;

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
  schemaVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  fertilizer?: unknown;
};

export function createManorFarm(now: number, seedSource: string): ManorFarmState {
  const state: ManorFarmState = {
    schemaVersion: 8,
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
    candidate.schemaVersion !== 8
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
    schemaVersion: 8,
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
  const crop = "cropId" in action ? cropById(action.cropId) : undefined;
  const plot = "plotId" in action ? plotById(state, action.plotId) : undefined;
  const level = levelForExperience(state.experience);
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
      break;
    }
  }

  awardReachedLevelRewards(state);
  state.revision += 1;
  state.updatedAt = now;
  validateManorFarm(state);
  return state;
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
  if (state.schemaVersion !== 8) throw new Error("庄园存档版本无效");
  for (const [label, value] of [
    ["修订号", state.revision],
    ["金币", state.coins],
    ["经验", state.experience],
    ["随机状态", state.randomState],
    ["升级奖励进度", state.rewardedThroughOriginalLevel],
    ["已开垦土地数量", state.unlockedPlotCount],
    ["创建时间", state.createdAt],
    ["更新时间", state.updatedAt]
  ] as const) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${label}无效`);
  }
  if (typeof state.starterGiftClaimed !== "boolean") throw new Error("新手礼包状态无效");
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
      plot.fertilizedStage !== undefined
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
      pest: false
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
      pest: false
    };
  }
  if (!plot.plantedAt || !plot.readyAt) throw new Error("作物时间无效");
  const duration = plot.readyAt - plot.plantedAt;
  const progress = Math.max(0, Math.min(1, (now - plot.plantedAt) / duration));
  const sproutThreshold = crop.growthStageSeconds[0] ?? 0;
  const growingThreshold = crop.growthStageSeconds[2] ?? crop.growthSeconds;
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
    pest: isCareEventActive(plot.pestAt, plot.pestClearedAt, now),
    ...(plot.fertilizedStage === undefined ? {} : { fertilizedStage: plot.fertilizedStage }),
    visualStageThresholds: plot.harvestedCycles && plot.harvestedCycles > 0
      ? [0, 0]
      : [
          sproutThreshold / crop.growthSeconds,
          growingThreshold / crop.growthSeconds
        ],
    estimatedYield: estimatedYield(plot, crop, now, timeScale)
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
      careEventPenalty(plot.weedAt, plot.weedClearedAt, now, interval, 1) +
      careEventPenalty(plot.pestAt, plot.pestClearedAt, now, interval, 1)
  );
  return Math.max(1, Math.ceil(crop.baseYield * (100 - penalty) / 100));
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
  clearCareState(plot);
}

function clearCareState(plot: ManorPlotState): void {
  delete plot.dryAt;
  delete plot.wateredAt;
  delete plot.weedAt;
  delete plot.weedClearedAt;
  delete plot.pestAt;
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
  clearCareState(plot);
  plot.plantedAt = now;
  plot.readyAt = now + duration;
  if (dry.value < 0.55) plot.dryAt = now + Math.round(duration * (0.2 + dry.value * 0.4));
  if (weed.value < 0.6) plot.weedAt = now + Math.round(duration * (0.28 + weed.value * 0.35));
  if (pest.value < 0.5) plot.pestAt = now + Math.round(duration * (0.5 + pest.value * 0.4));
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
    seeds: { ...state.seeds },
    produce: { ...state.produce },
    plots: state.plots.map((plot) => ({ ...plot })),
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

function migratePlot(value: unknown, schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): ManorPlotState {
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
    ...optionalTimestamp("weedClearedAt", plot.weedClearedAt),
    ...optionalTimestamp("pestAt", plot.pestAt),
    ...optionalTimestamp("pestClearedAt", plot.pestClearedAt),
    ...(schemaVersion >= 4 && plot.fertilizedStage !== undefined
      ? { fertilizedStage: integer(plot.fertilizedStage, "施肥阶段") }
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
