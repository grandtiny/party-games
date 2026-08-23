import { describe, expect, it } from "vitest";
import {
  MANOR_V7_ANIMALS,
  MANOR_V7_CROPS,
  MANOR_V7_DECORATIONS,
  MANOR_V7_DAILY_SIGN_IN_LIMIT,
  MANOR_V7_FISH,
  MANOR_V7_LAND_COUNT,
  MANOR_V7_TOOLS,
  advanceManorV7State,
  createManorV7State,
  inventoryQuantity,
  manorV7DailySignInReward,
  manorV7Animal,
  manorV7Crop,
  manorV7Decoration,
  manorV7ExperienceForLevel,
  manorV7Fish,
  manorV7HouseCapacity,
  manorV7LevelForExperience,
  manorV7MaxProductionCount,
  manorV7PastureGuard,
  manorV7ProductionCycleDuration,
  migrateManorV7State,
  toManorV7View,
  transitionManorV7FriendStates,
  transitionManorV7State,
  type ManorV7State
} from "../src/index.js";

describe("QQ Farm V7 domain", () => {
  it("uses the complete audited V7 runtime catalog", () => {
    expect(MANOR_V7_CROPS).toHaveLength(231);
    expect(MANOR_V7_ANIMALS).toHaveLength(155);
    expect(MANOR_V7_TOOLS).toHaveLength(91);
    expect(MANOR_V7_DECORATIONS).toHaveLength(603);
    expect(MANOR_V7_FISH).toHaveLength(12);
    expect(MANOR_V7_CROPS.filter((crop) => crop.landRequirement === 2)).toHaveLength(12);
    expect(manorV7Crop(1)).toMatchObject({ name: "草莓", seedPrice: 605, harvestCycles: 2 });
    expect(manorV7Animal(1002)).toMatchObject({
      name: "兔子",
      house: "hutch",
      purchasePrice: 1200,
      productionCooldownSeconds: 28_785,
      lifecycleSeconds: 165_600
    });
    expect(manorV7Animal(1502)).toMatchObject({ name: "牛", house: "shed" });
    expect(manorV7Fish(2)).toMatchObject({ name: "小丑鱼", seedPrice: 650, salePrice: 90 });
    expect(manorV7Decoration("farm", 1)).toMatchObject({ name: "田园风光", itemType: 1 });
  });

  it("matches the V7 level formula and house capacities", () => {
    for (const level of [0, 1, 5, 20, 60]) {
      expect(manorV7LevelForExperience(manorV7ExperienceForLevel(level))).toBe(level);
    }
    expect(manorV7HouseCapacity("hutch", 1)).toBe(2);
    expect(manorV7HouseCapacity("hutch", 3)).toBe(5);
    expect(manorV7HouseCapacity("shed", 0)).toBe(0);
    expect(manorV7HouseCapacity("shed", 4)).toBe(6);
  });

  it("creates only the V7 default farm and pasture state", () => {
    const state = createManorV7State(1_000);
    expect(state.farm.lands).toHaveLength(MANOR_V7_LAND_COUNT);
    expect(state.farm.lands.filter((land) => land.unlocked)).toHaveLength(6);
    expect(state.farm.lands.slice(0, 4).map((land) => land.cropId)).toEqual([6, 1, 1, 1]);
    expect(state.pasture.animals.map((animal) => animal.animalId)).toEqual([1002, 1002]);
    expect(state.pasture.grass).toBe(20);
    expect(toManorV7View(state, { userId: "u1", displayName: "玩家" }, 1_000).version)
      .toBe("7.0 Beta1 Build 20120209.1000");
  });

  it("persists farm boards and avatars independently from regular decorations", () => {
    const initial = createManorV7State(2_000);
    const withBoard = transitionManorV7State(initial, { type: "set-board", boardId: 90020 }, 2_000);
    const withAvatar = transitionManorV7State(withBoard, { type: "set-avatar", avatarId: 515000 }, 2_000);
    expect(withAvatar.farm).toMatchObject({
      selectedDecorationIds: [1, 2, 3, 4],
      selectedBoardId: 90020,
      selectedAvatarId: 515000
    });

    const clearedBoard = transitionManorV7State(withAvatar, { type: "set-board", boardId: null }, 2_000);
    const clearedAvatar = transitionManorV7State(clearedBoard, { type: "set-avatar", avatarId: null }, 2_000);
    expect(clearedAvatar.farm).toMatchObject({ selectedBoardId: null, selectedAvatarId: null });
    expect(() => transitionManorV7State(initial, { type: "set-board", boardId: 1 }, 2_000))
      .toThrow("告示牌不存在");
    expect(() => transitionManorV7State(initial, { type: "set-board", boardId: 90019 }, 2_000))
      .toThrow("告示牌不存在");
  });

  it("advances crops deterministically and closes the harvest-sale-plant loop", () => {
    const initial = createManorV7State(1_000);
    const advanced = advanceManorV7State(initial, 1_001_000, { timeScale: 100 });
    expect(toManorV7View(advanced, { userId: "u1", displayName: "玩家" }, 1_001_000).farm.lands[0]?.harvestable).toBe(true);

    const harvested = transitionManorV7State(advanced, { type: "harvest", landId: 1 }, 1_001_000);
    const crop = manorV7Crop(6);
    expect(inventoryQuantity(harvested.farm.produceInventory, 6)).toBe(crop.baseYield);
    const sold = transitionManorV7State(harvested, { type: "sell-produce", cropId: 6, quantity: crop.baseYield }, 1_001_000);
    expect(sold.coins).toBeGreaterThan(0);

    const clearedAfterFinal = {
      ...sold,
      farm: {
        ...sold.farm,
        lands: sold.farm.lands.map((land) => land.id === 1 ? { ...land, harvests: crop.harvestCycles } : land)
      }
    };
    const cleared = transitionManorV7State(clearedAfterFinal, { type: "clear-land", landId: 1 }, 1_001_000);
    const withSeed = {
      ...cleared,
      farm: { ...cleared.farm, seedInventory: [{ sourceId: 2, quantity: 1 }] }
    };
    const planted = transitionManorV7State(withSeed, { type: "plant", landId: 1, cropId: 2 }, 1_001_000);
    expect(planted.farm.lands[0]?.cropId).toBe(2);
  });

  it("sells every produce entry atomically at its own catalog price", () => {
    const initial = createManorV7State(2_000);
    initial.coins = 50;
    initial.farm.produceInventory = [
      { sourceId: 1, quantity: 3 },
      { sourceId: 6, quantity: 2 }
    ];

    const sold = transitionManorV7State(initial, { type: "sell-all-produce" }, 2_000);

    expect(sold.coins).toBe(50 + manorV7Crop(1).salePrice * 3 + manorV7Crop(6).salePrice * 2);
    expect(sold.farm.produceInventory).toEqual([]);
    expect(sold.activities[0]?.message).toContain("卖出全部");
  });

  it("persists produce locks and excludes locked entries from every sale path", () => {
    const initial = createManorV7State(2_100);
    initial.coins = 50;
    initial.farm.produceInventory = [
      { sourceId: 1, quantity: 3 },
      { sourceId: 6, quantity: 2 }
    ];

    const locked = transitionManorV7State(initial, { type: "set-produce-lock", cropId: 1, locked: true }, 2_100);
    expect(() => transitionManorV7State(locked, { type: "sell-produce", cropId: 1, quantity: 1 }, 2_100))
      .toThrow("锁定的农产品不能出售");

    const sold = transitionManorV7State(locked, { type: "sell-all-produce" }, 2_100);
    expect(sold.coins).toBe(50 + manorV7Crop(6).salePrice * 2);
    expect(sold.farm.produceInventory).toEqual([{ sourceId: 1, quantity: 3, locked: true }]);
  });

  it("runs the original manual production lifecycle before an animal can be harvested", () => {
    const now = 5_000;
    const initial = createManorV7State(now);
    const animal = manorV7Animal(1002);
    const animalState = initial.pasture.animals[1]!;
    initial.pasture.animals = [animalState];
    initial.pasture.grass = 400;
    Object.assign(animalState, {
      growthSeconds: animal.maturitySeconds,
      productionActive: false,
      productionProgressSeconds: 0,
      productionCount: 0,
      pendingProduct: 0
    });

    const waiting = advanceManorV7State(initial, now + 3_600_000);
    expect(waiting.pasture.animals[0]).toMatchObject({
      growthSeconds: animal.maturitySeconds,
      productionActive: false,
      productionCount: 0,
      pendingProduct: 0
    });
    expect(toManorV7View(waiting, { userId: "u1", displayName: "玩家" }, waiting.updatedAt)
      .pasture.animals[0]?.visualState).toBe("production-ready");
    expect(() => transitionManorV7State(
      waiting,
      { type: "harvest-animals", serial: animalState.serial },
      waiting.updatedAt
    )).toThrow("生产次数尚未完成");

    let current = waiting;
    const maxProductionCount = manorV7MaxProductionCount(animal);
    for (let cycleIndex = 0; cycleIndex < maxProductionCount; cycleIndex += 1) {
      current = transitionManorV7State(
        current,
        { type: "start-production", serial: animalState.serial },
        current.updatedAt
      );
      expect(toManorV7View(current, { userId: "u1", displayName: "玩家" }, current.updatedAt)
        .pasture.animals[0]?.visualState).toBe("production-action");

      current = advanceManorV7State(
        current,
        current.updatedAt + animal.productionActionSeconds * 1_000
      );
      expect(current.pasture.animals[0]).toMatchObject({
        productionActive: true,
        productionCount: cycleIndex + 1,
        pendingProduct: animal.baseYield
      });
      expect(toManorV7View(current, { userId: "u1", displayName: "玩家" }, current.updatedAt)
        .pasture.animals[0]?.visualState).toBe("production-cooldown");

      expect(() => transitionManorV7State(
        current,
        { type: "start-production", serial: animalState.serial },
        current.updatedAt
      )).toThrow("正在生产或冷却");
      current = transitionManorV7State(
        current,
        { type: "collect-product", serial: animalState.serial },
        current.updatedAt
      );
      expect(inventoryQuantity(current.pasture.productInventory, animal.id))
        .toBe(animal.baseYield * (cycleIndex + 1));

      const cooldown = manorV7ProductionCycleDuration(animal, cycleIndex) - animal.productionActionSeconds;
      current = advanceManorV7State(current, current.updatedAt + cooldown * 1_000);
      expect(current.pasture.animals[0]?.productionActive).toBe(false);
      expect(toManorV7View(current, { userId: "u1", displayName: "玩家" }, current.updatedAt)
        .pasture.animals[0]?.visualState).toBe(
          cycleIndex + 1 === maxProductionCount ? "harvestable" : "production-ready"
        );
    }

    expect(current.pasture.animals[0]?.growthSeconds).toBe(animal.lifecycleSeconds);
    const harvested = transitionManorV7State(
      current,
      { type: "harvest-animals", serial: animalState.serial },
      current.updatedAt
    );
    expect(harvested.pasture.animals).toEqual([]);
    expect(inventoryQuantity(harvested.pasture.harvestedAnimalInventory, animal.id)).toBe(1);
  });

  it("moves grass from farm inventory into the pasture without charging coins", () => {
    const initial = createManorV7State(6_000);
    initial.coins = 1_000;
    initial.farm.produceInventory = [{ sourceId: 40, quantity: 5 }];

    const fed = transitionManorV7State(
      initial,
      { type: "feed-grass-from-inventory", quantity: 3 },
      6_000
    );

    expect(fed.coins).toBe(1_000);
    expect(fed.pasture.grass).toBe(23);
    expect(inventoryQuantity(fed.farm.produceInventory, 40)).toBe(2);
    expect(fed.revision).toBe(initial.revision + 1);
  });

  it("buys grass into the backpack separately and exposes whole feed amounts", () => {
    const initial = createManorV7State(6_100);
    initial.coins = 1_000;
    initial.pasture.grass = 20.875;

    const bought = transitionManorV7State(
      initial,
      { type: "buy-grass-to-inventory", quantity: 3 },
      6_100
    );

    expect(bought.coins).toBe(910);
    expect(bought.pasture.grass).toBe(20.875);
    expect(inventoryQuantity(bought.farm.produceInventory, 40)).toBe(3);
    expect(toManorV7View(bought, { userId: "u1", displayName: "玩家" }, 6_100).pasture.grass).toBe(20);
  });

  it("persists an active pasture guard and consumes its included wage over time", () => {
    const initial = createManorV7State(6_200);
    initial.coins = 20_000;
    const guard = manorV7PastureGuard(1);

    const bought = transitionManorV7State(initial, { type: "buy-pasture-guard", guardId: guard.id }, 6_200);
    expect(bought.coins).toBe(20_000 - guard.coinPrice);
    expect(bought.pasture.guards).toEqual([{
      id: guard.id,
      remainingSeconds: 7 * 24 * 60 * 60,
      active: true
    }]);

    const advanced = advanceManorV7State(bought, 6_200 + 3_600_000);
    expect(advanced.pasture.guards[0]?.remainingSeconds).toBe(6 * 24 * 60 * 60 + 23 * 60 * 60);
  });

  it("shares two VIP sign-in cards per Shanghai calendar day", () => {
    const now = Date.UTC(2026, 7, 22, 2, 0, 0);
    const initial = createManorV7State(now);
    const packaged = transitionManorV7State(initial, { type: "claim-daily-package" }, now);
    expect(packaged.coins).toBe(300);
    expect(packaged.rewardClaims.dailyPackageDay).toBe("2026-08-22");
    expect(() => transitionManorV7State(packaged, { type: "claim-daily-package" }, now)).toThrow("已经领取");

    const visited = transitionManorV7State(packaged, { type: "record-sign-in-visit" }, now);
    expect(visited.rewardClaims).toMatchObject({
      signInDay: "2026-08-22",
      signInStreak: 1
    });
    const first = transitionManorV7State(visited, { type: "claim-sign-in" }, now);
    expectSignInRewardApplied(visited, first, first.rewardClaims.signInRewardId!);
    const second = transitionManorV7State(first, { type: "claim-sign-in" }, now);
    expectSignInRewardApplied(first, second, second.rewardClaims.signInRewardId!);
    expect(second.rewardClaims).toMatchObject({
      signInRewardDay: "2026-08-22",
      signInRewardId: second.rewardClaims.signInRewardIds[1],
      signInRewardIds: [expect.any(Number), expect.any(Number)],
      signInStreak: 1
    });
    expect(new Set(second.rewardClaims.signInRewardIds).size).toBe(MANOR_V7_DAILY_SIGN_IN_LIMIT);
    expect(() => transitionManorV7State(second, { type: "claim-sign-in" }, now)).toThrow("次数已经用完");

    const tomorrow = now + 24 * 60 * 60 * 1_000;
    expect(transitionManorV7State(second, { type: "claim-daily-package" }, tomorrow).rewardClaims.dailyPackageDay)
      .toBe("2026-08-23");
    const signedTomorrow = transitionManorV7State(second, { type: "claim-sign-in" }, tomorrow);
    expect(signedTomorrow.rewardClaims).toMatchObject({
      signInDay: "2026-08-23",
      signInRewardDay: "2026-08-23",
      signInRewardIds: [expect.any(Number)],
      signInStreak: 2
    });

    const afterGap = tomorrow + 2 * 24 * 60 * 60 * 1_000;
    const visitedAfterGap = transitionManorV7State(signedTomorrow, { type: "record-sign-in-visit" }, afterGap);
    expect(visitedAfterGap.rewardClaims).toMatchObject({
      signInDay: "2026-08-25",
      signInStreak: 1,
      signInStreakRewardDays: []
    });
  });

  it("grants original 3, 5 and 7 day pasture sign-in rewards once per streak", () => {
    const start = Date.UTC(2026, 7, 1, 2, 0, 0);
    let state = createManorV7State(start);
    for (let day = 1; day <= 7; day += 1) {
      const now = start + (day - 1) * 24 * 60 * 60 * 1_000;
      state = transitionManorV7State(state, { type: "record-sign-in-visit" }, now);
      if (day === 3 || day === 5 || day === 7) {
        state = transitionManorV7State(state, { type: "claim-sign-in-streak-reward", days: day }, now);
      }
    }
    expect(state.rewardClaims.signInStreakRewardDays).toEqual([3, 5, 7]);
    expect(inventoryQuantity(state.farm.produceInventory, 40)).toBe(100);
    expect(inventoryQuantity(state.pasture.cubInventory, 1047)).toBe(1);
    expect(inventoryQuantity(state.pasture.cubInventory, 1035)).toBe(1);
    expect(() => transitionManorV7State(
      state,
      { type: "claim-sign-in-streak-reward", days: 7 },
      start + 6 * 24 * 60 * 60 * 1_000
    )).toThrow("已经领取");
  });

  it("raises sign-in animals and consumes sign-in cans from the pasture package", () => {
    const now = 7_000;
    const initial = createManorV7State(now);
    initial.pasture.hutchLevel = 2;
    initial.pasture.cubInventory = [{ sourceId: 1050, quantity: 1 }];
    initial.pasture.toolInventory = [{ sourceId: 1, quantity: 1 }];
    const raised = transitionManorV7State(
      initial,
      { type: "raise-animal-from-inventory", animalId: 1050, quantity: 1 },
      now
    );
    const pigeon = raised.pasture.animals.find((animal) => animal.animalId === 1050);
    expect(pigeon).toBeDefined();
    expect(raised.pasture.cubInventory).toEqual([]);

    const accelerated = transitionManorV7State(
      raised,
      { type: "use-pasture-can", serial: pigeon!.serial, toolId: 1 },
      now
    );
    expect(accelerated.pasture.toolInventory).toEqual([]);
    expect(accelerated.pasture.animals.find((animal) => animal.serial === pigeon!.serial)?.growthSeconds)
      .toBe(10_800);
  });

  it("closes the fish unlock, buy, plant, harvest and sale loop", () => {
    const now = 6_500;
    const initial = createManorV7State(now);
    initial.coins = 20_000;
    const unlocked = transitionManorV7State(initial, { type: "unlock-fish", fishId: 2 }, now);
    expect(unlocked.coins).toBe(10_000);
    const bought = transitionManorV7State(unlocked, { type: "buy-fish-seed", fishId: 2, quantity: 1 }, now);
    expect(bought.coins).toBe(9_350);
    const planted = transitionManorV7State(bought, { type: "plant-fish", fishId: 2 }, now);
    expect(planted.farm.fishPool.fish).toEqual([expect.objectContaining({ serial: 1, fishId: 2 })]);

    const matured = advanceManorV7State(planted, now + manorV7Fish(2).cycleSeconds.at(-1)! * 1_000);
    const harvested = transitionManorV7State(matured, { type: "harvest-fish", serial: 1 }, matured.updatedAt);
    expect(inventoryQuantity(harvested.farm.fishPool.produceInventory, 2)).toBe(15);
    const sold = transitionManorV7State(harvested, { type: "sell-fish", fishId: 2, quantity: 15 }, harvested.updatedAt);
    expect(sold.coins).toBe(10_700);
    expect(sold.farm.fishPool.produceInventory).toEqual([]);
  });

  it("harvests adult animals into inventory before they are sold", () => {
    const initial = createManorV7State(7_000);
    initial.coins = 500;
    for (const animal of initial.pasture.animals) {
      const definition = manorV7Animal(animal.animalId);
      animal.growthSeconds = definition.lifecycleSeconds;
      animal.productionActive = false;
      animal.productionProgressSeconds = 0;
      animal.productionCount = manorV7MaxProductionCount(definition);
      animal.pendingProduct = 0;
    }

    const harvested = transitionManorV7State(initial, { type: "harvest-animals" }, 7_000);
    expect(harvested.pasture.animals).toEqual([]);
    expect(inventoryQuantity(harvested.pasture.harvestedAnimalInventory, 1002)).toBe(2);
    expect(harvested.coins).toBe(500);

    const sold = transitionManorV7State(
      harvested,
      { type: "sell-harvested-animal", animalId: 1002, quantity: 1 },
      7_000
    );
    expect(inventoryQuantity(sold.pasture.harvestedAnimalInventory, 1002)).toBe(1);
    expect(sold.coins).toBe(500 + manorV7Animal(1002).productPrice);
  });

  it("sells all pasture byproducts and harvested animals atomically", () => {
    const initial = createManorV7State(7_100);
    initial.coins = 500;
    initial.pasture.productInventory = [{ sourceId: 1002, quantity: 4 }];
    initial.pasture.harvestedAnimalInventory = [{ sourceId: 1002, quantity: 2 }];

    const sold = transitionManorV7State(initial, { type: "sell-all-pasture-products" }, 7_100);
    const animal = manorV7Animal(1002);
    expect(sold.coins).toBe(500 + animal.byproductPrice * 4 + animal.productPrice * 2);
    expect(sold.pasture.productInventory).toEqual([]);
    expect(sold.pasture.harvestedAnimalInventory).toEqual([]);
  });

  it("migrates saves created before adult animal inventory was added", () => {
    const legacy = createManorV7State(8_000) as ManorV7State & {
      farm: Omit<ManorV7State["farm"], "fishPool" | "selectedBoardId" | "selectedAvatarId"> & {
        fishPool?: ManorV7State["farm"]["fishPool"];
        selectedBoardId?: number | null;
        selectedAvatarId?: number | null;
      };
      pasture: ManorV7State["pasture"] & {
        cubInventory?: ManorV7State["pasture"]["cubInventory"];
        toolInventory?: ManorV7State["pasture"]["toolInventory"];
        harvestedAnimalInventory?: ManorV7State["pasture"]["harvestedAnimalInventory"];
        guards?: ManorV7State["pasture"]["guards"];
        wild?: ManorV7State["pasture"]["wild"];
      };
      rewardClaims?: ManorV7State["rewardClaims"];
    };
    delete legacy.farm.fishPool;
    delete legacy.farm.selectedBoardId;
    delete legacy.farm.selectedAvatarId;
    delete legacy.pasture.harvestedAnimalInventory;
    delete legacy.pasture.cubInventory;
    delete legacy.pasture.toolInventory;
    delete legacy.pasture.guards;
    delete legacy.pasture.wild;
    delete legacy.rewardClaims;
    for (const animal of legacy.pasture.animals) {
      delete (animal as Partial<typeof animal>).productionActive;
      delete (animal as Partial<typeof animal>).productionCount;
    }
    const migrated = migrateManorV7State(legacy, 8_000);
    expect(migrated.pasture.harvestedAnimalInventory).toEqual([]);
    expect(migrated.pasture.guards).toEqual([]);
    expect(migrated.pasture.wild).toMatchObject({ moralExperience: 0, maxSlotId: 0, slots: [], crystalInventory: [] });
    expect(migrated.farm.fishPool).toMatchObject({ opened: true, fish: [], seedInventory: [], produceInventory: [] });
    expect(migrated.farm).toMatchObject({ selectedBoardId: null, selectedAvatarId: null });
    expect(migrated.rewardClaims).toEqual({
      dailyPackageDay: null,
      signInDay: null,
      signInRewardDay: null,
      signInRewardId: null,
      signInRewardIds: [],
      signInStreak: 0,
      signInStreakRewardDays: []
    });
    expect(migrated.pasture).toMatchObject({ cubInventory: [], toolInventory: [] });
    expect(migrated.pasture.animals[0]).toMatchObject({ productionActive: false, productionCount: 5 });
    expect(migrated.pasture.animals[1]).toMatchObject({ productionActive: false, productionCount: 0 });
  });

  it("migrates the previous one-card sign-in state without granting another first card", () => {
    const legacy = createManorV7State(8_500) as ManorV7State & {
      rewardClaims: ManorV7State["rewardClaims"] & {
        signInRewardDay?: string | null;
        signInRewardIds?: number[];
        signInStreakRewardDays?: number[];
      };
    };
    legacy.rewardClaims.signInDay = "2026-08-22";
    legacy.rewardClaims.signInRewardId = 2;
    legacy.rewardClaims.signInStreak = 4;
    delete legacy.rewardClaims.signInRewardDay;
    delete legacy.rewardClaims.signInRewardIds;
    delete legacy.rewardClaims.signInStreakRewardDays;

    const migrated = migrateManorV7State(legacy, 8_500);
    expect(migrated.rewardClaims).toMatchObject({
      signInDay: "2026-08-22",
      signInRewardDay: "2026-08-22",
      signInRewardId: 2,
      signInRewardIds: [2],
      signInStreak: 4,
      signInStreakRewardDays: []
    });
  });

  it("produces identical random care events from identical snapshots", () => {
    const initial = createManorV7State(10_000);
    const first = advanceManorV7State(initial, 10_000 + 86_400_000, { timeScale: 10 });
    const second = advanceManorV7State(initial, 10_000 + 86_400_000, { timeScale: 10 });
    expect(first).toEqual(second);
  });

  it("applies V7 friend crop care and stealing rules to both saves", () => {
    const now = 20_000;
    const visitor = createManorV7State(now);
    const owner = createManorV7State(now);
    const crop = manorV7Crop(owner.farm.lands[0]!.cropId!);
    owner.farm.lands[0]!.growthSeconds = crop.growthSeconds;

    const stolen = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "steal-crop", landId: 1 },
      now
    );
    const quantity = inventoryQuantity(stolen.visitor.farm.produceInventory, crop.id);
    expect(quantity).toBeGreaterThanOrEqual(1);
    expect(quantity).toBeLessThanOrEqual(5);
    expect(crop.baseYield - stolen.owner.farm.lands[0]!.stolen)
      .toBeGreaterThanOrEqual(Math.floor(crop.baseYield * 0.6));
    expect(() => transitionManorV7FriendStates(
      stolen.visitor,
      stolen.owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "steal-crop", landId: 1 },
      now
    )).toThrow("已经偷过");

    const cared = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "remove-weeds", landId: 2 },
      now
    );
    expect(cared.owner.farm.lands[1]!.weeds).toBe(false);
    expect(cared.visitor.farmExperience).toBe(2);
  });

  it("steals one animal byproduct per visitor and production round", () => {
    const now = 30_000;
    const visitor = createManorV7State(now);
    const owner = createManorV7State(now);
    const animalState = owner.pasture.animals[1]!;
    const animal = manorV7Animal(animalState.animalId);
    animalState.pendingProduct = animal.baseYield;

    const stolen = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "steal-product", serial: animalState.serial },
      now
    );
    expect(inventoryQuantity(stolen.visitor.pasture.productInventory, animal.id)).toBe(1);
    expect(stolen.owner.pasture.animals[1]).toMatchObject({ stolenProduct: 1 });
    expect(() => transitionManorV7FriendStates(
      stolen.visitor,
      stolen.owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "steal-product", serial: animalState.serial },
      now
    )).toThrow("已经偷过");
  });

  it("lets a friend start production for a mature animal", () => {
    const now = 35_000;
    const visitor = createManorV7State(now);
    const owner = createManorV7State(now);
    const animalState = owner.pasture.animals[1]!;
    const animal = manorV7Animal(animalState.animalId);
    Object.assign(animalState, {
      growthSeconds: animal.maturitySeconds,
      productionActive: false,
      productionProgressSeconds: 0,
      productionCount: 0,
      pendingProduct: 0
    });

    const started = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "start-production", serial: animalState.serial },
      now
    );
    expect(started.owner.pasture.animals[1]).toMatchObject({ productionActive: true, productionProgressSeconds: 0 });
    expect(started.visitor.pastureExperience).toBe(visitor.pastureExperience + 2);
  });

  it("closes the wild-animal adoption, release, return and crystal loop", () => {
    const now = 40_000;
    const keeper = createManorV7State(now);
    const friend = createManorV7State(now);
    keeper.coins = 20_000;
    const adopted = transitionManorV7State(
      keeper,
      { type: "adopt-wild-animal", slotId: 0, animalType: 1 },
      now
    );
    expect(adopted.coins).toBe(10_000);
    expect(adopted.pasture.wild.slots).toEqual([
      expect.objectContaining({ slotId: 0, animalType: 1, status: 1, remainingReleases: 12 })
    ]);

    const released = transitionManorV7FriendStates(
      adopted,
      friend,
      "keeper",
      "放养者",
      "friend",
      "好友",
      { type: "release-wild-animal", slotId: 0, animalType: 1, area: "pasture" },
      now
    );
    expect(released.visitor.pasture.wild).toMatchObject({
      moralExperience: 3,
      slots: [expect.objectContaining({ status: 2, remainingReleases: 11, targetUserId: "friend" })]
    });
    expect(released.owner.pasture.wild.incomingAnimals).toEqual([
      expect.objectContaining({ ownerUserId: "keeper", animalType: 1, status: 2, area: "pasture" })
    ]);

    const attacked = transitionManorV7FriendStates(
      createManorV7State(now),
      released.owner,
      "friend",
      "好友",
      "friend-farm",
      "好友牧场",
      { type: "attack-wild-animal", serial: 1, attackType: "Gun", weaponId: 7 },
      now
    );
    expect(attacked.visitor.pasture.wild.moralExperience).toBe(1);
    expect(attacked.owner.pasture.wild.incomingAnimals[0]).toMatchObject({ blood: 15, status: 2 });
    expect(attacked.owner.pasture.wild.crystalDrops).toHaveLength(1);
    const picked = transitionManorV7FriendStates(
      attacked.visitor,
      attacked.owner,
      "friend",
      "好友",
      "friend-farm",
      "好友牧场",
      { type: "pickup-wild-crystal", serial: attacked.owner.pasture.wild.crystalDrops[0]!.serial },
      now
    );
    expect(picked.owner.pasture.wild.crystalDrops).toEqual([]);
    expect(picked.visitor.pasture.wild.crystalInventory).toEqual([{ sourceId: 1, quantity: 1 }]);

    const returnedAt = now + 3_600_000;
    const returned = advanceManorV7State(released.visitor, returnedAt);
    expect(returned.pasture.wild.slots[0]).toMatchObject({ status: 3, targetUserId: null });
    const claimed = transitionManorV7State(returned, { type: "claim-wild-return", slotId: 0 }, returnedAt);
    expect(claimed.pasture.wild.slots[0]).toMatchObject({ status: 4, remainingReleases: 11 });
    expect(claimed.pasture.wild.crystalInventory).toEqual([{ sourceId: 1, quantity: 1 }]);
    const rested = advanceManorV7State(claimed, returnedAt + 300_000);
    expect(rested.pasture.wild.slots[0]).toMatchObject({ status: 1, restUntil: null });
  });
});

function expectSignInRewardApplied(before: ManorV7State, after: ManorV7State, rewardId: number): void {
  const reward = manorV7DailySignInReward(rewardId);
  if (reward.kind === "coins") {
    expect(after.coins - before.coins).toBe(reward.quantity);
    return;
  }
  const inventory = reward.kind === "animal"
    ? after.pasture.cubInventory
    : reward.kind === "crystal"
      ? after.pasture.wild.crystalInventory
      : reward.kind === "pasture-tool"
        ? after.pasture.toolInventory
        : after.farm.produceInventory;
  const previousInventory = reward.kind === "animal"
    ? before.pasture.cubInventory
    : reward.kind === "crystal"
      ? before.pasture.wild.crystalInventory
      : reward.kind === "pasture-tool"
        ? before.pasture.toolInventory
        : before.farm.produceInventory;
  expect(inventoryQuantity(inventory, reward.sourceId) - inventoryQuantity(previousInventory, reward.sourceId))
    .toBe(reward.quantity);
}
