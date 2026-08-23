import {
  MANOR_V7_ANIMALS,
  MANOR_V7_CROPS,
  MANOR_V7_DECORATIONS,
  MANOR_V7_FISH,
  MANOR_V7_TOOLS,
  manorV7Animal,
  manorV7Board,
  manorV7Crop,
  manorV7Fish,
  manorV7PastureGuard
} from "./catalog.js";
import type {
  ManorV7Action,
  ManorV7Activity,
  ManorV7AnimalHouse,
  ManorV7AnimalView,
  ManorV7CropVisualState,
  ManorV7FishState,
  ManorV7InventoryEntry,
  ManorV7LandView,
  ManorV7PastureAnimalState,
  ManorV7State,
  ManorV7TaskState,
  ManorV7TaskView,
  ManorV7View
} from "./types.js";
import { applyManorV7Action } from "./actions.js";
import {
  manorV7MaxProductionCount,
  manorV7ProductionCycleDuration
} from "./pasture-lifecycle.js";
import {
  MANOR_V7_WILD_ANIMALS,
  MANOR_V7_WILD_CRYSTALS,
  MANOR_V7_WILD_MAX_SLOTS,
  createManorV7WildState,
  manorV7WildAnimal,
  manorV7WildCrystal
} from "./wild.js";

export interface ManorV7RuntimeOptions {
  timeScale?: number;
}

export const MANOR_V7_SOURCE_VERSION = "7.0 Beta1 Build 20120209.1000" as const;
export const MANOR_V7_LAND_COUNT = 24;
export const MANOR_V7_INITIAL_LAND_COUNT = 6;
export const MANOR_V7_GRASS_CAPACITY = 1_000;
export const MANOR_V7_GRASS_LIST_PRICE = 60;
export const MANOR_V7_GRASS_PRICE = 30;
export const MANOR_V7_GUARD_INITIAL_WAGE_SECONDS = 7 * 24 * 60 * 60;
export const MANOR_V7_FISH_POOL_CAPACITY = 6;
export const MANOR_V7_ACTIVITY_LIMIT = 50;
export const MANOR_V7_EVENT_INTERVAL_SECONDS = 21_600;

export const MANOR_V7_RECLAIM_RULES = [
  { unlocked: 6, level: 5, coins: 10_000 },
  { unlocked: 7, level: 7, coins: 20_000 },
  { unlocked: 8, level: 9, coins: 30_000 },
  { unlocked: 9, level: 11, coins: 50_000 },
  { unlocked: 10, level: 13, coins: 70_000 },
  { unlocked: 11, level: 15, coins: 90_000 },
  { unlocked: 12, level: 17, coins: 120_000 },
  { unlocked: 13, level: 19, coins: 150_000 },
  { unlocked: 14, level: 21, coins: 180_000 },
  { unlocked: 15, level: 23, coins: 230_000 },
  { unlocked: 16, level: 25, coins: 300_000 },
  { unlocked: 17, level: 27, coins: 500_000 },
  { unlocked: 18, level: 29, coins: 850_000 },
  { unlocked: 19, level: 31, coins: 1_100_000 },
  { unlocked: 20, level: 33, coins: 1_300_000 },
  { unlocked: 21, level: 35, coins: 1_500_000 },
  { unlocked: 22, level: 37, coins: 1_700_000 },
  { unlocked: 23, level: 39, coins: 2_000_000 }
] as const;

export const MANOR_V7_HOUSE_UPGRADES = {
  hutch: [
    { level: 1, requiredLevel: 0, coins: 0 },
    { level: 2, requiredLevel: 1, coins: 3_000 },
    { level: 3, requiredLevel: 4, coins: 20_000 },
    { level: 4, requiredLevel: 8, coins: 60_000 },
    { level: 5, requiredLevel: 12, coins: 120_000 },
    { level: 6, requiredLevel: 16, coins: 210_000 },
    { level: 7, requiredLevel: 20, coins: 300_000 },
    { level: 8, requiredLevel: 24, coins: 400_000 }
  ],
  shed: [
    { level: 1, requiredLevel: 2, coins: 5_000 },
    { level: 2, requiredLevel: 6, coins: 40_000 },
    { level: 3, requiredLevel: 10, coins: 90_000 },
    { level: 4, requiredLevel: 14, coins: 160_000 },
    { level: 5, requiredLevel: 18, coins: 250_000 },
    { level: 6, requiredLevel: 22, coins: 350_000 },
    { level: 7, requiredLevel: 26, coins: 500_000 },
    { level: 8, requiredLevel: 28, coins: 700_000 }
  ]
} as const;

