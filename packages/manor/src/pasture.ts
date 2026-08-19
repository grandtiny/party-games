import type {
  ManorAnimalCatalogView,
  ManorAnimalHouse,
  ManorAnimalSourceId,
  ManorAnimalView,
  ManorAnimalVisualState,
  ManorPastureActionRequest,
  ManorPastureInventoryView,
  ManorPastureView
} from "@party-games/shared";
import { MANOR_ANIMAL_DATA } from "./animals.generated.js";

export interface ManorAnimalDefinition {
  sourceId: ManorAnimalSourceId;
  name: string;
  levelRequired: number;
  category: ManorAnimalHouse;
  purchasePrice: number;
  configuredAnimalSalePrice: number;
  animalSalePrice: number;
  animalHarvestExperience: number;
  animalUnit: string;
  productionAction: string;
  byproductName: string;
  configuredByproductSalePrice: number;
  byproductSalePrice: number;
  byproductHarvestExperience: number;
  byproductUnit: string;
  baseYield: number;
  grassPerFourHours: number;
  cubSeconds: number;
  maturitySeconds: number;
  productionLifetimeSeconds: number;
  lifecycleSeconds: number;
  productionCycleSeconds: number;
  productionActionSeconds: number;
  description: string;
  audioVariants: readonly number[];
}

export interface ManorPastureAnimalState {
  serial: number;
  sourceId: ManorAnimalSourceId;
  growthSeconds: number;
  pendingProduct: number;
  productionStartedAtGrowth?: number;
}

export interface ManorPastureState {
  schemaVersion: 1;
  experience: number;
  grass: number;
  hutchLevel: number;
  shedLevel: number;
  nextAnimalSerial: number;
  animals: ManorPastureAnimalState[];
  byproducts: Partial<Record<ManorAnimalSourceId, number>>;
  harvestedAnimals: Partial<Record<ManorAnimalSourceId, number>>;
  updatedAt: number;
}

export interface ManorPastureRuntimeOptions {
  timeScale?: number;
}

export interface ManorPastureActionResult {
  pasture: ManorPastureState;
  coins: number;
}

export interface ManorPastureHouseUpgrade {
  level: number;
  originalLevelRequired: number;
  displayLevelRequired: number;
  coinCost: number;
  capacity: number;
}

export const MANOR_ANIMALS: readonly ManorAnimalDefinition[] = MANOR_ANIMAL_DATA;
export const MANOR_GRASS_CAPACITY = 400;
export const MANOR_GRASS_PRICE = 60;

export const MANOR_HUTCH_UPGRADES: readonly ManorPastureHouseUpgrade[] = [
  { level: 1, originalLevelRequired: 0, displayLevelRequired: 1, coinCost: 0, capacity: 2 },
  { level: 2, originalLevelRequired: 1, displayLevelRequired: 2, coinCost: 3_000, capacity: 3 },
  { level: 3, originalLevelRequired: 4, displayLevelRequired: 5, coinCost: 20_000, capacity: 5 },
  { level: 4, originalLevelRequired: 8, displayLevelRequired: 9, coinCost: 60_000, capacity: 6 },
  { level: 5, originalLevelRequired: 12, displayLevelRequired: 13, coinCost: 120_000, capacity: 7 },
  { level: 6, originalLevelRequired: 16, displayLevelRequired: 17, coinCost: 210_000, capacity: 8 },
  { level: 7, originalLevelRequired: 20, displayLevelRequired: 21, coinCost: 300_000, capacity: 9 },
  { level: 8, originalLevelRequired: 24, displayLevelRequired: 25, coinCost: 400_000, capacity: 10 }
];

