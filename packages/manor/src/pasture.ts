import type {
  ManorAnimalCatalogView,
  ManorAnimalHouse,
  ManorAnimalSourceId,
  ManorAnimalView,
  ManorAnimalVisualState,
  ManorBusinessRecordView,
  ManorPastureActionRequest,
  ManorPastureInventoryView,
  ManorPastureView
} from "@party-games/shared";
import { MANOR_ANIMAL_DATA } from "./animals.generated.js";
import {
  MANOR_SPECIAL_FEED_LIMIT,
  cloneManorActivities,
  manorWeatherAt,
  validateManorActivities,
  type ManorActivityState
} from "./legacy.js";
import type { ManorBusinessTransaction } from "./business.js";

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
  productThiefUserIds: string[];
  stolenProduct: number;
  productionStartedAtGrowth?: number;
}

export interface ManorPastureState {
  schemaVersion: 3;
  experience: number;
  grass: number;
  hutchLevel: number;
  shedLevel: number;
  nextAnimalSerial: number;
  animals: ManorPastureAnimalState[];
  byproducts: Partial<Record<ManorAnimalSourceId, number>>;
  harvestedAnimals: Partial<Record<ManorAnimalSourceId, number>>;
  manure: number;
  poopCount: number;
  mosquitoSources: string[];
  nuisanceProgressSeconds: number;
  randomState: number;
  animalOrder: number[];
  activities: ManorActivityState[];
  updatedAt: number;
}

export interface ManorPastureRuntimeOptions {
  timeScale?: number;
  availableCarrots?: number;
  specialFeedRemaining?: number;
  businessRecords?: ManorBusinessRecordView[];
}

export interface ManorPastureActionResult {
  pasture: ManorPastureState;
  coins: number;
  carrotsConsumed: number;
  specialFeedsConsumed: number;
  businessTransactions: ManorBusinessTransaction[];
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
export const MANOR_MANURE_SALE_PRICE = 30;
export const MANOR_PASTURE_NUISANCE_INTERVAL_SECONDS = 21_600;
export const MANOR_PASTURE_POOP_LIMIT = 16;
export const MANOR_PASTURE_MOSQUITO_SCENE_LIMIT = 8;

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
    schemaVersion: 3,
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
        pendingProduct: 0,
        productThiefUserIds: [],
        stolenProduct: 0
      },
      {
        serial: 2,
        sourceId: rabbit.sourceId,
        growthSeconds: rabbit.maturitySeconds + 1,
        pendingProduct: 0,
        productThiefUserIds: [],
        stolenProduct: 0
      }
    ],
    byproducts: {},
    harvestedAnimals: {},
    manure: 0,
    poopCount: 0,
    mosquitoSources: [],
    nuisanceProgressSeconds: 0,
    randomState: hashPastureSeed(now),
    animalOrder: [1, 2],
    activities: [],
    updatedAt: now
  };
  validateManorPasture(state);
  return state;
}

