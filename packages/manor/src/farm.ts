import type {
  ManorActionRequest,
  ManorCropId,
  ManorCropView,
  ManorFarmView,
  ManorPlotView
} from "@party-games/shared";

export interface ManorCropDefinition {
  id: ManorCropId;
  name: string;
  emoji: string;
  levelRequired: number;
  seedPrice: number;
  salePrice: number;
  growthSeconds: number;
  baseYield: number;
  experience: number;
}

export const MANOR_CROPS: readonly ManorCropDefinition[] = [
  {
    id: "radish",
    name: "白萝卜",
    emoji: "萝",
    levelRequired: 1,
    seedPrice: 10,
    salePrice: 6,
    growthSeconds: 120,
    baseYield: 4,
    experience: 4
  },
  {
    id: "carrot",
    name: "胡萝卜",
    emoji: "胡",
    levelRequired: 2,
    seedPrice: 20,
    salePrice: 8,
    growthSeconds: 300,
    baseYield: 5,
    experience: 7
  },
  {
    id: "corn",
    name: "玉米",
    emoji: "玉",
    levelRequired: 3,
    seedPrice: 35,
    salePrice: 10,
    growthSeconds: 600,
    baseYield: 6,
    experience: 11
  },
  {
    id: "tomato",
    name: "番茄",
    emoji: "番",
    levelRequired: 4,
    seedPrice: 60,
    salePrice: 12,
    growthSeconds: 1_200,
    baseYield: 8,
    experience: 16
  }
];

export interface ManorPlotState {
  id: number;
  cycle: number;
  cropId?: ManorCropId;
  plantedAt?: number;
  readyAt?: number;
  wateredAt?: number;
  weedAt?: number;
  weedClearedAt?: number;
  pestAt?: number;
  pestClearedAt?: number;
}