export const MANOR_SHED_UPGRADES: readonly ManorPastureHouseUpgrade[] = [
  { level: 0, originalLevelRequired: 0, displayLevelRequired: 1, coinCost: 0, capacity: 0 },
  { level: 1, originalLevelRequired: 2, displayLevelRequired: 3, coinCost: 5_000, capacity: 3 },
  { level: 2, originalLevelRequired: 6, displayLevelRequired: 7, coinCost: 40_000, capacity: 4 },
  { level: 3, originalLevelRequired: 10, displayLevelRequired: 11, coinCost: 90_000, capacity: 5 },
  { level: 4, originalLevelRequired: 14, displayLevelRequired: 15, coinCost: 160_000, capacity: 6 },
  { level: 5, originalLevelRequired: 18, displayLevelRequired: 19, coinCost: 250_000, capacity: 7 },
  { level: 6, originalLevelRequired: 22, displayLevelRequired: 23, coinCost: 350_000, capacity: 8 },
  { level: 7, originalLevelRequired: 26, displayLevelRequired: 27, coinCost: 500_000, capacity: 9 },
  { level: 8, originalLevelRequired: 28, displayLevelRequired: 29, coinCost: 700_000, capacity: 10 }
];

export function createManorPasture(now: number): ManorPastureState {
  const rabbit = manorAnimalById(1002);
  const state: ManorPastureState = {
    schemaVersion: 1,
    experience: 0,
    grass: 20,
    hutchLevel: 1,
    shedLevel: 0,
    nextAnimalSerial: 3,
    animals: [
      {
        serial: 1,
        sourceId: rabbit.sourceId,
        growthSeconds: rabbit.lifecycleSeconds,
        pendingProduct: 0
      },
      {
        serial: 2,
        sourceId: rabbit.sourceId,
        growthSeconds: rabbit.maturitySeconds + 1,
        pendingProduct: 0
      }
    ],
    byproducts: {},
    harvestedAnimals: {},
    updatedAt: now
  };
  validateManorPasture(state);
  return state;
}

export function migrateManorPasture(value: unknown, fallbackNow: number): ManorPastureState {
  if (value === undefined) return createManorPasture(fallbackNow);
  if (!value || typeof value !== "object") throw new Error("牧场存档格式无效");
  const state = value as ManorPastureState;
  if (state.schemaVersion !== 1) throw new Error("牧场存档版本不受支持");
  const migrated: ManorPastureState = {
    ...state,
    animals: state.animals.map((animal) => ({ ...animal })),
    byproducts: { ...state.byproducts },
    harvestedAnimals: { ...state.harvestedAnimals }
  };
  validateManorPasture(migrated);
  return migrated;
}

export function advanceManorPasture(
  state: ManorPastureState,
  now: number,
  options: ManorPastureRuntimeOptions = {}
): ManorPastureState {
  const next = clonePasture(state);
  if (now <= next.updatedAt) return next;
  const timeScale = normalizeTimeScale(options.timeScale);
  const elapsedSeconds = ((now - next.updatedAt) / 1_000) * timeScale;
  const freeAnimals = next.animals.filter((animal) => {
    const definition = manorAnimalById(animal.sourceId);
    return definition.grassPerFourHours === 0 && animal.growthSeconds < definition.lifecycleSeconds;
  });
  for (const animal of freeAnimals) {
    const definition = manorAnimalById(animal.sourceId);
    animal.growthSeconds = Math.min(
      definition.lifecycleSeconds,
      animal.growthSeconds + elapsedSeconds
    );
  }

  let remaining = elapsedSeconds;
  while (remaining > 1e-6 && next.grass > 1e-9) {
    const consumers = next.animals.filter((animal) => {
      const definition = manorAnimalById(animal.sourceId);
      return definition.grassPerFourHours > 0 && animal.growthSeconds < definition.lifecycleSeconds;
    });
    if (consumers.length === 0) break;
    const grassPerSecond = consumers.reduce(
      (total, animal) => total + manorAnimalById(animal.sourceId).grassPerFourHours / 14_400,
      0
    );
    const secondsUntilFirstCompletion = Math.min(
      ...consumers.map((animal) => {
        const definition = manorAnimalById(animal.sourceId);
        return definition.lifecycleSeconds - animal.growthSeconds;
      })
    );
    const secondsUntilGrassRunsOut = next.grass / grassPerSecond;
    const step = Math.min(remaining, secondsUntilFirstCompletion, secondsUntilGrassRunsOut);
    if (step <= 1e-9) break;
    for (const animal of consumers) {
      const definition = manorAnimalById(animal.sourceId);
      animal.growthSeconds = Math.min(definition.lifecycleSeconds, animal.growthSeconds + step);
    }
    next.grass = Math.max(0, next.grass - grassPerSecond * step);
    remaining -= step;
  }
  next.grass = roundGrass(next.grass);
  next.updatedAt = now;
  validateManorPasture(next);
  return next;
}