export function migrateManorPasture(value: unknown, fallbackNow: number): ManorPastureState {
  if (value === undefined) return createManorPasture(fallbackNow);
  if (!value || typeof value !== "object") throw new Error("牧场存档格式无效");
  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2 && schemaVersion !== 3) {
    throw new Error("牧场存档版本不受支持");
  }
  const state = value as Omit<ManorPastureState, "schemaVersion" | "animals"> & {
    schemaVersion: 1 | 2 | 3;
    animals: Array<
      Omit<ManorPastureAnimalState, "productThiefUserIds" | "stolenProduct"> &
      Partial<Pick<ManorPastureAnimalState, "productThiefUserIds" | "stolenProduct">>
    >;
  };
  const migrated: ManorPastureState = {
    ...state,
    schemaVersion: 3,
    animals: state.animals.map((animal) => ({
      ...animal,
      productThiefUserIds: schemaVersion >= 2 ? [...(animal.productThiefUserIds ?? [])] : [],
      stolenProduct: schemaVersion >= 2 ? animal.stolenProduct ?? 0 : 0
    })),
    byproducts: { ...state.byproducts },
    harvestedAnimals: { ...state.harvestedAnimals },
    manure: schemaVersion >= 3 ? integerOrZero((state as Partial<ManorPastureState>).manure) : 0,
    poopCount: schemaVersion >= 3 ? integerOrZero((state as Partial<ManorPastureState>).poopCount) : 0,
    mosquitoSources: schemaVersion >= 3
      ? [...((state as Partial<ManorPastureState>).mosquitoSources ?? [])]
      : [],
    nuisanceProgressSeconds: schemaVersion >= 3
      ? finiteOrZero((state as Partial<ManorPastureState>).nuisanceProgressSeconds)
      : 0,
    randomState: schemaVersion >= 3
      ? integerOrZero((state as Partial<ManorPastureState>).randomState)
      : hashPastureSeed(fallbackNow),
    animalOrder: schemaVersion >= 3
      ? [...((state as Partial<ManorPastureState>).animalOrder ?? state.animals.map((animal) => animal.serial))]
      : state.animals.map((animal) => animal.serial),
    activities: schemaVersion >= 3
      ? cloneManorActivities((state as Partial<ManorPastureState>).activities ?? [])
      : []
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
  next.nuisanceProgressSeconds += elapsedSeconds;
  const nuisanceTicks = Math.floor(
    next.nuisanceProgressSeconds / MANOR_PASTURE_NUISANCE_INTERVAL_SECONDS
  );
  next.nuisanceProgressSeconds %= MANOR_PASTURE_NUISANCE_INTERVAL_SECONDS;
  for (let index = 0; index < Math.min(nuisanceTicks, 32); index += 1) {
    const roll = nextPastureRandom(next.randomState);
    next.randomState = roll.state;
    next.poopCount = Math.min(
      MANOR_PASTURE_POOP_LIMIT,
      next.poopCount + (roll.value < 0.5 ? 1 : 2)
    );
    if (next.mosquitoSources.length < MANOR_PASTURE_MOSQUITO_SCENE_LIMIT) {
      next.mosquitoSources.push("system");
    }
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
  let carrotsConsumed = 0;
  let specialFeedsConsumed = 0;
  const businessTransactions: ManorBusinessTransaction[] = [];
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
          pendingProduct: 0,
          productThiefUserIds: [],
          stolenProduct: 0
        });
        pasture.animalOrder.push(pasture.nextAnimalSerial);
        pasture.nextAnimalSerial += 1;
      }
      pasture.experience += action.quantity * 5;
      businessTransactions.push({ kind: "purchase", area: "pasture", itemName: definition.name, quantity: action.quantity, unitPrice: definition.purchasePrice });
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
      businessTransactions.push({ kind: "purchase", area: "pasture", itemName: "牧草", quantity, unitPrice: MANOR_GRASS_PRICE });
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
      animal.productThiefUserIds = [];
      animal.stolenProduct = 0;
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
      animal.productThiefUserIds = [];
      animal.stolenProduct = 0;
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
      pasture.animalOrder = pasture.animalOrder.filter((serial) => serial !== animal.serial);
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
      businessTransactions.push({
        kind: "sale",
        area: "pasture",
        itemName: action.itemType === "byproduct" ? definition.byproductName : definition.name,
        quantity: action.quantity,
        unitPrice: price
      });
      break;
    }
    case "sell-all-pasture": {
      for (const definition of MANOR_ANIMALS) {
        const byproductQuantity = pasture.byproducts[definition.sourceId] ?? 0;
        if (byproductQuantity > 0) {
          pasture.byproducts[definition.sourceId] = 0;
          nextCoins += definition.byproductSalePrice * byproductQuantity;
          businessTransactions.push({ kind: "sale", area: "pasture", itemName: definition.byproductName, quantity: byproductQuantity, unitPrice: definition.byproductSalePrice });
        }
        const animalQuantity = pasture.harvestedAnimals[definition.sourceId] ?? 0;
        if (animalQuantity > 0) {
          pasture.harvestedAnimals[definition.sourceId] = 0;
          nextCoins += definition.animalSalePrice * animalQuantity;
          businessTransactions.push({ kind: "sale", area: "pasture", itemName: definition.name, quantity: animalQuantity, unitPrice: definition.animalSalePrice });
        }
      }
      if (businessTransactions.length === 0) throw new Error("牧场仓库没有可出售的产品");
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
      businessTransactions.push({ kind: "purchase", area: "pasture", itemName: `${action.house === "hutch" ? "动物窝" : "动物棚"}${upgrade.level}级升级`, quantity: 1, unitPrice: upgrade.coinCost });
      break;
    }
    case "feed-animal-carrot": {
      if ((options.availableCarrots ?? 0) < 1) throw new Error("农场仓库没有胡萝卜");
      if ((options.specialFeedRemaining ?? MANOR_SPECIAL_FEED_LIMIT) < 1) {
        throw new Error("当前牧场今天已经喂满 30 个胡萝卜");
      }
      const animal = pastureAnimalBySerial(pasture, action.animalSerial);
      const definition = manorAnimalById(animal.sourceId);
      if (animal.growthSeconds >= definition.lifecycleSeconds) {
        throw new Error("动物生命周期已经结束");
      }
      animal.growthSeconds = Math.min(definition.lifecycleSeconds, animal.growthSeconds + 300);
      carrotsConsumed = 1;
      specialFeedsConsumed = 1;
      break;
    }
    case "clean-mosquito": {
      if (pasture.mosquitoSources.length === 0) throw new Error("牧场当前没有蚊子");
      pasture.mosquitoSources.shift();
      pasture.experience += 3;
      break;
    }
    case "clean-poop": {
      if (pasture.poopCount < 1) throw new Error("牧场当前没有便便");
      pasture.poopCount -= 1;
      pasture.manure += 1;
      break;
    }
    case "set-animal-order": {
      const expected = [...pasture.animals.map((animal) => animal.serial)].sort((a, b) => a - b);
      const requested = [...action.animalSerials].sort((a, b) => a - b);
      if (
        requested.length !== expected.length ||
        requested.some((serial, index) => serial !== expected[index])
      ) {
        throw new Error("动物展示队列与当前动物不一致");
      }
      pasture.animalOrder = [...action.animalSerials];
      break;
    }
  }
  validateManorPasture(pasture);
  return { pasture, coins: nextCoins, carrotsConsumed, specialFeedsConsumed, businessTransactions };
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
  const orderedAnimals = pasture.animalOrder.map((serial) =>
    pasture.animals.find((animal) => animal.serial === serial)
  ).filter((animal): animal is ManorPastureAnimalState => Boolean(animal));
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
    manure: pasture.manure,
    poopCount: pasture.poopCount,
    mosquitoCount: pasture.mosquitoSources.length,
    specialFeedRemaining: Math.max(0, options.specialFeedRemaining ?? MANOR_SPECIAL_FEED_LIMIT),
    carrotCount: Math.max(0, options.availableCarrots ?? 0),
    weather: manorWeatherAt(now),
    activities: cloneManorActivities(pasture.activities),
    businessRecords: options.businessRecords?.map((record) => ({ ...record })) ?? [],
    houses: { hutch, shed },
    catalog: MANOR_ANIMALS.map((definition) => toCatalogView(definition, level)),
    animals: orderedAnimals.map((animal) =>
      toAnimalView(animal, pasture, now, normalizeTimeScale(options.timeScale))
    ),
    inventory: MANOR_ANIMALS.map((definition) =>
      toInventoryView(definition, pasture)
    ).filter((item) => item.animalCount > 0 || item.byproductCount > 0)
  };
}