export const MANOR_V7_TASK_DEFINITIONS = [
  { key: "plant", title: "播种入门", description: "播种 1 次", target: 1, rewardCoins: 200 },
  { key: "water", title: "及时浇水", description: "浇水 3 次", target: 3, rewardCoins: 300 },
  { key: "care", title: "田间照料", description: "除草或除虫 2 次", target: 2, rewardCoins: 400 },
  { key: "harvest", title: "第一次收获", description: "收获 1 块土地", target: 1, rewardCoins: 500 },
  { key: "sell", title: "经营起步", description: "出售 10 份农产品", target: 10, rewardCoins: 600 },
  { key: "animal", title: "牧场新成员", description: "购买 1 只动物", target: 1, rewardCoins: 600 },
  { key: "product", title: "牧场收获", description: "收取 1 次副产品", target: 1, rewardCoins: 800 },
  { key: "house", title: "扩建牧场", description: "升级 1 次窝或棚", target: 1, rewardCoins: 1_000 }
] as const;

export function manorV7ExperienceForLevel(level: number): number {
  return Math.max(0, Math.trunc((level + 0.5) ** 2 * 100 - 25));
}

export function manorV7LevelForExperience(experience: number): number {
  return Math.max(0, Math.floor(Math.sqrt((Math.max(0, experience) + 25) / 100) - 0.5));
}

export function manorV7HouseCapacity(house: ManorV7AnimalHouse, level: number): number {
  if (house === "shed") return level === 0 ? 0 : level + 2;
  return level < 3 ? level + 1 : level + 2;
}

export function createManorV7State(now: number): ManorV7State {
  const initialCrops = new Map<number, { cropId: number; growthSeconds: number; weeds?: boolean; pests?: boolean }>([
    [1, { cropId: 6, growthSeconds: 36_030 }],
    [2, { cropId: 1, growthSeconds: 14_400, weeds: true }],
    [3, { cropId: 1, growthSeconds: 14_400 }],
    [4, { cropId: 1, growthSeconds: 25_200, pests: true }]
  ]);
  const lands = Array.from({ length: MANOR_V7_LAND_COUNT }, (_, index) => {
    const id = index + 1;
    const crop = initialCrops.get(id);
    return {
      id,
      unlocked: id <= MANOR_V7_INITIAL_LAND_COUNT,
      tier: "normal" as const,
      ...(crop ? { cropId: crop.cropId } : {}),
      growthSeconds: crop?.growthSeconds ?? 0,
      harvests: 0,
      watered: id <= MANOR_V7_INITIAL_LAND_COUNT,
      weeds: crop?.weeds ?? false,
      pests: crop?.pests ?? false,
      stolen: 0,
      thiefUserIds: [],
      fertilizedSeconds: 0
    };
  });

  const state: ManorV7State = {
    schemaVersion: 1,
    revision: 1,
    coins: 0,
    farmExperience: 0,
    pastureExperience: 0,
    farm: {
      lands,
      seedInventory: [],
      produceInventory: [],
      toolInventory: [],
      fishPool: createFishPool(),
      eventProgressSeconds: 0,
      selectedDecorationIds: [1, 2, 3, 4],
      selectedBoardId: null,
      selectedAvatarId: null
    },
    pasture: {
      grass: 20,
      hutchLevel: 1,
      shedLevel: 0,
      nextAnimalSerial: 3,
      animals: [
        { serial: 1, animalId: 1002, growthSeconds: 165_600, productionActive: false, productionProgressSeconds: 0, productionCount: 5, pendingProduct: 0, stolenProduct: 0, productThiefUserIds: [] },
        { serial: 2, animalId: 1002, growthSeconds: 36_001, productionActive: false, productionProgressSeconds: 0, productionCount: 0, pendingProduct: 0, stolenProduct: 0, productThiefUserIds: [] }
      ],
      productInventory: [],
      harvestedAnimalInventory: [],
      guards: [],
      manure: 0,
      selectedDecorationIds: [105],
      wild: createManorV7WildState()
    },
    ownedDecorationIds: [1, 2, 3, 4, 105],
    rewardClaims: {
      dailyPackageDay: null,
      signInDay: null,
      signInRewardId: null,
      signInStreak: 0
    },
    tasks: MANOR_V7_TASK_DEFINITIONS.map((task) => ({ key: task.key, progress: 0, completed: false, claimed: false })),
    activities: [{ id: 1, area: "farm", message: "欢迎来到 QQ 农场 7.0", createdAt: now }],
    nextActivityId: 2,
    randomState: hashSeed(now),
    updatedAt: now
  };
  validateManorV7State(state);
  return state;
}