export function applyManorPastureAction(
  state: ManorPastureState,
  coins: number,
  action: ManorPastureActionRequest,
  now: number,
  options: ManorPastureRuntimeOptions = {}
): ManorPastureActionResult {
  const pasture = advanceManorPasture(state, now, options);
  let nextCoins = coins;
  switch (action.type) {
    case "buy-animal": {
      const definition = manorAnimalById(action.animalId);
      const level = levelForPastureExperience(pasture.experience);
      if (level < definition.levelRequired) {
        throw new Error(`${definition.name}需要牧场达到 ${definition.levelRequired} 级`);
      }
      const capacity = houseCapacity(pasture, definition.category);
      const occupied = occupiedHouseSlots(pasture, definition.category);
      if (occupied + action.quantity > capacity) {
        throw new Error(`${definition.category === "hutch" ? "窝" : "棚"}的空位不足`);
      }
      const cost = definition.purchasePrice * action.quantity;
      if (nextCoins < cost) throw new Error("金币不足");
      nextCoins -= cost;
      for (let index = 0; index < action.quantity; index += 1) {
        pasture.animals.push({
          serial: pasture.nextAnimalSerial,
          sourceId: definition.sourceId,
          growthSeconds: 0,
          pendingProduct: 0
        });
        pasture.nextAnimalSerial += 1;
      }
      pasture.experience += action.quantity * 5;
      break;
    }
    case "buy-grass": {
      const available = Math.floor(MANOR_GRASS_CAPACITY - pasture.grass + 1e-6);
      if (available <= 0) throw new Error("饲料机已经加满");
      const quantity = Math.min(action.quantity, available);
      const cost = quantity * MANOR_GRASS_PRICE;
      if (nextCoins < cost) throw new Error("金币不足");
      nextCoins -= cost;
      pasture.grass = roundGrass(pasture.grass + quantity);
      break;
    }
    case "start-animal-production": {
      const animal = pastureAnimalBySerial(pasture, action.animalSerial);
      const definition = manorAnimalById(animal.sourceId);
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
      pasture.experience += 5;
      break;
    }
    case "harvest-animal-product": {
      const animal = pastureAnimalBySerial(pasture, action.animalSerial);
      if (animal.pendingProduct <= 0) throw new Error("没有可收获的副产品");
      const definition = manorAnimalById(animal.sourceId);
      pasture.byproducts[definition.sourceId] =
        (pasture.byproducts[definition.sourceId] ?? 0) + animal.pendingProduct;
      animal.pendingProduct = 0;
      pasture.experience += definition.byproductHarvestExperience;
      break;
    }
    case "harvest-animal": {
      const animalIndex = pasture.animals.findIndex(
        (candidate) => candidate.serial === action.animalSerial
      );
      if (animalIndex < 0) throw new Error("动物不存在");
      const animal = pasture.animals[animalIndex]!;
      const definition = manorAnimalById(animal.sourceId);
      if (animal.growthSeconds < definition.lifecycleSeconds) throw new Error("动物还未到收获时间");
      if (animal.pendingProduct > 0) throw new Error(`请先收获${definition.byproductName}`);
      pasture.animals.splice(animalIndex, 1);
      pasture.harvestedAnimals[definition.sourceId] =
        (pasture.harvestedAnimals[definition.sourceId] ?? 0) + 1;
      pasture.experience += definition.animalHarvestExperience;
      break;
    }
    case "sell-pasture-item": {
      const definition = manorAnimalById(action.animalId);
      const inventory =
        action.itemType === "byproduct" ? pasture.byproducts : pasture.harvestedAnimals;
      const available = inventory[definition.sourceId] ?? 0;
      if (available < action.quantity) throw new Error("牧场仓库数量不足");
      inventory[definition.sourceId] = available - action.quantity;
      const price =
        action.itemType === "byproduct"
          ? definition.byproductSalePrice
          : definition.animalSalePrice;
      nextCoins += price * action.quantity;
      break;
    }
    case "upgrade-animal-house": {
      const upgrades = action.house === "hutch" ? MANOR_HUTCH_UPGRADES : MANOR_SHED_UPGRADES;
      const currentLevel = action.house === "hutch" ? pasture.hutchLevel : pasture.shedLevel;
      const upgrade = upgrades.find((candidate) => candidate.level === currentLevel + 1);
      if (!upgrade) throw new Error("已经达到最高等级");
      const level = levelForPastureExperience(pasture.experience);
      if (level < upgrade.displayLevelRequired) {
        throw new Error(`牧场达到 ${upgrade.displayLevelRequired} 级后才能升级`);
      }
      if (nextCoins < upgrade.coinCost) throw new Error("金币不足");
      nextCoins -= upgrade.coinCost;
      if (action.house === "hutch") pasture.hutchLevel = upgrade.level;
      else pasture.shedLevel = upgrade.level;
      break;
    }
  }
  validateManorPasture(pasture);
  return { pasture, coins: nextCoins };
}