export interface ManorFarmState {
  schemaVersion: 1;
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

export function createManorFarm(now: number, seedSource: string): ManorFarmState {
  const state: ManorFarmState = {
    schemaVersion: 1,
    revision: 0,
    coins: 120,
    experience: 0,
    randomState: hashSeed(seedSource),
    seeds: cropRecord({ radish: 3 }),
    produce: cropRecord(),
    plots: Array.from({ length: 6 }, (_, index) => ({ id: index + 1, cycle: 0 })),
    createdAt: now,
    updatedAt: now
  };
  validateManorFarm(state);
  return state;
}

export function migrateManorFarm(value: unknown): ManorFarmState {
  if (!value || typeof value !== "object") throw new Error("庄园存档格式无效");
  const candidate = value as Partial<ManorFarmState>;
  if (candidate.schemaVersion !== 1) throw new Error("庄园存档版本不受支持");
  const state: ManorFarmState = {
    schemaVersion: 1,
    revision: integer(candidate.revision, "存档修订号"),
    coins: integer(candidate.coins, "金币"),
    experience: integer(candidate.experience, "经验"),
    randomState: integer(candidate.randomState, "随机状态") >>> 0,
    seeds: migrateInventory(candidate.seeds, "种子"),
    produce: migrateInventory(candidate.produce, "仓库"),
    plots: Array.isArray(candidate.plots)
      ? candidate.plots.map((plot) => migratePlot(plot))
      : [],
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
      if (level < crop.levelRequired) throw new Error(`达到 ${crop.levelRequired} 级后解锁`);
      if (state.seeds[crop.id] < 1) throw new Error("种子不足");
      state.seeds[crop.id] -= 1;
      const duration = growthDurationMs(crop, options.timeScale);
      const weed = nextRandom(state.randomState);
      const pest = nextRandom(weed.state);
      state.randomState = pest.state;
      plot.cropId = crop.id;
      plot.plantedAt = now;
      plot.readyAt = now + duration;
      plot.cycle += 1;
      if (weed.value < 0.6) plot.weedAt = now + Math.round(duration * (0.28 + weed.value * 0.35));
      if (pest.value < 0.5) plot.pestAt = now + Math.round(duration * (0.5 + pest.value * 0.4));
      break;
    }
    case "water": {
      ensurePlanted(plot);
      if (plot.wateredAt) throw new Error("这块土地已经浇过水");
      plot.wateredAt = now;
      break;
    }
    case "clear-weed": {
      ensurePlanted(plot);
      if (!plot.weedAt || plot.weedAt > now) throw new Error("当前没有杂草");
      if (plot.weedClearedAt) throw new Error("杂草已经清除");
      plot.weedClearedAt = now;
      break;
    }
    case "clear-pest": {
      ensurePlanted(plot);
      if (!plot.pestAt || plot.pestAt > now) throw new Error("当前没有害虫");
      if (plot.pestClearedAt) throw new Error("害虫已经清除");
      plot.pestClearedAt = now;
      break;
    }
    case "harvest": {
      ensurePlanted(plot);
      if (!plot.readyAt || plot.readyAt > now) throw new Error("作物尚未成熟");
      const plantedCrop = cropById(plot.cropId);
      const yieldCount = estimatedYield(plot, plantedCrop, now);
      state.produce[plantedCrop.id] += yieldCount;
      state.experience += plantedCrop.experience;
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
  if (state.schemaVersion !== 1) throw new Error("庄园存档版本无效");
  for (const [label, value] of [
    ["修订号", state.revision],
    ["金币", state.coins],
    ["经验", state.experience],
    ["创建时间", state.createdAt],
    ["更新时间", state.updatedAt]
  ] as const) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${label}无效`);
  }
  if (state.plots.length !== 6) throw new Error("庄园土地数量无效");
  const ids = new Set<number>();
  for (const plot of state.plots) {
    if (!Number.isInteger(plot.id) || plot.id < 1 || plot.id > 6 || ids.has(plot.id)) {
      throw new Error("土地编号无效");
    }
    ids.add(plot.id);
    if (!Number.isInteger(plot.cycle) || plot.cycle < 0) throw new Error("土地轮次无效");
    if (plot.cropId) {
      cropById(plot.cropId);
      if (!plot.plantedAt || !plot.readyAt || plot.readyAt <= plot.plantedAt) {
        throw new Error("作物时间无效");
      }
    } else if (plot.plantedAt || plot.readyAt) {
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
  return 18 * (level - 1) * level;
}

function toPlotView(plot: ManorPlotState, now: number): ManorPlotView {
  if (!plot.cropId || !plot.plantedAt || !plot.readyAt) {
    return { id: plot.id, status: "empty", progress: 0, watered: false, weed: false, pest: false };
  }
  const crop = cropById(plot.cropId);
  const duration = plot.readyAt - plot.plantedAt;
  const progress = Math.max(0, Math.min(1, (now - plot.plantedAt) / duration));
  return {
    id: plot.id,
    status: now >= plot.readyAt ? "mature" : "growing",
    cropId: crop.id,
    cropName: crop.name,
    cropEmoji: crop.emoji,
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

function clearPlot(plot: ManorPlotState): void {
  delete plot.cropId;
  delete plot.plantedAt;
  delete plot.readyAt;
  delete plot.wateredAt;
  delete plot.weedAt;
  delete plot.weedClearedAt;
  delete plot.pestAt;
  delete plot.pestClearedAt;
}

function growthDurationMs(crop: ManorCropDefinition, timeScale = 1): number {
  const scale = Number.isFinite(timeScale) ? Math.max(1, Math.min(3_600, timeScale)) : 1;
  return Math.max(1_000, Math.round((crop.growthSeconds * 1_000) / scale));
}

function cropRecord(initial: Partial<Record<ManorCropId, number>> = {}): Record<ManorCropId, number> {
  return {
    radish: initial.radish ?? 0,
    carrot: initial.carrot ?? 0,
    corn: initial.corn ?? 0,
    tomato: initial.tomato ?? 0
  };
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
    ...optionalTimestamp("plantedAt", plot.plantedAt),
    ...optionalTimestamp("readyAt", plot.readyAt),
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