export function migrateManorV7State(value: unknown, now: number): ManorV7State {
  if (value === undefined) return createManorV7State(now);
  if (!value || typeof value !== "object" || (value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new Error("V7 庄园存档格式无效");
  }
  const state = structuredClone(value as ManorV7State);
  for (const land of state.farm.lands) land.thiefUserIds ??= [];
  for (const animal of state.pasture.animals) {
    const definition = manorV7Animal(animal.animalId);
    const legacy = animal as ManorV7PastureAnimalState & {
      productionActive?: boolean;
      productionCount?: number;
    };
    animal.productThiefUserIds ??= [];
    if (!Number.isInteger(legacy.productionCount) || legacy.productionCount! < 0) {
      legacy.productionCount = animal.growthSeconds >= definition.productionSeconds
        ? manorV7MaxProductionCount(definition)
        : animal.pendingProduct > 0 ? 1 : 0;
    }
    legacy.productionCount = Math.min(legacy.productionCount!, manorV7MaxProductionCount(definition));
    legacy.productionActive = typeof legacy.productionActive === "boolean" ? legacy.productionActive : false;
    if (!legacy.productionActive) animal.productionProgressSeconds = 0;
    if (legacy.productionCount >= manorV7MaxProductionCount(definition)) {
      animal.growthSeconds = Math.max(animal.growthSeconds, definition.lifecycleSeconds);
    }
    animal.growthSeconds = Math.min(animal.growthSeconds, definition.lifecycleSeconds);
  }
  state.farm.fishPool ??= createFishPool();
  state.farm.selectedBoardId ??= null;
  state.farm.selectedAvatarId ??= null;
  state.pasture.harvestedAnimalInventory ??= [];
  state.pasture.guards ??= [];
  state.pasture.wild ??= createManorV7WildState();
  state.rewardClaims ??= {
    dailyPackageDay: null,
    signInDay: null,
    signInRewardId: null,
    signInStreak: 0
  };
  state.rewardClaims.signInStreak ??= state.rewardClaims.signInDay ? 1 : 0;
  validateManorV7State(state);
  return state;
}

export function advanceManorV7State(
  current: ManorV7State,
  now: number,
  options: ManorV7RuntimeOptions = {}
): ManorV7State {
  const state = structuredClone(current);
  if (now <= state.updatedAt) return state;
  const elapsed = ((now - state.updatedAt) / 1_000) * normalizeTimeScale(options.timeScale);

  for (const land of state.farm.lands) {
    if (!land.cropId) continue;
    const crop = manorV7Crop(land.cropId);
    if (land.harvests >= crop.harvestCycles) continue;
    const careFactor = land.weeds || land.pests || !land.watered ? 0.7 : 1;
    land.growthSeconds = Math.min(crop.growthSeconds, land.growthSeconds + elapsed * careFactor);
  }

  for (const fish of state.farm.fishPool.fish) {
    const definition = manorV7Fish(fish.fishId);
    const maturity = definition.cycleSeconds.at(-1) ?? definition.matureHours * 3_600;
    fish.growthSeconds = Math.min(maturity, fish.growthSeconds + elapsed);
  }

  state.farm.eventProgressSeconds += elapsed;
  const eventCount = Math.min(32, Math.floor(state.farm.eventProgressSeconds / MANOR_V7_EVENT_INTERVAL_SECONDS));
  state.farm.eventProgressSeconds %= MANOR_V7_EVENT_INTERVAL_SECONDS;
  for (let index = 0; index < eventCount; index += 1) applyFarmEvent(state, now);

  advancePasture(state, elapsed, now);
  advanceWildlife(state, now);
  state.updatedAt = now;
  state.revision += 1;
  validateManorV7State(state);
  return state;
}

export function transitionManorV7State(
  current: ManorV7State,
  action: ManorV7Action,
  now: number,
  options: ManorV7RuntimeOptions = {}
): ManorV7State {
  const state = advanceManorV7State(current, now, options);
  applyManorV7Action(state, action, now);
  state.revision = current.revision + 1;
  state.updatedAt = now;
  validateManorV7State(state);
  return state;
}

export function toManorV7View(
  state: ManorV7State,
  owner: { userId: string; displayName: string },
  now: number
): ManorV7View {
  const farmLevel = manorV7LevelForExperience(state.farmExperience);
  const pastureLevel = manorV7LevelForExperience(state.pastureExperience);
  return {
    version: MANOR_V7_SOURCE_VERSION,
    owner,
    revision: state.revision,
    coins: state.coins,
    farmLevel,
    farmExperience: state.farmExperience,
    farmNextLevelExperience: manorV7ExperienceForLevel(farmLevel + 1),
    pastureLevel,
    pastureExperience: state.pastureExperience,
    pastureNextLevelExperience: manorV7ExperienceForLevel(pastureLevel + 1),
    farm: {
      lands: state.farm.lands.map(toLandView),
      seedInventory: cloneInventory(state.farm.seedInventory),
      produceInventory: cloneInventory(state.farm.produceInventory),
      toolInventory: cloneInventory(state.farm.toolInventory),
      fishPool: {
        opened: state.farm.fishPool.opened,
        capacity: MANOR_V7_FISH_POOL_CAPACITY,
        nextFishSerial: state.farm.fishPool.nextFishSerial,
        unlockedFishIds: [...state.farm.fishPool.unlockedFishIds],
        fish: state.farm.fishPool.fish.map((fish) => ({ ...fish })),
        seedInventory: cloneInventory(state.farm.fishPool.seedInventory),
        produceInventory: cloneInventory(state.farm.fishPool.produceInventory)
      },
      selectedDecorationIds: [...state.farm.selectedDecorationIds],
      selectedBoardId: state.farm.selectedBoardId,
      selectedAvatarId: state.farm.selectedAvatarId
    },
    pasture: {
      grass: Math.floor(state.pasture.grass),
      hutchLevel: state.pasture.hutchLevel,
      shedLevel: state.pasture.shedLevel,
      hutchCapacity: manorV7HouseCapacity("hutch", state.pasture.hutchLevel),
      shedCapacity: manorV7HouseCapacity("shed", state.pasture.shedLevel),
      animals: state.pasture.animals.map((animal) => toAnimalView(animal, state.pasture.grass)),
      productInventory: cloneInventory(state.pasture.productInventory),
      harvestedAnimalInventory: cloneInventory(state.pasture.harvestedAnimalInventory),
      guards: state.pasture.guards.map((guard) => ({ ...guard })),
      manure: state.pasture.manure,
      selectedDecorationIds: [...state.pasture.selectedDecorationIds],
      wild: {
        ...state.pasture.wild,
        slots: state.pasture.wild.slots.map((slot) => ({ ...slot })),
        incomingAnimals: state.pasture.wild.incomingAnimals.map((animal) => ({
          ...animal,
          attacks: animal.attacks.map((attack) => ({ ...attack }))
        })),
        crystalInventory: cloneInventory(state.pasture.wild.crystalInventory),
        crystalDrops: state.pasture.wild.crystalDrops.map((drop) => ({ ...drop }))
      }
    },
    ownedDecorationIds: [...state.ownedDecorationIds],
    rewardClaims: { ...state.rewardClaims },
    tasks: toTaskViews(state.tasks),
    activities: state.activities.map((activity) => ({ ...activity })),
    catalogs: {
      crops: MANOR_V7_CROPS,
      animals: MANOR_V7_ANIMALS,
      tools: MANOR_V7_TOOLS,
      decorations: MANOR_V7_DECORATIONS,
      fish: MANOR_V7_FISH,
      wildAnimals: MANOR_V7_WILD_ANIMALS,
      wildCrystals: MANOR_V7_WILD_CRYSTALS
    },
    serverTime: now
  };
}

export function inventoryQuantity(inventory: readonly ManorV7InventoryEntry[], sourceId: number): number {
  return inventory.find((entry) => entry.sourceId === sourceId)?.quantity ?? 0;
}

export function setInventoryQuantity(
  inventory: ManorV7InventoryEntry[],
  sourceId: number,
  quantity: number
): void {
  const index = inventory.findIndex((entry) => entry.sourceId === sourceId);
  if (quantity <= 0) {
    if (index >= 0) inventory.splice(index, 1);
    return;
  }
  if (index >= 0) inventory[index] = { ...inventory[index]!, sourceId, quantity };
  else inventory.push({ sourceId, quantity });
  inventory.sort((left, right) => left.sourceId - right.sourceId);
}

export function addManorV7Activity(
  state: ManorV7State,
  area: "farm" | "pasture",
  message: string,
  now: number
): void {
  const activity: ManorV7Activity = { id: state.nextActivityId, area, message, createdAt: now };
  state.nextActivityId += 1;
  state.activities = [activity, ...state.activities].slice(0, MANOR_V7_ACTIVITY_LIMIT);
}

export function drawManorV7Random(state: ManorV7State): number {
  const roll = nextRandom(state.randomState);
  state.randomState = roll.state;
  return roll.value;
}

export function manorV7DayKey(now: number): string {
  return new Date(now + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

export function progressManorV7Task(state: ManorV7State, key: string, amount: number): void {
  const task = state.tasks.find((item) => item.key === key);
  const definition = MANOR_V7_TASK_DEFINITIONS.find((item) => item.key === key);
  if (!task || !definition || task.completed) return;
  task.progress = Math.min(definition.target, task.progress + amount);
  if (task.progress >= definition.target) {
    task.completed = true;
    task.claimed = true;
    state.coins += definition.rewardCoins;
  }
}

export function validateManorV7State(state: ManorV7State): void {
  if (
    state.schemaVersion !== 1 ||
    !Number.isInteger(state.revision) || state.revision < 1 ||
    !Number.isInteger(state.coins) || state.coins < 0 ||
    !Number.isInteger(state.farmExperience) || state.farmExperience < 0 ||
    !Number.isInteger(state.pastureExperience) || state.pastureExperience < 0 ||
    state.farm.lands.length !== MANOR_V7_LAND_COUNT ||
    new Set(state.farm.lands.map((land) => land.id)).size !== MANOR_V7_LAND_COUNT ||
    !validBoardId(state.farm.selectedBoardId) ||
    !validAvatarId(state.farm.selectedAvatarId) ||
    !Number.isFinite(state.pasture.grass) || state.pasture.grass < 0 || state.pasture.grass > MANOR_V7_GRASS_CAPACITY ||
    !validClaimDay(state.rewardClaims.dailyPackageDay) ||
    !validClaimDay(state.rewardClaims.signInDay) ||
    (state.rewardClaims.signInRewardId !== null && ![1, 2, 3, 4].includes(state.rewardClaims.signInRewardId)) ||
    !Number.isInteger(state.rewardClaims.signInStreak) || state.rewardClaims.signInStreak < 0 ||
    !Number.isInteger(state.updatedAt) || state.updatedAt < 0
  ) {
    throw new Error("V7 庄园状态无效");
  }
  for (const land of state.farm.lands) {
    if (land.cropId) manorV7Crop(land.cropId);
    if (
      land.growthSeconds < 0 ||
      land.harvests < 0 ||
      land.stolen < 0 ||
      !Array.isArray(land.thiefUserIds) ||
      new Set(land.thiefUserIds).size !== land.thiefUserIds.length
    ) throw new Error("V7 土地状态无效");
  }
  const serials = new Set<number>();
  for (const animal of state.pasture.animals) {
    const definition = manorV7Animal(animal.animalId);
    if (
      serials.has(animal.serial) ||
      animal.growthSeconds < 0 ||
      typeof animal.productionActive !== "boolean" ||
      !Number.isFinite(animal.productionProgressSeconds) || animal.productionProgressSeconds < 0 ||
      !Number.isInteger(animal.productionCount) ||
      animal.productionCount < 0 || animal.productionCount > manorV7MaxProductionCount(definition) ||
      animal.pendingProduct < 0 ||
      animal.stolenProduct < 0 || animal.stolenProduct > animal.pendingProduct ||
      !Array.isArray(animal.productThiefUserIds) ||
      new Set(animal.productThiefUserIds).size !== animal.productThiefUserIds.length
    ) {
      throw new Error("V7 牧场动物状态无效");
    }
    serials.add(animal.serial);
  }
  const fishSerials = new Set<number>();
  let fishPoolSize = 0;
  for (const fish of state.farm.fishPool.fish) {
    const definition = manorV7Fish(fish.fishId);
    if (fishSerials.has(fish.serial) || fish.growthSeconds < 0) throw new Error("V7 鱼塘状态无效");
    fishSerials.add(fish.serial);
    fishPoolSize += definition.poolSize;
  }
  if (
    fishPoolSize > MANOR_V7_FISH_POOL_CAPACITY ||
    new Set(state.farm.fishPool.unlockedFishIds).size !== state.farm.fishPool.unlockedFishIds.length ||
    state.farm.fishPool.unlockedFishIds.some((id) => !MANOR_V7_FISH.some((fish) => fish.id === id))
  ) throw new Error("V7 鱼塘状态无效");
  validateInventory(state.farm.seedInventory);
  validateInventory(state.farm.produceInventory);
  validateInventory(state.farm.toolInventory);
  validateInventory(state.farm.fishPool.seedInventory);
  validateInventory(state.farm.fishPool.produceInventory);
  validateInventory(state.pasture.productInventory);
  validateInventory(state.pasture.harvestedAnimalInventory);
  const guardIds = new Set<number>();
  for (const guard of state.pasture.guards) {
    manorV7PastureGuard(guard.id);
    if (
      guardIds.has(guard.id) ||
      !Number.isFinite(guard.remainingSeconds) || guard.remainingSeconds < 0 ||
      typeof guard.active !== "boolean"
    ) throw new Error("V7 牧场看守状态无效");
    guardIds.add(guard.id);
  }
  if (state.pasture.guards.filter((guard) => guard.active).length > 1) {
    throw new Error("V7 牧场看守状态无效");
  }
  validateWildlife(state);
}

function validateWildlife(state: ManorV7State): void {
  const wild = state.pasture.wild;
  if (
    !Number.isInteger(wild.moralExperience) || wild.moralExperience < 0 ||
    !Number.isInteger(wild.maxSlotId) || wild.maxSlotId < 0 || wild.maxSlotId >= MANOR_V7_WILD_MAX_SLOTS ||
    !Number.isInteger(wild.nextIncomingSerial) || wild.nextIncomingSerial < 1 ||
    !Number.isInteger(wild.nextCrystalSerial) || wild.nextCrystalSerial < 1
  ) throw new Error("V7 野生动物状态无效");
  const slotIds = new Set<number>();
  for (const slot of wild.slots) {
    const definition = manorV7WildAnimal(slot.animalType);
    if (
      slotIds.has(slot.slotId) || slot.slotId < 0 || slot.slotId > wild.maxSlotId ||
      ![1, 2, 3, 4, 5, 6].includes(slot.status) ||
      !Number.isInteger(slot.currentBlood) || slot.currentBlood < 0 || slot.currentBlood > definition.blood ||
      !Number.isInteger(slot.remainingReleases) || slot.remainingReleases < 0 || slot.remainingReleases > definition.maxReleases ||
      !Number.isInteger(slot.income) || slot.income < 0
    ) throw new Error("V7 野生动物槽位状态无效");
    slotIds.add(slot.slotId);
  }
  const incomingSerials = new Set<number>();
  for (const animal of wild.incomingAnimals) {
    const definition = manorV7WildAnimal(animal.animalType);
    if (
      incomingSerials.has(animal.serial) || animal.serial < 1 ||
      !animal.ownerUserId || animal.ownerSlotId < 0 ||
      (animal.area !== "farm" && animal.area !== "pasture") ||
      ![2, 6].includes(animal.status) || animal.blood < 0 || animal.blood > definition.blood ||
      animal.returnAt < animal.arrivedAt
    ) throw new Error("V7 放养动物状态无效");
    incomingSerials.add(animal.serial);
  }
  for (const drop of wild.crystalDrops) {
    manorV7WildCrystal(drop.crystalId);
    if (drop.serial < 1 || drop.quantity < 1 || drop.createdAt < 0) throw new Error("V7 水晶掉落状态无效");
  }
  validateInventory(wild.crystalInventory);
}

function validBoardId(value: number | null): boolean {
  if (value === null) return true;
  try {
    manorV7Board(value);
    return true;
  } catch {
    return false;
  }
}

function validAvatarId(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value > 0 && value <= 1_000_000);
}

function validClaimDay(value: string | null): boolean {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function createFishPool(): ManorV7State["farm"]["fishPool"] {
  return {
    opened: true,
    nextFishSerial: 1,
    unlockedFishIds: MANOR_V7_FISH
      .filter((fish) => fish.unlockCoins === 0 && fish.unlockCrystalAmount === 0)
      .map((fish) => fish.id),
    fish: [] as ManorV7FishState[],
    seedInventory: [],
    produceInventory: []
  };
}

function toLandView(land: ManorV7State["farm"]["lands"][number]): ManorV7LandView {
  if (!land.unlocked) return { ...land, visualState: "locked", remainingSeconds: 0, harvestable: false };
  if (!land.cropId) return { ...land, visualState: "empty", remainingSeconds: 0, harvestable: false };
  const crop = manorV7Crop(land.cropId);
  const final = land.harvests >= crop.harvestCycles;
  const visualState = final ? "withered" : cropVisualState(crop.stageSeconds, crop.growthSeconds, land.growthSeconds);
  return {
    ...land,
    crop,
    visualState,
    remainingSeconds: final ? 0 : Math.max(0, crop.growthSeconds - land.growthSeconds),
    harvestable: visualState === "mature"
  };
}

function cropVisualState(
  stageSeconds: readonly number[],
  fallbackMaturity: number,
  growthSeconds: number
): ManorV7CropVisualState {
  const [seed = fallbackMaturity * 0.15, sprout = fallbackMaturity * 0.3, young = fallbackMaturity * 0.55, growing = fallbackMaturity * 0.8, mature = fallbackMaturity] = stageSeconds;
  if (growthSeconds < seed) return "seed";
  if (growthSeconds < sprout) return "sprout";
  if (growthSeconds < young) return "young";
  if (growthSeconds < Math.max(growing, mature)) return "growing";
  return "mature";
}

function toAnimalView(animalState: ManorV7PastureAnimalState, grass: number): ManorV7AnimalView {
  const animal = manorV7Animal(animalState.animalId);
  const collectable = animalState.pendingProduct > 0;
  const maxProductionCount = manorV7MaxProductionCount(animal);
  const hungry = grass <= 0 && (
    animalState.growthSeconds < animal.maturitySeconds ||
    animalState.productionActive ||
    animalState.productionCount < maxProductionCount
  );
  let visualState: ManorV7AnimalView["visualState"];
  if (animalState.growthSeconds < animal.cubSeconds) visualState = "cub";
  else if (animalState.growthSeconds < animal.maturitySeconds) visualState = "young";
  else if (animalState.productionActive && animalState.productionProgressSeconds < animal.productionActionSeconds) {
    visualState = "production-action";
  } else if (animalState.productionActive || collectable) {
    visualState = "production-cooldown";
  } else if (animalState.productionCount >= maxProductionCount) {
    visualState = "harvestable";
  } else {
    visualState = "production-ready";
  }
  const cycleIndex = Math.max(
    0,
    animalState.productionCount - Number(animalState.productionProgressSeconds >= animal.productionActionSeconds)
  );
  const remainingSeconds = visualState === "cub"
    ? Math.max(0, animal.cubSeconds - animalState.growthSeconds)
    : visualState === "young"
      ? Math.max(0, animal.maturitySeconds - animalState.growthSeconds)
      : visualState === "production-action"
        ? Math.max(0, animal.productionActionSeconds - animalState.productionProgressSeconds)
        : visualState === "production-cooldown" && animalState.productionActive
          ? Math.max(0, manorV7ProductionCycleDuration(animal, cycleIndex) - animalState.productionProgressSeconds)
          : 0;
  return {
    ...animalState,
    animal,
    visualState,
    remainingSeconds,
    collectable,
    hungry
  };
}

function advancePasture(state: ManorV7State, elapsed: number, now: number): void {
  for (const guard of state.pasture.guards) {
    guard.remainingSeconds = Math.max(0, round(guard.remainingSeconds - elapsed));
  }
  let remaining = elapsed;
  let fedAnimalSeconds = 0;
  const maxTransitions = state.pasture.animals.length * 3 + 1;
  for (let transition = 0; transition < maxTransitions && remaining > 0; transition += 1) {
    const active = state.pasture.animals.filter((animal) => pastureSecondsToBoundary(animal) > 0);
    if (active.length === 0) break;
    const boundary = Math.min(remaining, ...active.map(pastureSecondsToBoundary));
    const consumptionPerSecond = active.reduce(
      (total, animal) => total + manorV7Animal(animal.animalId).consume / 14_400,
      0
    );
    const step = consumptionPerSecond <= 0
      ? boundary
      : Math.min(boundary, state.pasture.grass / consumptionPerSecond);
    if (step <= 0) break;

    state.pasture.grass = Math.max(0, state.pasture.grass - consumptionPerSecond * step);
    for (const animal of active) advancePastureAnimal(state, animal, step, now);
    fedAnimalSeconds += step * active.length;
    remaining -= step;
    if (step < boundary) break;
  }

  const manureGain = Math.floor(fedAnimalSeconds / MANOR_V7_EVENT_INTERVAL_SECONDS);
  state.pasture.manure = Math.min(99, state.pasture.manure + manureGain);
  state.pasture.grass = round(state.pasture.grass);
}

function pastureSecondsToBoundary(animalState: ManorV7PastureAnimalState): number {
  const animal = manorV7Animal(animalState.animalId);
  if (animalState.growthSeconds < animal.maturitySeconds) {
    return animal.maturitySeconds - animalState.growthSeconds;
  }
  if (!animalState.productionActive) return 0;
  if (animalState.productionProgressSeconds < animal.productionActionSeconds) {
    return animal.productionActionSeconds - animalState.productionProgressSeconds;
  }
  const cycleIndex = Math.max(0, animalState.productionCount - 1);
  return Math.max(
    0,
    manorV7ProductionCycleDuration(animal, cycleIndex) - animalState.productionProgressSeconds
  );
}

function advancePastureAnimal(
  state: ManorV7State,
  animalState: ManorV7PastureAnimalState,
  seconds: number,
  now: number
): void {
  const animal = manorV7Animal(animalState.animalId);
  if (animalState.growthSeconds < animal.maturitySeconds) {
    animalState.growthSeconds = Math.min(animal.maturitySeconds, animalState.growthSeconds + seconds);
    return;
  }
  if (!animalState.productionActive) return;

  const previousProgress = animalState.productionProgressSeconds;
  const actionWasComplete = previousProgress >= animal.productionActionSeconds;
  const cycleIndex = Math.max(0, animalState.productionCount - Number(actionWasComplete));
  const cycleDuration = manorV7ProductionCycleDuration(animal, cycleIndex);
  animalState.productionProgressSeconds = Math.min(cycleDuration, previousProgress + seconds);
  animalState.growthSeconds = Math.min(animal.lifecycleSeconds, animalState.growthSeconds + seconds);

  if (!actionWasComplete && animalState.productionProgressSeconds >= animal.productionActionSeconds) {
    animalState.productionCount += 1;
    animalState.pendingProduct = animal.baseYield;
    animalState.stolenProduct = 0;
    animalState.productThiefUserIds = [];
    addManorV7Activity(state, "pasture", `${animal.name}完成生产，可以收取${animal.byproductName}了`, now);
  }
  if (animalState.productionProgressSeconds >= cycleDuration) {
    animalState.productionActive = false;
    animalState.productionProgressSeconds = 0;
  }
}

function advanceWildlife(state: ManorV7State, now: number): void {
  const wild = state.pasture.wild;
  for (const slot of wild.slots) {
    if (slot.status === 2 && slot.returnAt !== null && slot.returnAt <= now) {
      slot.status = 3;
      slot.targetUserId = null;
      slot.targetDisplayName = null;
      slot.targetArea = null;
      slot.releasedAt = null;
      slot.returnAt = null;
    } else if (slot.status === 4 && slot.restUntil !== null && slot.restUntil <= now) {
      slot.status = slot.remainingReleases > 0 ? 1 : 5;
      slot.currentBlood = manorV7WildAnimal(slot.animalType).blood;
      slot.restUntil = null;
    }
  }
  wild.incomingAnimals = wild.incomingAnimals.filter((animal) => animal.returnAt > now);
}

function applyFarmEvent(state: ManorV7State, now: number): void {
  const candidates = state.farm.lands.filter((land) => land.cropId && !land.weeds && !land.pests);
  if (candidates.length === 0) return;
  const land = candidates[Math.floor(drawManorV7Random(state) * candidates.length)];
  if (!land) return;
  if (drawManorV7Random(state) < 0.5) {
    land.weeds = true;
    addManorV7Activity(state, "farm", `第 ${land.id} 块土地长出了杂草`, now);
  } else {
    land.pests = true;
    addManorV7Activity(state, "farm", `第 ${land.id} 块土地出现了害虫`, now);
  }
}

function toTaskViews(tasks: readonly ManorV7TaskState[]): ManorV7TaskView[] {
  return tasks.map((task) => {
    const definition = MANOR_V7_TASK_DEFINITIONS.find((item) => item.key === task.key);
    if (!definition) throw new Error("V7 任务定义不存在");
    return { ...task, ...definition };
  });
}

function cloneInventory(inventory: readonly ManorV7InventoryEntry[]): ManorV7InventoryEntry[] {
  return inventory.map((entry) => ({ ...entry }));
}

function validateInventory(inventory: readonly ManorV7InventoryEntry[]): void {
  const ids = new Set<number>();
  for (const entry of inventory) {
    if (
      !Number.isInteger(entry.sourceId) ||
      ids.has(entry.sourceId) ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1 ||
      (entry.locked !== undefined && typeof entry.locked !== "boolean")
    ) {
      throw new Error("V7 库存状态无效");
    }
    ids.add(entry.sourceId);
  }
}

function normalizeTimeScale(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value as number : 1;
}

function hashSeed(now: number): number {
  return (Math.trunc(now) ^ 0x6d2b79f5) >>> 0;
}

function nextRandom(state: number): { state: number; value: number } {
  const next = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return { state: next, value: next / 0x1_0000_0000 };
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