export function toManorPastureView(
  state: ManorPastureState,
  coins: number,
  revision: number,
  displayName: string,
  now: number,
  options: ManorPastureRuntimeOptions = {}
): ManorPastureView {
  const pasture = advanceManorPasture(state, now, options);
  const level = levelForPastureExperience(pasture.experience);
  const hutch = houseView(pasture, "hutch", level);
  const shed = houseView(pasture, "shed", level);
  return {
    serverTime: now,
    revision,
    profile: {
      displayName,
      coins,
      level,
      experience: pasture.experience,
      currentLevelExperience: experienceForPastureLevel(level),
      nextLevelExperience: experienceForPastureLevel(level + 1)
    },
    grass: pasture.grass,
    grassCapacity: MANOR_GRASS_CAPACITY,
    grassPrice: MANOR_GRASS_PRICE,
    houses: { hutch, shed },
    catalog: MANOR_ANIMALS.map((definition) => toCatalogView(definition, level)),
    animals: pasture.animals.map((animal) =>
      toAnimalView(animal, pasture, now, normalizeTimeScale(options.timeScale))
    ),
    inventory: MANOR_ANIMALS.map((definition) =>
      toInventoryView(definition, pasture)
    ).filter((item) => item.animalCount > 0 || item.byproductCount > 0)
  };
}

export function validateManorPasture(state: ManorPastureState): void {
  if (state.schemaVersion !== 1) throw new Error("牧场存档版本无效");
  if (!Number.isInteger(state.experience) || state.experience < 0) throw new Error("牧场经验无效");
  if (!Number.isFinite(state.grass) || state.grass < 0 || state.grass > MANOR_GRASS_CAPACITY) {
    throw new Error("牧草数量无效");
  }
  if (!Number.isInteger(state.hutchLevel) || state.hutchLevel < 1 || state.hutchLevel > 8) {
    throw new Error("动物窝等级无效");
  }
  if (!Number.isInteger(state.shedLevel) || state.shedLevel < 0 || state.shedLevel > 8) {
    throw new Error("动物棚等级无效");
  }
  if (!Number.isInteger(state.nextAnimalSerial) || state.nextAnimalSerial < 1) {
    throw new Error("动物序号无效");
  }
  if (!Number.isFinite(state.updatedAt) || state.updatedAt < 0) throw new Error("牧场更新时间无效");
  const serials = new Set<number>();
  for (const animal of state.animals) {
    if (!Number.isInteger(animal.serial) || animal.serial < 1 || serials.has(animal.serial)) {
      throw new Error("动物序号重复或无效");
    }
    serials.add(animal.serial);
    const definition = manorAnimalById(animal.sourceId);
    if (
      !Number.isFinite(animal.growthSeconds) ||
      animal.growthSeconds < 0 ||
      animal.growthSeconds > definition.lifecycleSeconds
    ) {
      throw new Error("动物成长时间无效");
    }
    if (!Number.isInteger(animal.pendingProduct) || animal.pendingProduct < 0) {
      throw new Error("动物待收产品无效");
    }
    if (
      animal.productionStartedAtGrowth !== undefined &&
      (!Number.isFinite(animal.productionStartedAtGrowth) ||
        animal.productionStartedAtGrowth < definition.maturitySeconds ||
        animal.productionStartedAtGrowth > animal.growthSeconds)
    ) {
      throw new Error("动物生产时间无效");
    }
  }
  for (const definition of MANOR_ANIMALS) {
    for (const inventory of [state.byproducts, state.harvestedAnimals]) {
      const count = inventory[definition.sourceId] ?? 0;
      if (!Number.isInteger(count) || count < 0) throw new Error("牧场仓库库存无效");
    }
  }
}

