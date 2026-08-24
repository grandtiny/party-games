import {
  MANOR_V7_ANIMALS,
  MANOR_V7_CROPS,
  MANOR_V7_DECORATIONS,
  MANOR_V7_FISH,
  MANOR_V7_TOOLS,
  manorV7Animal,
  manorV7Board,
  manorV7Crop,
  manorV7Decoration,
  manorV7Fish,
  manorV7PastureGuard,
  manorV7Tool
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
import {
  MANOR_V7_DAILY_SIGN_IN_LIMIT,
  MANOR_V7_DAILY_SIGN_IN_REWARDS,
  MANOR_V7_STREAK_SIGN_IN_REWARDS
} from "./sign-in.js";
import { MANOR_V7_MAX_LEVEL_REWARD, MANOR_V7_TUTORIAL_TASKS } from "./rewards.js";
import { MANOR_V7_FLOWERS, manorV7Flower } from "./flowers.js";

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
export const MANOR_V7_SEASONAL_ANIMAL_DROP_LIMIT = 3;
export const MANOR_V7_CANDY_OFFERING_DAILY_LIMIT = 10;
export const MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT = 10;
export const MANOR_V7_SEASONAL_ANIMAL_IDS = [1593, 1086, 1085] as const;
export const MANOR_V7_ACTIVITY_LIMIT = 50;
export const MANOR_V7_EVENT_INTERVAL_SECONDS = 21_600;
export const MANOR_V7_BAD_ACTION_DAILY_LIMIT = 50;
export const MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT = 25;
export const MANOR_V7_MANURE_COLLECTION_DAILY_LIMIT = 100;
export const MANOR_V7_SPECIAL_FEED_DAILY_LIMIT = 30;
export const MANOR_V7_DOG_FOOD_DAY_SECONDS = 24 * 60 * 60;

export const MANOR_V7_RESEARCH_RULES = {
  hutch: [
    { animalId: 1096, coins: 18_000, seconds: 24 * 60 * 60 },
    { animalId: 1097, coins: 18_700, seconds: 28 * 60 * 60 },
    { animalId: 1098, coins: 19_000, seconds: 34 * 60 * 60 }
  ],
  shed: [
    { animalId: 1598, coins: 18_500, seconds: 24 * 60 * 60 },
    { animalId: 1600, coins: 18_900, seconds: 28 * 60 * 60 },
    { animalId: 1601, coins: 19_500, seconds: 34 * 60 * 60 }
  ]
} as const;

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
      fertilizedSeconds: 0,
      yieldPenaltyPercent: 0
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
      badActions: { day: manorV7DayKey(now), remaining: MANOR_V7_BAD_ACTION_DAILY_LIMIT },
      manureCollection: { day: manorV7DayKey(now), remaining: MANOR_V7_MANURE_COLLECTION_DAILY_LIMIT },
      dog: { ownedIds: [], activeId: null, feedSeconds: 0 },
      weather: manorV7Weather(now),
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
      cubInventory: [],
      materialInventory: [],
      toolInventory: [],
      weaponInventory: [],
      productInventory: [],
      harvestedAnimalInventory: [],
      guards: [],
      research: {
        hutch: { animalId: null, remainingSeconds: 0 },
        shed: { animalId: null, remainingSeconds: 0 }
      },
      specialFeed: { day: manorV7DayKey(now), remaining: MANOR_V7_SPECIAL_FEED_DAILY_LIMIT },
      mosquitoActions: { day: manorV7DayKey(now), remaining: MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT },
      mosquitoes: { sourceUserIds: [] },
      mousePresent: false,
      parade: { info: "", patternId: 0, version: 0 },
      manure: 0,
      selectedDecorationIds: [105],
      wild: createManorV7WildState()
    },
    seasonal: createManorV7SeasonalState(now),
    ownedDecorationIds: [1, 2, 3, 4, 105],
    decorationOwnerships: [
      { area: "farm", decorationId: 1, validUntil: 0 },
      { area: "farm", decorationId: 2, validUntil: 0 },
      { area: "farm", decorationId: 3, validUntil: 0 },
      { area: "farm", decorationId: 4, validUntil: 0 },
      { area: "pasture", decorationId: 105, validUntil: 0 }
    ],
    rewardClaims: {
      dailyPackageDay: null,
      signInDay: null,
      signInRewardDay: null,
      signInRewardId: null,
      signInRewardIds: [],
      signInStreak: 0,
      signInStreakRewardDays: [],
      vipReturnGiftClaimed: false
    },
    researchGuideSeen: false,
    tutorialTask: { taskId: 0, accepted: true },
    levelRewardClaims: { farm: 0, pasture: 0 },
    redeemedCodes: [],
    friendFilterUserIds: [],
    receivedFlowers: [],
    nextFlowerGiftId: 1,
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
  for (const land of state.farm.lands) {
    land.thiefUserIds ??= [];
    land.yieldPenaltyPercent ??= 0;
  }
  state.farm.badActions ??= { day: manorV7DayKey(now), remaining: MANOR_V7_BAD_ACTION_DAILY_LIMIT };
  state.farm.manureCollection ??= {
    day: manorV7DayKey(now),
    remaining: MANOR_V7_MANURE_COLLECTION_DAILY_LIMIT
  };
  state.farm.dog ??= { ownedIds: [], activeId: null, feedSeconds: 0 };
  state.farm.weather ??= manorV7Weather(now);
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
  state.farm.fishPool.toolInventory ??= [];
  for (const fish of state.farm.fishPool.fish) {
    fish.stolen ??= 0;
    fish.thiefUserIds ??= [];
    fish.fedStage ??= 0;
    fish.fedStage = Math.min(Math.max(0, Math.trunc(fish.fedStage)), manorV7Fish(fish.fishId).cycleSeconds.length);
  }
  state.farm.selectedBoardId ??= null;
  state.farm.selectedAvatarId ??= null;
  state.pasture.harvestedAnimalInventory ??= [];
  state.pasture.cubInventory ??= [];
  state.pasture.materialInventory ??= [];
  state.pasture.toolInventory ??= [];
  state.pasture.weaponInventory ??= [];
  state.pasture.guards ??= [];
  state.pasture.research ??= {
    hutch: { animalId: null, remainingSeconds: 0 },
    shed: { animalId: null, remainingSeconds: 0 }
  };
  state.pasture.specialFeed ??= { day: manorV7DayKey(now), remaining: MANOR_V7_SPECIAL_FEED_DAILY_LIMIT };
  state.pasture.mosquitoActions ??= {
    day: manorV7DayKey(now),
    remaining: MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT
  };
  state.pasture.mosquitoes ??= { sourceUserIds: [] };
  state.pasture.mousePresent ??= false;
  state.pasture.parade ??= { info: "", patternId: 0, version: 0 };
  state.pasture.wild ??= createManorV7WildState();
  state.seasonal ??= createManorV7SeasonalState(now);
  state.seasonal.animalDrops ??= [];
  state.seasonal.nextAnimalDropSerial ??= Math.max(0, ...state.seasonal.animalDrops.map((drop) => drop.serial)) + 1;
  state.seasonal.candySeedsClaimed ??= false;
  state.seasonal.halloweenCandies ??= 0;
  state.seasonal.candyOfferingDay ??= manorV7DayKey(now);
  state.seasonal.candyOfferingsRemaining ??= MANOR_V7_CANDY_OFFERING_DAILY_LIMIT;
  state.seasonal.candyOfferedByUserIds ??= [];
  state.seasonal.cookieSpritesClaimed ??= false;
  state.seasonal.halloweenCookies ??= 0;
  state.seasonal.cookieOfferingDay ??= manorV7DayKey(now);
  state.seasonal.cookieOfferingsRemaining ??= MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT;
  state.seasonal.cookieOfferedByUserIds ??= [];
  state.seasonal.springFestivalClaimDay ??= null;
  state.seasonal.reunionFishGiftClaimed ??= false;
  state.decorationOwnerships ??= migrateLegacyDecorationOwnerships(state);
  synchronizeDecorationOwnerships(state, now);
  state.rewardClaims ??= {
    dailyPackageDay: null,
    signInDay: null,
    signInRewardDay: null,
    signInRewardId: null,
    signInRewardIds: [],
    signInStreak: 0,
    signInStreakRewardDays: [],
    vipReturnGiftClaimed: false
  };
  state.rewardClaims.signInStreak ??= state.rewardClaims.signInDay ? 1 : 0;
  state.rewardClaims.signInRewardDay ??= state.rewardClaims.signInRewardId
    ? state.rewardClaims.signInDay
    : null;
  state.rewardClaims.signInRewardIds ??= state.rewardClaims.signInRewardId
    ? [state.rewardClaims.signInRewardId]
    : [];
  state.rewardClaims.signInStreakRewardDays ??= [];
  state.rewardClaims.vipReturnGiftClaimed ??= false;
  state.researchGuideSeen ??= true;
  state.tutorialTask ??= { taskId: MANOR_V7_TUTORIAL_TASKS.length, accepted: false };
  state.levelRewardClaims ??= {
    farm: Math.min(MANOR_V7_MAX_LEVEL_REWARD, manorV7LevelForExperience(state.farmExperience)),
    pasture: Math.min(MANOR_V7_MAX_LEVEL_REWARD, manorV7LevelForExperience(state.pastureExperience))
  };
  state.redeemedCodes ??= [];
  state.friendFilterUserIds ??= [];
  state.receivedFlowers ??= [];
  state.nextFlowerGiftId ??= Math.max(0, ...state.receivedFlowers.map((gift) => gift.id)) + 1;
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
  resetDailyCounters(state, now);
  synchronizeWeather(state, now);
  state.farm.dog.feedSeconds = Math.max(0, round(state.farm.dog.feedSeconds - elapsed));

  for (const land of state.farm.lands) {
    if (!land.cropId) continue;
    const crop = manorV7Crop(land.cropId);
    if (land.harvests >= crop.harvestCycles) continue;
    const growableSeconds = Math.min(elapsed, Math.max(0, crop.growthSeconds - land.growthSeconds));
    const careSeverity = Number(land.weeds) + Number(land.pests) + Number(!land.watered) * 2;
    if (careSeverity > 0 && growableSeconds > 0) {
      land.yieldPenaltyPercent = Math.min(
        50,
        round(land.yieldPenaltyPercent + growableSeconds / 300 * careSeverity)
      );
    }
    land.growthSeconds = Math.min(crop.growthSeconds, land.growthSeconds + elapsed);
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
  advanceResearch(state, elapsed, now);
  advanceWildlife(state, now);
  synchronizeDecorationOwnerships(state, now);
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
      badActions: { ...state.farm.badActions },
      manureCollection: { ...state.farm.manureCollection },
      dog: { ...state.farm.dog, ownedIds: [...state.farm.dog.ownedIds] },
      weather: { ...state.farm.weather },
      fishPool: {
        opened: state.farm.fishPool.opened,
        capacity: MANOR_V7_FISH_POOL_CAPACITY,
        nextFishSerial: state.farm.fishPool.nextFishSerial,
        unlockedFishIds: [...state.farm.fishPool.unlockedFishIds],
        fish: state.farm.fishPool.fish.map((fish) => ({ ...fish })),
        seedInventory: cloneInventory(state.farm.fishPool.seedInventory),
        produceInventory: cloneInventory(state.farm.fishPool.produceInventory),
        toolInventory: cloneInventory(state.farm.fishPool.toolInventory)
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
      cubInventory: cloneInventory(state.pasture.cubInventory),
      materialInventory: cloneInventory(state.pasture.materialInventory),
      toolInventory: cloneInventory(state.pasture.toolInventory),
      weaponInventory: cloneInventory(state.pasture.weaponInventory),
      productInventory: cloneInventory(state.pasture.productInventory),
      harvestedAnimalInventory: cloneInventory(state.pasture.harvestedAnimalInventory),
      guards: state.pasture.guards.map((guard) => ({ ...guard })),
      research: {
        hutch: { ...state.pasture.research.hutch },
        shed: { ...state.pasture.research.shed }
      },
      specialFeed: { ...state.pasture.specialFeed },
      mosquitoActions: { ...state.pasture.mosquitoActions },
      mosquitoes: { sourceUserIds: [...state.pasture.mosquitoes.sourceUserIds] },
      mousePresent: state.pasture.mousePresent,
      parade: { ...state.pasture.parade },
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
    seasonal: {
      ...state.seasonal,
      animalDrops: state.seasonal.animalDrops.map((drop) => ({ ...drop })),
      candyOfferedByUserIds: [...state.seasonal.candyOfferedByUserIds],
      cookieOfferedByUserIds: [...state.seasonal.cookieOfferedByUserIds]
    },
    ownedDecorationIds: [...state.ownedDecorationIds],
    decorationOwnerships: state.decorationOwnerships.map((ownership) => ({ ...ownership })),
    rewardClaims: {
      ...state.rewardClaims,
      signInRewardIds: [...state.rewardClaims.signInRewardIds],
      signInStreakRewardDays: [...state.rewardClaims.signInStreakRewardDays]
    },
    researchGuideSeen: state.researchGuideSeen,
    tutorialTask: { ...state.tutorialTask },
    levelRewardClaims: { ...state.levelRewardClaims },
    redeemedCodes: [...state.redeemedCodes],
    friendFilterUserIds: [...state.friendFilterUserIds],
    receivedFlowers: state.receivedFlowers.map((gift) => ({ ...gift })),
    tasks: toTaskViews(state.tasks),
    activities: state.activities.map((activity) => ({ ...activity })),
    catalogs: {
      crops: MANOR_V7_CROPS,
      animals: MANOR_V7_ANIMALS,
      tools: MANOR_V7_TOOLS,
      decorations: MANOR_V7_DECORATIONS,
      fish: MANOR_V7_FISH,
      wildAnimals: MANOR_V7_WILD_ANIMALS,
      wildCrystals: MANOR_V7_WILD_CRYSTALS,
      flowers: MANOR_V7_FLOWERS
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

export function manorV7EffectiveYield(land: ManorV7State["farm"]["lands"][number]): number {
  if (!land.cropId) return 0;
  const crop = manorV7Crop(land.cropId);
  const caredYield = Math.max(1, Math.ceil(crop.baseYield * (100 - land.yieldPenaltyPercent) / 100));
  if (land.tier === "black" && crop.landRequirement !== 2) return Math.max(1, Math.floor(caredYield * 1.2));
  if (land.tier === "red" && crop.landRequirement !== 1) return Math.max(1, Math.floor(caredYield * 1.1));
  return caredYield;
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
    !validDailyCounter(state.farm.badActions, MANOR_V7_BAD_ACTION_DAILY_LIMIT) ||
    !validDailyCounter(state.farm.manureCollection, MANOR_V7_MANURE_COLLECTION_DAILY_LIMIT) ||
    !Array.isArray(state.farm.dog.ownedIds) ||
    new Set(state.farm.dog.ownedIds).size !== state.farm.dog.ownedIds.length ||
    state.farm.dog.ownedIds.some((id) => !MANOR_V7_TOOLS.some((tool) => tool.area === "farm" && tool.itemType === 4 && tool.id === id)) ||
    (state.farm.dog.activeId !== null && !state.farm.dog.ownedIds.includes(state.farm.dog.activeId)) ||
    !Number.isFinite(state.farm.dog.feedSeconds) || state.farm.dog.feedSeconds < 0 ||
    !Number.isFinite(state.pasture.grass) || state.pasture.grass < 0 || state.pasture.grass > MANOR_V7_GRASS_CAPACITY ||
    !validClaimDay(state.rewardClaims.dailyPackageDay) ||
    !validDailyCounter(state.pasture.specialFeed, MANOR_V7_SPECIAL_FEED_DAILY_LIMIT) ||
    !validDailyCounter(state.pasture.mosquitoActions, MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT) ||
    !Array.isArray(state.pasture.mosquitoes.sourceUserIds) ||
    state.pasture.mosquitoes.sourceUserIds.some((userId) => typeof userId !== "string" || userId.length === 0) ||
    typeof state.pasture.mousePresent !== "boolean" ||
    typeof state.pasture.parade.info !== "string" || state.pasture.parade.info.length > 512 ||
    !Number.isInteger(state.pasture.parade.patternId) || state.pasture.parade.patternId < 0 ||
    !Number.isInteger(state.pasture.parade.version) || state.pasture.parade.version < 0 ||
    !validClaimDay(state.rewardClaims.signInDay) ||
    !validClaimDay(state.rewardClaims.signInRewardDay) ||
    (state.rewardClaims.signInRewardId !== null && !validDailySignInRewardId(state.rewardClaims.signInRewardId)) ||
    !Array.isArray(state.rewardClaims.signInRewardIds) ||
    state.rewardClaims.signInRewardIds.length > MANOR_V7_DAILY_SIGN_IN_LIMIT ||
    state.rewardClaims.signInRewardIds.some((id) => !validDailySignInRewardId(id)) ||
    new Set(state.rewardClaims.signInRewardIds).size !== state.rewardClaims.signInRewardIds.length ||
    (state.rewardClaims.signInRewardIds.at(-1) ?? null) !== state.rewardClaims.signInRewardId ||
    (state.rewardClaims.signInRewardIds.length > 0) !== (state.rewardClaims.signInRewardDay !== null) ||
    !Number.isInteger(state.rewardClaims.signInStreak) || state.rewardClaims.signInStreak < 0 ||
    !Array.isArray(state.rewardClaims.signInStreakRewardDays) ||
    state.rewardClaims.signInStreakRewardDays.some((days) => !validStreakSignInRewardDay(days)) ||
    new Set(state.rewardClaims.signInStreakRewardDays).size !== state.rewardClaims.signInStreakRewardDays.length ||
    typeof state.rewardClaims.vipReturnGiftClaimed !== "boolean" ||
    typeof state.researchGuideSeen !== "boolean" ||
    !Number.isInteger(state.tutorialTask.taskId) || state.tutorialTask.taskId < 0 ||
    state.tutorialTask.taskId > MANOR_V7_TUTORIAL_TASKS.length ||
    typeof state.tutorialTask.accepted !== "boolean" ||
    !validLevelRewardClaims(state.levelRewardClaims) ||
    !validRedeemedCodes(state.redeemedCodes) ||
    !validWeather(state.farm.weather) ||
    !validUserIdList(state.friendFilterUserIds) ||
    !Number.isInteger(state.nextFlowerGiftId) || state.nextFlowerGiftId < 1 ||
    !validFlowerGifts(state) ||
    !validSeasonalState(state) ||
    !validDecorationOwnerships(state) ||
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
      !Number.isFinite(land.yieldPenaltyPercent) ||
      land.yieldPenaltyPercent < 0 || land.yieldPenaltyPercent > 50 ||
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
    if (
      fishSerials.has(fish.serial) || fish.growthSeconds < 0 || fish.stolen < 0 ||
      !Array.isArray(fish.thiefUserIds) || new Set(fish.thiefUserIds).size !== fish.thiefUserIds.length ||
      !Number.isInteger(fish.fedStage) || fish.fedStage < 0 || fish.fedStage > definition.cycleSeconds.length
    ) throw new Error("V7 鱼塘状态无效");
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
  validateInventory(state.farm.fishPool.toolInventory);
  validateInventory(state.pasture.productInventory);
  validateInventory(state.pasture.harvestedAnimalInventory);
  validateInventory(state.pasture.cubInventory);
  validateInventory(state.pasture.materialInventory);
  validateInventory(state.pasture.toolInventory);
  validateInventory(state.pasture.weaponInventory);
  for (const entry of state.pasture.cubInventory) manorV7Animal(entry.sourceId);
  for (const entry of state.pasture.toolInventory) {
    const tool = MANOR_V7_TOOLS.find((candidate) => candidate.area === "pasture" && candidate.id === entry.sourceId && [7, 12].includes(candidate.itemType));
    if (!tool) throw new Error("V7 牧场道具库存无效");
  }
  for (const entry of state.pasture.weaponInventory) {
    if (!MANOR_V7_TOOLS.some((tool) => tool.area === "pasture" && tool.itemType === 10 && tool.id === entry.sourceId)) {
      throw new Error("V7 牧场武器库存无效");
    }
  }
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
  for (const house of ["hutch", "shed"] as const) {
    const slot = state.pasture.research[house];
    if (
      !Number.isFinite(slot.remainingSeconds) || slot.remainingSeconds < 0 ||
      (slot.animalId === null && slot.remainingSeconds !== 0) ||
      (slot.animalId !== null && !MANOR_V7_RESEARCH_RULES[house].some((rule) => rule.animalId === slot.animalId))
    ) throw new Error("V7 牧场科研状态无效");
  }
  validateWildlife(state);
}

function migrateLegacyDecorationOwnerships(state: ManorV7State): ManorV7State["decorationOwnerships"] {
  const ownerships: ManorV7State["decorationOwnerships"] = [];
  for (const decorationId of state.ownedDecorationIds) {
    const selectedAreas = (["farm", "pasture"] as const).filter((area) => (
      (area === "farm" ? state.farm.selectedDecorationIds : state.pasture.selectedDecorationIds).includes(decorationId)
    ));
    const candidateAreas = selectedAreas.length > 0 ? selectedAreas : (["farm", "pasture"] as const);
    for (const area of candidateAreas) {
      try {
        manorV7Decoration(area, decorationId);
        ownerships.push({ area, decorationId, validUntil: 0 });
      } catch {
        // Legacy ownership IDs did not include an area; skip IDs absent from this area's V7 catalog.
      }
    }
  }
  return ownerships;
}

function synchronizeDecorationOwnerships(state: ManorV7State, now: number): void {
  const current = state.decorationOwnerships.filter((ownership) => (
    ownership.validUntil === 0 || ownership.validUntil > now
  ));
  const activeKeys = new Set(current.map((ownership) => `${ownership.area}:${ownership.decorationId}`));
  state.farm.selectedDecorationIds = state.farm.selectedDecorationIds.filter((id) => activeKeys.has(`farm:${id}`));
  state.pasture.selectedDecorationIds = state.pasture.selectedDecorationIds.filter((id) => activeKeys.has(`pasture:${id}`));
  state.ownedDecorationIds = [...new Set(current.map((ownership) => ownership.decorationId))]
    .sort((left, right) => left - right);
}

function validDecorationOwnerships(state: ManorV7State): boolean {
  if (!Array.isArray(state.decorationOwnerships)) return false;
  const keys = new Set<string>();
  for (const ownership of state.decorationOwnerships) {
    if (
      (ownership.area !== "farm" && ownership.area !== "pasture") ||
      !Number.isInteger(ownership.decorationId) ||
      !Number.isInteger(ownership.validUntil) || ownership.validUntil < 0
    ) return false;
    try {
      manorV7Decoration(ownership.area, ownership.decorationId);
    } catch {
      return false;
    }
    const key = `${ownership.area}:${ownership.decorationId}`;
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}

function validRedeemedCodes(codes: string[]): boolean {
  return Array.isArray(codes) &&
    new Set(codes).size === codes.length &&
    codes.every((code) => /^[A-Z0-9_-]{1,64}$/.test(code));
}

function validWeather(weather: ManorV7State["farm"]["weather"]): boolean {
  return validClaimDay(weather.day) && weather.day !== null &&
    (weather.kind === "sunny" || weather.kind === "rainy");
}

function validUserIdList(userIds: string[]): boolean {
  return Array.isArray(userIds) && new Set(userIds).size === userIds.length &&
    userIds.every((userId) => typeof userId === "string" && userId.length > 0 && userId.length <= 128);
}

function validFlowerGifts(state: ManorV7State): boolean {
  if (!Array.isArray(state.receivedFlowers) || state.receivedFlowers.length > 200) return false;
  const ids = new Set<number>();
  for (const gift of state.receivedFlowers) {
    if (
      !Number.isInteger(gift.id) || gift.id < 1 || gift.id >= state.nextFlowerGiftId || ids.has(gift.id) ||
      typeof gift.fromUserId !== "string" || gift.fromUserId.length < 1 || gift.fromUserId.length > 128 ||
      typeof gift.fromDisplayName !== "string" || gift.fromDisplayName.length < 1 || gift.fromDisplayName.length > 128 ||
      typeof gift.message !== "string" || gift.message.length > 200 ||
      !Number.isInteger(gift.sentAt) || gift.sentAt < 0
    ) return false;
    try {
      manorV7Flower(gift.flowerId);
    } catch {
      return false;
    }
    ids.add(gift.id);
  }
  return true;
}

function validSeasonalState(state: ManorV7State): boolean {
  const seasonal = state.seasonal;
  if (
    !Array.isArray(seasonal.animalDrops) ||
    seasonal.animalDrops.length > MANOR_V7_SEASONAL_ANIMAL_DROP_LIMIT ||
    !Number.isInteger(seasonal.nextAnimalDropSerial) || seasonal.nextAnimalDropSerial < 1 ||
    typeof seasonal.candySeedsClaimed !== "boolean" ||
    !Number.isSafeInteger(seasonal.halloweenCandies) || seasonal.halloweenCandies < 0 ||
    !validClaimDay(seasonal.candyOfferingDay) ||
    !Number.isInteger(seasonal.candyOfferingsRemaining) || seasonal.candyOfferingsRemaining < 0 ||
    seasonal.candyOfferingsRemaining > MANOR_V7_CANDY_OFFERING_DAILY_LIMIT ||
    !validUserIdList(seasonal.candyOfferedByUserIds) ||
    typeof seasonal.cookieSpritesClaimed !== "boolean" ||
    !Number.isSafeInteger(seasonal.halloweenCookies) || seasonal.halloweenCookies < 0 ||
    !validClaimDay(seasonal.cookieOfferingDay) ||
    !Number.isInteger(seasonal.cookieOfferingsRemaining) || seasonal.cookieOfferingsRemaining < 0 ||
    seasonal.cookieOfferingsRemaining > MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT ||
    !validUserIdList(seasonal.cookieOfferedByUserIds) ||
    !validClaimDay(seasonal.springFestivalClaimDay)
    || typeof seasonal.reunionFishGiftClaimed !== "boolean"
  ) return false;
  const serials = new Set<number>();
  for (const drop of seasonal.animalDrops) {
    if (
      !Number.isInteger(drop.serial) || drop.serial < 1 || drop.serial >= seasonal.nextAnimalDropSerial ||
      serials.has(drop.serial) ||
      !MANOR_V7_SEASONAL_ANIMAL_IDS.includes(
        drop.animalId as (typeof MANOR_V7_SEASONAL_ANIMAL_IDS)[number]
      ) ||
      !Number.isInteger(drop.createdAt) || drop.createdAt < 0
    ) return false;
    serials.add(drop.serial);
  }
  return true;
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

function validDailySignInRewardId(value: number): boolean {
  return MANOR_V7_DAILY_SIGN_IN_REWARDS.some((reward) => reward.id === value);
}

function validStreakSignInRewardDay(value: number): boolean {
  return MANOR_V7_STREAK_SIGN_IN_REWARDS.some((reward) => reward.days === value);
}

function validLevelRewardClaims(value: ManorV7State["levelRewardClaims"]): boolean {
  return Number.isInteger(value.farm) && value.farm >= 0 && value.farm <= MANOR_V7_MAX_LEVEL_REWARD &&
    Number.isInteger(value.pasture) && value.pasture >= 0 && value.pasture <= MANOR_V7_MAX_LEVEL_REWARD;
}

function createFishPool(): ManorV7State["farm"]["fishPool"] {
  return {
    opened: true,
    nextFishSerial: 1,
    unlockedFishIds: MANOR_V7_FISH
      .filter((fish) => !fish.isHidden && fish.unlockCoins === 0 && fish.unlockCrystalAmount === 0)
      .map((fish) => fish.id),
    fish: [] as ManorV7FishState[],
    seedInventory: [],
    produceInventory: [],
    toolInventory: []
  };
}

function createManorV7SeasonalState(now: number): ManorV7State["seasonal"] {
  return {
    animalDrops: [],
    nextAnimalDropSerial: 1,
    candySeedsClaimed: false,
    halloweenCandies: 0,
    candyOfferingDay: manorV7DayKey(now),
    candyOfferingsRemaining: MANOR_V7_CANDY_OFFERING_DAILY_LIMIT,
    candyOfferedByUserIds: [],
    cookieSpritesClaimed: false,
    halloweenCookies: 0,
    cookieOfferingDay: manorV7DayKey(now),
    cookieOfferingsRemaining: MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT,
    cookieOfferedByUserIds: [],
    springFestivalClaimDay: null,
    reunionFishGiftClaimed: false
  };
}

function validDailyCounter(value: { day: string | null; remaining: number }, limit: number): boolean {
  return validClaimDay(value.day) && Number.isInteger(value.remaining) && value.remaining >= 0 && value.remaining <= limit;
}

function resetDailyCounters(state: ManorV7State, now: number): void {
  const day = manorV7DayKey(now);
  if (state.farm.badActions.day !== day) state.farm.badActions = { day, remaining: MANOR_V7_BAD_ACTION_DAILY_LIMIT };
  if (state.farm.manureCollection.day !== day) {
    state.farm.manureCollection = { day, remaining: MANOR_V7_MANURE_COLLECTION_DAILY_LIMIT };
  }
  if (state.pasture.specialFeed.day !== day) state.pasture.specialFeed = { day, remaining: MANOR_V7_SPECIAL_FEED_DAILY_LIMIT };
  if (state.pasture.mosquitoActions.day !== day) {
    state.pasture.mosquitoActions = { day, remaining: MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT };
  }
  if (state.seasonal.candyOfferingDay !== day) {
    state.seasonal.candyOfferingDay = day;
    state.seasonal.candyOfferingsRemaining = MANOR_V7_CANDY_OFFERING_DAILY_LIMIT;
    state.seasonal.candyOfferedByUserIds = [];
  }
  if (state.seasonal.cookieOfferingDay !== day) {
    state.seasonal.cookieOfferingDay = day;
    state.seasonal.cookieOfferingsRemaining = MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT;
    state.seasonal.cookieOfferedByUserIds = [];
  }
}

function manorV7Weather(now: number): ManorV7State["farm"]["weather"] {
  const local = new Date(now + 8 * 60 * 60 * 1_000);
  return {
    day: manorV7DayKey(now),
    kind: local.getUTCDay() === 4 ? "rainy" : "sunny"
  };
}

function synchronizeWeather(state: ManorV7State, now: number): void {
  const current = manorV7Weather(now);
  if (state.farm.weather.day !== current.day || state.farm.weather.kind !== current.kind) {
    state.farm.weather = current;
    addManorV7Activity(state, "farm", current.kind === "rainy" ? "今天是雨天，土地会保持湿润" : "今天是晴天", now);
  }
  if (current.kind === "rainy") {
    for (const land of state.farm.lands) {
      if (land.cropId && land.harvests < manorV7Crop(land.cropId).harvestCycles) land.watered = true;
    }
  }
}

function advanceResearch(state: ManorV7State, elapsed: number, now: number): void {
  for (const house of ["hutch", "shed"] as const) {
    const slot = state.pasture.research[house];
    if (slot.animalId === null) continue;
    const previous = slot.remainingSeconds;
    slot.remainingSeconds = Math.max(0, round(slot.remainingSeconds - elapsed));
    if (previous > 0 && slot.remainingSeconds === 0) {
      addManorV7Activity(state, "pasture", `${manorV7Animal(slot.animalId).name}科研完成，可以领取幼崽`, now);
    }
  }
}

function toLandView(land: ManorV7State["farm"]["lands"][number]): ManorV7LandView {
  if (!land.unlocked) return { ...land, visualState: "locked", remainingSeconds: 0, harvestable: false, effectiveYield: 0 };
  if (!land.cropId) return { ...land, visualState: "empty", remainingSeconds: 0, harvestable: false, effectiveYield: 0 };
  const crop = manorV7Crop(land.cropId);
  const final = land.harvests >= crop.harvestCycles;
  const visualState = final ? "withered" : cropVisualState(crop.stageSeconds, crop.growthSeconds, land.growthSeconds);
  return {
    ...land,
    crop,
    visualState,
    remainingSeconds: final ? 0 : Math.max(0, crop.growthSeconds - land.growthSeconds),
    harvestable: visualState === "mature",
    effectiveYield: manorV7EffectiveYield(land)
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
    if (guard.remainingSeconds === 0) guard.active = false;
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
  const pastureRoll = drawManorV7Random(state);
  if (pastureRoll < 0.08 && !state.pasture.mosquitoes.sourceUserIds.includes("system")) {
    state.pasture.mosquitoes.sourceUserIds.push("system");
    addManorV7Activity(state, "pasture", "牧场出现了蚊子", now);
  } else if (pastureRoll < 0.12 && !state.pasture.mousePresent) {
    state.pasture.mousePresent = true;
    addManorV7Activity(state, "pasture", "牧场出现了老鼠", now);
  }
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