export function validateManorPasture(state: ManorPastureState): void {
  if (state.schemaVersion !== 3) throw new Error("牧场存档版本无效");
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
  if (!Number.isInteger(state.manure) || state.manure < 0) throw new Error("牧场便便库存无效");
  if (!Number.isInteger(state.poopCount) || state.poopCount < 0 || state.poopCount > MANOR_PASTURE_POOP_LIMIT) {
    throw new Error("牧场便便状态无效");
  }
  if (
    !Array.isArray(state.mosquitoSources) ||
    state.mosquitoSources.length > MANOR_PASTURE_MOSQUITO_SCENE_LIMIT ||
    state.mosquitoSources.some((source) => typeof source !== "string" || source.length < 1)
  ) {
    throw new Error("牧场蚊子状态无效");
  }
  if (
    !Number.isFinite(state.nuisanceProgressSeconds) ||
    state.nuisanceProgressSeconds < 0 ||
    state.nuisanceProgressSeconds >= MANOR_PASTURE_NUISANCE_INTERVAL_SECONDS
  ) {
    throw new Error("牧场随机事件进度无效");
  }
  if (!Number.isInteger(state.randomState) || state.randomState < 0) {
    throw new Error("牧场随机状态无效");
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
    if (!Number.isInteger(animal.stolenProduct) || animal.stolenProduct < 0) {
      throw new Error("动物被偷产品无效");
    }
    if (
      new Set(animal.productThiefUserIds).size !== animal.productThiefUserIds.length ||
      animal.productThiefUserIds.some((userId) => typeof userId !== "string" || userId.length === 0)
    ) {
      throw new Error("动物产品偷取记录无效");
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
  if (
    state.animalOrder.length !== state.animals.length ||
    new Set(state.animalOrder).size !== state.animalOrder.length ||
    state.animalOrder.some((serial) => !serials.has(serial))
  ) {
    throw new Error("动物展示队列无效");
  }
  for (const definition of MANOR_ANIMALS) {
    for (const inventory of [state.byproducts, state.harvestedAnimals]) {
      const count = inventory[definition.sourceId] ?? 0;
      if (!Number.isInteger(count) || count < 0) throw new Error("牧场仓库库存无效");
    }
  }
  validateManorActivities(state.activities);
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
    animals: state.animals.map((animal) => ({
      ...animal,
      productThiefUserIds: [...animal.productThiefUserIds]
    })),
    byproducts: { ...state.byproducts },
    harvestedAnimals: { ...state.harvestedAnimals },
    mosquitoSources: [...state.mosquitoSources],
    animalOrder: [...state.animalOrder],
    activities: cloneManorActivities(state.activities)
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
    assetUrl: `/assets/manor/classic/pasture/buildings/${house}-${currentLevel}.png`,
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
    minimumProduct: Math.ceil((animal.pendingProduct + animal.stolenProduct) / 2),
    stolenProduct: animal.stolenProduct,
    byproductName: definition.byproductName,
    productionAction: definition.productionAction,
    canStartProduction,
    canHarvestProduct: animal.pendingProduct > 0,
    canHarvestAnimal:
      animal.growthSeconds >= definition.lifecycleSeconds && animal.pendingProduct === 0,
    canFeedCarrot: animal.growthSeconds < definition.lifecycleSeconds,
    audioUrls: audioUrls(definition)
  };
}

function integerOrZero(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function finiteOrZero(value: unknown): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;
}

function hashPastureSeed(value: number): number {
  let seed = Math.abs(Math.trunc(value)) >>> 0;
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
}

function nextPastureRandom(state: number): { state: number; value: number } {
  const nextState = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return { state: nextState, value: nextState / 0x1_0000_0000 };
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