export function levelForPastureExperience(experience: number): number {
  let level = 1;
  while (level < 51 && experience >= experienceForPastureLevel(level + 1)) level += 1;
  return level;
}

export function experienceForPastureLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * (level - 1) * level;
}

function manorAnimalById(sourceId: number): ManorAnimalDefinition {
  const definition = MANOR_ANIMALS.find((candidate) => candidate.sourceId === sourceId);
  if (!definition) throw new Error("动物不存在");
  return definition;
}

function pastureAnimalBySerial(
  pasture: ManorPastureState,
  serial: number
): ManorPastureAnimalState {
  const animal = pasture.animals.find((candidate) => candidate.serial === serial);
  if (!animal) throw new Error("动物不存在");
  return animal;
}

function clonePasture(state: ManorPastureState): ManorPastureState {
  return {
    ...state,
    animals: state.animals.map((animal) => ({ ...animal })),
    byproducts: { ...state.byproducts },
    harvestedAnimals: { ...state.harvestedAnimals }
  };
}

function normalizeTimeScale(timeScale: number | undefined): number {
  if (timeScale === undefined) return 1;
  if (!Number.isFinite(timeScale) || timeScale <= 0) throw new Error("庄园时间倍率无效");
  return timeScale;
}

function roundGrass(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function houseCapacity(pasture: ManorPastureState, house: ManorAnimalHouse): number {
  const upgrades = house === "hutch" ? MANOR_HUTCH_UPGRADES : MANOR_SHED_UPGRADES;
  const level = house === "hutch" ? pasture.hutchLevel : pasture.shedLevel;
  return upgrades.find((candidate) => candidate.level === level)?.capacity ?? 0;
}

function occupiedHouseSlots(pasture: ManorPastureState, house: ManorAnimalHouse): number {
  return pasture.animals.filter(
    (animal) => manorAnimalById(animal.sourceId).category === house
  ).length;
}

function houseView(
  pasture: ManorPastureState,
  house: ManorAnimalHouse,
  level: number
): ManorPastureView["houses"][ManorAnimalHouse] {
  const upgrades = house === "hutch" ? MANOR_HUTCH_UPGRADES : MANOR_SHED_UPGRADES;
  const currentLevel = house === "hutch" ? pasture.hutchLevel : pasture.shedLevel;
  const next = upgrades.find((candidate) => candidate.level === currentLevel + 1);
  return {
    level: currentLevel,
    capacity: houseCapacity(pasture, house),
    occupied: occupiedHouseSlots(pasture, house),
    ...(next
      ? { nextUpgrade: { levelRequired: next.displayLevelRequired, coinCost: next.coinCost } }
      : {})
  };
}

function toCatalogView(
  definition: ManorAnimalDefinition,
  level: number
): ManorAnimalCatalogView {
  return {
    sourceId: definition.sourceId,
    name: definition.name,
    levelRequired: definition.levelRequired,
    category: definition.category,
    purchasePrice: definition.purchasePrice,
    animalSalePrice: definition.animalSalePrice,
    animalHarvestExperience: definition.animalHarvestExperience,
    animalUnit: definition.animalUnit,
    productionAction: definition.productionAction,
    byproductName: definition.byproductName,
    byproductSalePrice: definition.byproductSalePrice,
    byproductHarvestExperience: definition.byproductHarvestExperience,
    byproductUnit: definition.byproductUnit,
    baseYield: definition.baseYield,
    grassPerFourHours: definition.grassPerFourHours,
    cubSeconds: definition.cubSeconds,
    maturitySeconds: definition.maturitySeconds,
    lifecycleSeconds: definition.lifecycleSeconds,
    productionCycleSeconds: definition.productionCycleSeconds,
    productionActionSeconds: definition.productionActionSeconds,
    description: definition.description,
    audioUrls: audioUrls(definition),
    unlocked: level >= definition.levelRequired
  };
}

function toAnimalView(
  animal: ManorPastureAnimalState,
  pasture: ManorPastureState,
  now: number,
  timeScale: number
): ManorAnimalView {
  const definition = manorAnimalById(animal.sourceId);
  const visualState = animalVisualState(animal, definition);
  const hungry =
    definition.grassPerFourHours > 0 &&
    pasture.grass <= 1e-9 &&
    animal.growthSeconds < definition.lifecycleSeconds;
  const canStartProduction =
    animal.growthSeconds >= definition.maturitySeconds &&
    animal.growthSeconds < definition.lifecycleSeconds &&
    (animal.productionStartedAtGrowth === undefined ||
      animal.growthSeconds >=
        animal.productionStartedAtGrowth + definition.productionCycleSeconds);
  const nextGrowthSeconds = nextVisualStateGrowth(animal, definition, visualState);
  return {
    serial: animal.serial,
    sourceId: definition.sourceId,
    name: definition.name,
    category: definition.category,
    visualState,
    hungry,
    growthSeconds: Math.floor(animal.growthSeconds),
    growthProgress: Math.min(1, animal.growthSeconds / definition.lifecycleSeconds),
    ...(nextGrowthSeconds !== undefined && !hungry
      ? { nextStateAt: now + ((nextGrowthSeconds - animal.growthSeconds) / timeScale) * 1_000 }
      : {}),
    pendingProduct: animal.pendingProduct,
    byproductName: definition.byproductName,
    productionAction: definition.productionAction,
    canStartProduction,
    canHarvestProduct: animal.pendingProduct > 0,
    canHarvestAnimal:
      animal.growthSeconds >= definition.lifecycleSeconds && animal.pendingProduct === 0,
    audioUrls: audioUrls(definition)
  };
}

function animalVisualState(
  animal: ManorPastureAnimalState,
  definition: ManorAnimalDefinition
): ManorAnimalVisualState {
  if (animal.growthSeconds >= definition.lifecycleSeconds) return "lifecycle_complete";
  if (animal.growthSeconds < definition.cubSeconds) return "cub";
  if (animal.growthSeconds < definition.maturitySeconds) return "growing";
  if (animal.productionStartedAtGrowth !== undefined) {
    const sinceProduction = animal.growthSeconds - animal.productionStartedAtGrowth;
    if (sinceProduction < definition.productionActionSeconds) return "production_early";
    if (sinceProduction < definition.productionCycleSeconds) return "production_late";
  }
  return "ready_to_produce";
}

function nextVisualStateGrowth(
  animal: ManorPastureAnimalState,
  definition: ManorAnimalDefinition,
  visualState: ManorAnimalVisualState
): number | undefined {
  switch (visualState) {
    case "cub":
      return definition.cubSeconds;
    case "growing":
      return definition.maturitySeconds;
    case "production_early":
      return (animal.productionStartedAtGrowth ?? 0) + definition.productionActionSeconds;
    case "production_late":
      return (animal.productionStartedAtGrowth ?? 0) + definition.productionCycleSeconds;
    case "ready_to_produce":
      return definition.lifecycleSeconds;
    case "lifecycle_complete":
      return undefined;
  }
}

function toInventoryView(
  definition: ManorAnimalDefinition,
  pasture: ManorPastureState
): ManorPastureInventoryView {
  return {
    animalId: definition.sourceId,
    animalName: definition.name,
    animalCount: pasture.harvestedAnimals[definition.sourceId] ?? 0,
    animalSalePrice: definition.animalSalePrice,
    byproductName: definition.byproductName,
    byproductCount: pasture.byproducts[definition.sourceId] ?? 0,
    byproductSalePrice: definition.byproductSalePrice
  };
}

function audioUrls(definition: ManorAnimalDefinition): string[] {
  return definition.audioVariants.map(
    (variant) => `/assets/manor/classic/pasture/audio/${definition.sourceId}/${variant}.mp3`
  );
}
