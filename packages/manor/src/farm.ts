import type {
  ManorActionRequest,
  ManorCropId,
  ManorCropView,
  ManorFarmView,
  ManorPlotView
} from "@party-games/shared";
import { MANOR_CROP_DATA } from "./crops.generated.js";

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
  wateredAt?: number;
  weedAt?: number;
  weedClearedAt?: number;
  pestAt?: number;
  pestClearedAt?: number;
}

export interface ManorFarmState {
  schemaVersion: 3;
  revision: number;
  coins: number;
  experience: number;
  randomState: number;
  seeds: Record<ManorCropId, number>;
  produce: Record<ManorCropId, number>;
  plots: ManorPlotState[];
  createdAt: number;
  updatedAt: number;
}

export interface ManorRuntimeOptions {
  timeScale?: number;
  legacyBackgroundUrl?: string;
}

export const MANOR_PLOT_COUNT = 18;

type PersistedManorFarm = Omit<Partial<ManorFarmState>, "schemaVersion"> & {
  schemaVersion?: 1 | 2 | 3;
};

export function createManorFarm(now: number, seedSource: string): ManorFarmState {
  const state: ManorFarmState = {
    schemaVersion: 3,
    revision: 0,
    coins: 120,
    experience: 0,
    randomState: hashSeed(seedSource),
    seeds: cropRecord({ radish: 3 }),
    produce: cropRecord(),
    plots: createEmptyPlots(),
    createdAt: now,
    updatedAt: now
  };
  validateManorFarm(state);
  return state;
}

export function migrateManorFarm(value: unknown): ManorFarmState {
  if (!value || typeof value !== "object") throw new Error("庄园存档格式无效");
  const candidate = value as PersistedManorFarm;
  if (candidate.schemaVersion !== 1 && candidate.schemaVersion !== 2 && candidate.schemaVersion !== 3) {
    throw new Error("庄园存档版本不受支持");
  }
  const migratedPlots = Array.isArray(candidate.plots)
    ? candidate.plots.map((plot) => migratePlot(plot))
    : [];
  const plots = candidate.schemaVersion === 1
    ? migrateSixPlotFarm(migratedPlots)
    : migratedPlots;
  const state: ManorFarmState = {
    schemaVersion: 3,
    revision: integer(candidate.revision, "存档修订号"),
    coins: integer(candidate.coins, "金币"),
    experience: integer(candidate.experience, "经验"),
    randomState: integer(candidate.randomState, "随机状态") >>> 0,
    seeds: migrateInventory(candidate.seeds, "种子"),
    produce: migrateInventory(candidate.produce, "仓库"),
    plots,
    createdAt: timestamp(candidate.createdAt, "创建时间"),
    updatedAt: timestamp(candidate.updatedAt, "更新时间")
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
      if (plot.wateredAt) throw new Error("这块土地已经浇过水");
      plot.wateredAt = now;
      break;
    }
    case "clear-weed": {
      ensureGrowing(plot);
      if (!plot.weedAt || plot.weedAt > now) throw new Error("当前没有杂草");
      if (plot.weedClearedAt) throw new Error("杂草已经清除");
      plot.weedClearedAt = now;
      break;
    }
    case "clear-pest": {
      ensureGrowing(plot);
      if (!plot.pestAt || plot.pestAt > now) throw new Error("当前没有害虫");
      if (plot.pestClearedAt) throw new Error("害虫已经清除");
      plot.pestClearedAt = now;
      break;
    }
    case "harvest": {
      ensurePlanted(plot);
      if (plot.witheredAt) throw new Error("作物已经枯萎，请用锄头清理");
      if (!plot.readyAt || plot.readyAt > now) throw new Error("作物尚未成熟");
      const plantedCrop = cropById(plot.cropId);
      const yieldCount = estimatedYield(plot, plantedCrop, now);
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
    case "sell": {
      if (!crop) throw new Error("作物不存在");
      if (state.produce[crop.id] < action.quantity) throw new Error("仓库数量不足");
      state.produce[crop.id] -= action.quantity;
      state.coins += crop.salePrice * action.quantity;
      break;
    }
  }

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
    unlocked: level >= crop.levelRequired,
    seeds: state.seeds[crop.id],
    produce: state.produce[crop.id]
  }));
  const plots: ManorPlotView[] = state.plots.map((plot) => toPlotView(plot, now));
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
    catalog,
    plots,
    art: options.legacyBackgroundUrl
      ? { source: "legacy", backgroundUrl: options.legacyBackgroundUrl }
      : { source: "built-in" }
  };
}

export function validateManorFarm(state: ManorFarmState): void {
  if (state.schemaVersion !== 3) throw new Error("庄园存档版本无效");
  for (const [label, value] of [
    ["修订号", state.revision],
    ["金币", state.coins],
    ["经验", state.experience],
    ["随机状态", state.randomState],
    ["创建时间", state.createdAt],
    ["更新时间", state.updatedAt]
  ] as const) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${label}无效`);
  }
  if (state.plots.length !== MANOR_PLOT_COUNT) throw new Error("庄园土地数量无效");
  const ids = new Set<number>();
  for (const plot of state.plots) {
    if (!Number.isInteger(plot.id) || plot.id < 1 || plot.id > MANOR_PLOT_COUNT || ids.has(plot.id)) {
      throw new Error("土地编号无效");
    }
    ids.add(plot.id);
    if (!Number.isInteger(plot.cycle) || plot.cycle < 0) throw new Error("土地轮次无效");
    if (plot.cropId) {
      const crop = cropById(plot.cropId);
      const harvestedCycles = plot.harvestedCycles;
      if (harvestedCycles === undefined || !Number.isInteger(harvestedCycles) || harvestedCycles < 0 || harvestedCycles > crop.harvestCycles) {
        throw new Error("作物收获季数无效");
      }
      if (plot.witheredAt) {
        if (harvestedCycles !== crop.harvestCycles || plot.plantedAt || plot.readyAt) {
          throw new Error("枯萎作物状态无效");
        }
      } else if (!plot.plantedAt || !plot.readyAt || plot.readyAt <= plot.plantedAt) {
        throw new Error("作物时间无效");
      }
    } else if (plot.harvestedCycles !== undefined || plot.plantedAt || plot.readyAt || plot.witheredAt) {
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

function toPlotView(plot: ManorPlotState, now: number): ManorPlotView {
  if (!plot.cropId) {
    return { id: plot.id, status: "empty", progress: 0, watered: false, weed: false, pest: false };
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
  return {
    id: plot.id,
    status: now >= plot.readyAt ? "mature" : "growing",
    ...cropDetails,
    plantedAt: plot.plantedAt,
    readyAt: plot.readyAt,
    progress,
    watered: Boolean(plot.wateredAt),
    weed: Boolean(plot.weedAt && plot.weedAt <= now && !plot.weedClearedAt),
    pest: Boolean(plot.pestAt && plot.pestAt <= now && !plot.pestClearedAt),
    estimatedYield: estimatedYield(plot, crop, now)
  };
}

function estimatedYield(plot: ManorPlotState, crop: ManorCropDefinition, now: number): number {
  let value = crop.baseYield;
  if (!plot.wateredAt) value -= 1;
  if (plot.weedAt && plot.weedAt <= now && !plot.weedClearedAt) value -= 1;
  if (plot.pestAt && plot.pestAt <= now && !plot.pestClearedAt) value -= 1;
  return Math.max(1, value);
}

function cropById(id: ManorCropId): ManorCropDefinition {
  const crop = MANOR_CROPS.find((candidate) => candidate.id === id);
  if (!crop) throw new Error("作物不存在");
  return crop;
}

function plotById(state: ManorFarmState, id: number): ManorPlotState {
  const plot = state.plots.find((candidate) => candidate.id === id);
  if (!plot) throw new Error("土地不存在");
  return plot;
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
  delete plot.wateredAt;
  delete plot.weedAt;
  delete plot.weedClearedAt;
  delete plot.pestAt;
  delete plot.pestClearedAt;
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
  const weed = nextRandom(state.randomState);
  const pest = nextRandom(weed.state);
  state.randomState = pest.state;
  delete plot.witheredAt;
  clearCareState(plot);
  plot.plantedAt = now;
  plot.readyAt = now + duration;
  if (weed.value < 0.6) plot.weedAt = now + Math.round(duration * (0.28 + weed.value * 0.35));
  if (pest.value < 0.5) plot.pestAt = now + Math.round(duration * (0.5 + pest.value * 0.4));
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

function cropRecord(initial: Partial<Record<ManorCropId, number>> = {}): Record<ManorCropId, number> {
  return Object.fromEntries(
    MANOR_CROPS.map((crop) => [crop.id, initial[crop.id] ?? 0])
  ) as Record<ManorCropId, number>;
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
    seeds: { ...state.seeds },
    produce: { ...state.produce },
    plots: state.plots.map((plot) => ({ ...plot }))
  };
}

function migrateInventory(
  value: Partial<Record<ManorCropId, number>> | undefined,
  label: string
): Record<ManorCropId, number> {
  const result = cropRecord(value);
  for (const crop of MANOR_CROPS) result[crop.id] = integer(result[crop.id], label);
  return result;
}

function migratePlot(value: unknown): ManorPlotState {
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
    ...optionalTimestamp("wateredAt", plot.wateredAt),
    ...optionalTimestamp("weedAt", plot.weedAt),
    ...optionalTimestamp("weedClearedAt", plot.weedClearedAt),
    ...optionalTimestamp("pestAt", plot.pestAt),
    ...optionalTimestamp("pestClearedAt", plot.pestClearedAt)
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
