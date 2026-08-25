import { describe, expect, it } from "vitest";
import {
  MANOR_V7_ANIMALS,
  MANOR_V7_AVATARS,
  MANOR_V7_BAD_ACTION_DAILY_LIMIT,
  MANOR_V7_CANDY_OFFERING_DAILY_LIMIT,
  MANOR_V7_CROPS,
  MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT,
  MANOR_V7_DECORATIONS,
  MANOR_V7_DAILY_SIGN_IN_LIMIT,
  MANOR_V7_FISH,
  MANOR_V7_FLOWERS,
  MANOR_V7_HIDDEN_SEED_IDS,
  MANOR_V7_HOUSE_UPGRADES,
  MANOR_V7_LAND_EXPANSION_FUND_COINS,
  MANOR_V7_LAND_EXPANSION_FUND_LEVEL,
  MANOR_V7_LAND_COUNT,
  MANOR_V7_LOVESDAY_ANIMAL_ID,
  MANOR_V7_LOVESDAY_CROP_ID,
  MANOR_V7_LOVESDAY_SALE_MULTIPLIER,
  MANOR_V7_MANURE_COLLECTION_DAILY_LIMIT,
  MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT,
  MANOR_V7_RESEARCH_RULES,
  MANOR_V7_TOOLS,
  advanceManorV7State,
  createManorV7State,
  inventoryQuantity,
  manorV7DailySignInReward,
  manorV7Animal,
  manorV7Avatar,
  manorV7Crop,
  manorV7Decoration,
  manorV7DecorationCoinPrice,
  manorV7ExperienceForLevel,
  manorV7Fish,
  manorV7HouseCapacity,
  isManorV7RewardAvailable,
  manorV7LevelForExperience,
  manorV7LandUpgrade,
  manorV7MaxProductionCount,
  manorV7PastureGuard,
  manorV7ProductionCycleDuration,
  manorV7SpecialFeedCropId,
  manorV7ToolCoinPrice,
  migrateManorV7State,
  toManorV7View,
  transitionManorV7FriendStates,
  transitionManorV7State,
  type ManorV7State
} from "../src/index.js";

const MANOR_V7_EXCLUDED_CROP_IDS = [
  262, 567, 570, 572,
  2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008
] as const;
const MANOR_V7_RESTORED_HIDDEN_ANIMAL_IDS = [
  1028, 1029, 1043, 1044, 1045, 1535, 1536, 1541, 1543, 1544
] as const;

describe("QQ Farm V7 domain", () => {
  it("uses the complete audited V7 runtime catalog", () => {
    expect(MANOR_V7_CROPS).toHaveLength(577);
    expect(MANOR_V7_ANIMALS).toHaveLength(177);
    expect(MANOR_V7_AVATARS).toHaveLength(326);
    expect(MANOR_V7_AVATARS.filter((avatar) => avatar.sex === "M")).toHaveLength(167);
    expect(MANOR_V7_AVATARS.filter((avatar) => avatar.sex === "F")).toHaveLength(159);
    expect(MANOR_V7_AVATARS.every((avatar) => avatar.width === 140 && avatar.height === 226)).toBe(true);
    expect(MANOR_V7_TOOLS).toHaveLength(91);
    expect(MANOR_V7_DECORATIONS).toHaveLength(821);
    expect(MANOR_V7_FISH).toHaveLength(16);
    expect(MANOR_V7_CROPS.filter((crop) => crop.landRequirement === 2)).toHaveLength(12);
    expect(MANOR_V7_CROPS.filter((crop) => crop.isVip)).toHaveLength(84);
    expect(MANOR_V7_CROPS.filter((crop) => crop.isHidden)).toHaveLength(88);
    expect(MANOR_V7_ANIMALS.filter((animal) => animal.isHidden)).toHaveLength(24);
    expect(MANOR_V7_DECORATIONS.filter((decoration) => decoration.isHidden)).toHaveLength(190);
    expect(MANOR_V7_DECORATIONS.filter((decoration) => decoration.isRenderable)).toHaveLength(816);
    expect(MANOR_V7_DECORATIONS.filter((decoration) => (
      !decoration.isHidden && decoration.isRenderable
    ))).toHaveLength(629);
    expect(MANOR_V7_ANIMALS.filter((animal) => animal.isHidden).map((animal) => animal.id)).toEqual(
      expect.arrayContaining([
        1037, 1085, 1086, 1537, 1546, 1593,
        ...MANOR_V7_RESTORED_HIDDEN_ANIMAL_IDS
      ])
    );
    expect(MANOR_V7_FISH.filter((fish) => fish.isHidden)).toEqual([
      expect.objectContaining({ id: 15, name: "团圆鱼" })
    ]);
    expect(manorV7Fish(11)).toMatchObject({ name: "彩虹鱼", isHidden: false });
    expect(manorV7Fish(14)).toMatchObject({ name: "海豚", poolSize: 3, isHidden: false });
    expect(manorV7Fish(17)).toMatchObject({ name: "金鱼", isHidden: false });
    expect(() => manorV7Fish(1)).toThrow("鱼种不存在或未接入 V7 素材");
    expect(manorV7Crop(1)).toMatchObject({ name: "草莓", seedPrice: 605, harvestCycles: 2 });
    expect(manorV7Crop(9)).toMatchObject({ name: "辣椒", seedPrice: 296, harvestCycles: 1 });
    expect(manorV7Crop(450)).toMatchObject({ name: "火舞草", originalLevel: 5, seedPrice: 210 });
    for (const cropId of MANOR_V7_EXCLUDED_CROP_IDS) {
      expect(() => manorV7Crop(cropId)).toThrow("作物不存在或未接入 V7 素材");
    }
    for (const animalId of MANOR_V7_RESTORED_HIDDEN_ANIMAL_IDS) {
      expect(manorV7Animal(animalId).isHidden).toBe(true);
    }
    expect(manorV7Animal(1028)).toMatchObject({ name: "喜鹊", byproductName: "喜鹊崽" });
    expect(manorV7Animal(1544)).toMatchObject({ name: "白鹭", byproductName: "白鹭崽" });
    expect(() => manorV7Animal(1565)).toThrow("动物不存在或未接入 V7 素材");
    expect(manorV7Avatar(515000)).toMatchObject({ sex: "M", assetPath: "ui/qqshow/0/0/515000_0_0.png" });
    expect(manorV7Avatar(546375)).toMatchObject({ sex: "F", assetPath: "ui/qqshow/3/75/546375_0_0.png" });
    expect(() => manorV7Avatar(1)).toThrow("农场形象不存在或未接入 V7 素材");
    expect(manorV7Animal(1002)).toMatchObject({
      name: "兔子",
      house: "hutch",
      purchasePrice: 1200,
      productionCooldownSeconds: 28_785,
      lifecycleSeconds: 165_600
    });
    expect(manorV7Animal(1502)).toMatchObject({ name: "牛", house: "shed" });
    expect(manorV7Fish(2)).toMatchObject({ name: "小丑鱼", seedPrice: 650, salePrice: 90 });
    expect(manorV7Decoration("farm", 1)).toMatchObject({
      name: "田园风光",
      itemType: 1,
      isHidden: true,
      isRenderable: true
    });
    expect(manorV7Decoration("pasture", 157)).toMatchObject({
      name: "欢度春节",
      isHidden: true,
      isRenderable: true
    });
    for (const id of [21, 26, 31, 627, 669]) {
      expect(manorV7Decoration("farm", id).isRenderable).toBe(false);
    }
  });

  it("initializes and resets the persisted seasonal activity state", () => {
    const now = Date.UTC(2026, 7, 22, 2, 0, 0);
    const initial = createManorV7State(now);
    expect(initial.seasonal).toEqual({
      animalDrops: [],
      nextAnimalDropSerial: 1,
      candySeedsClaimed: false,
      halloweenCandies: 0,
      candyOfferingDay: "2026-08-22",
      candyOfferingsRemaining: MANOR_V7_CANDY_OFFERING_DAILY_LIMIT,
      candyOfferedByUserIds: [],
      cookieSpritesClaimed: false,
      halloweenCookies: 0,
      cookieOfferingDay: "2026-08-22",
      cookieOfferingsRemaining: MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT,
      cookieOfferedByUserIds: [],
      halloweenCarnivalGiftClaimed: false,
      springFestivalClaimDay: null,
      reunionFishGiftClaimed: false
    });

    initial.seasonal.candyOfferingsRemaining = 0;
    initial.seasonal.candyOfferedByUserIds = ["farm-friend"];
    initial.seasonal.cookieOfferingsRemaining = 0;
    initial.seasonal.cookieOfferedByUserIds = ["friend"];
    const nextDay = advanceManorV7State(initial, now + 24 * 60 * 60 * 1_000);
    expect(nextDay.seasonal).toMatchObject({
      candyOfferingDay: "2026-08-23",
      candyOfferingsRemaining: MANOR_V7_CANDY_OFFERING_DAILY_LIMIT,
      candyOfferedByUserIds: [],
      cookieOfferingDay: "2026-08-23",
      cookieOfferingsRemaining: MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT,
      cookieOfferedByUserIds: []
    });
  });

  it("runs the original single-player seasonal reward rules", () => {
    const now = Date.UTC(2026, 7, 22, 2, 0, 0);
    let state = createManorV7State(now);
    for (let index = 0; index < 4; index += 1) {
      state = transitionManorV7State(state, { type: "generate-seasonal-animal-drop" }, now);
    }
    expect(state.seasonal.animalDrops).toHaveLength(3);
    expect(state.seasonal.animalDrops.every((drop) => [1085, 1086, 1593].includes(drop.animalId))).toBe(true);
    expect(state.seasonal.nextAnimalDropSerial).toBe(4);

    state = transitionManorV7State(state, { type: "claim-halloween-candy-seeds" }, now);
    expect(inventoryQuantity(state.farm.seedInventory, 167)).toBe(3);
    expect(() => transitionManorV7State(state, { type: "claim-halloween-candy-seeds" }, now))
      .toThrow("糖果种子已经领取");

    state = transitionManorV7State(state, { type: "claim-cookie-sprites" }, now);
    expect(inventoryQuantity(state.pasture.cubInventory, 1037)).toBe(3);
    expect(() => transitionManorV7State(state, { type: "claim-cookie-sprites" }, now))
      .toThrow("饼干精灵已经领取");

    const insufficientCarnival = createManorV7State(now);
    insufficientCarnival.seasonal.halloweenCandies = 55;
    insufficientCarnival.seasonal.halloweenCookies = 54;
    expect(() => transitionManorV7State(
      insufficientCarnival,
      { type: "exchange-halloween-carnival-gift" },
      now
    )).toThrow("兑换万圣狂欢礼包需要 55 个糖果和 55 个饼干");
    expect(insufficientCarnival.seasonal).toMatchObject({ halloweenCandies: 55, halloweenCookies: 54 });

    state.seasonal.halloweenCandies = 60;
    state.seasonal.halloweenCookies = 60;
    const coinsBeforeHalloween = state.coins;
    state = transitionManorV7State(state, { type: "exchange-halloween-candy-pumpkin" }, now);
    expect(state.seasonal.halloweenCandies).toBe(55);
    expect(inventoryQuantity(state.farm.seedInventory, 164)).toBe(1);

    state = transitionManorV7State(state, { type: "exchange-halloween-cookie-baby" }, now);
    expect(state.seasonal.halloweenCookies).toBe(55);
    expect(inventoryQuantity(state.pasture.cubInventory, 1537)).toBe(1);

    state = transitionManorV7State(state, { type: "exchange-halloween-carnival-gift" }, now);
    expect(state.seasonal).toMatchObject({
      halloweenCandies: 0,
      halloweenCookies: 0,
      halloweenCarnivalGiftClaimed: true
    });
    expect(state.coins).toBe(coinsBeforeHalloween + 20_000);
    expect(inventoryQuantity(state.pasture.cubInventory, 1038)).toBe(1);
    expect(inventoryQuantity(state.farm.seedInventory, 166)).toBe(1);
    expect(state.decorationOwnerships).toEqual(expect.arrayContaining([
      ...[665, 666, 667, 668].map((decorationId) => ({
        area: "farm",
        decorationId,
        validUntil: now + manorV7Decoration("farm", decorationId).validSeconds * 1_000
      })),
      {
        area: "pasture",
        decorationId: 135,
        validUntil: now + manorV7Decoration("pasture", 135).validSeconds * 1_000
      }
    ]));
    expect(() => transitionManorV7State(state, { type: "exchange-halloween-carnival-gift" }, now))
      .toThrow("万圣狂欢礼包已经兑换");

    state = transitionManorV7State(state, { type: "claim-spring-festival-gift" }, now);
    expect(state.seasonal.springFestivalClaimDay).toBe("2026-08-22");
    expect(inventoryQuantity(state.farm.seedInventory, 367)).toBe(4);
    expect(inventoryQuantity(state.pasture.cubInventory, 1546)).toBe(4);
    expect(() => transitionManorV7State(state, { type: "claim-spring-festival-gift" }, now))
      .toThrow("今日春节礼包已经领取");
  });

  it("exchanges the one-time reunion fish package through the complete crop loop", () => {
    const now = 8_000;
    const initial = createManorV7State(now);
    initial.farm.produceInventory = [{ sourceId: 450, quantity: 2_000 }];
    const exchanged = transitionManorV7State(initial, { type: "claim-reunion-fish-gift" }, now);

    expect(exchanged.coins).toBe(99_999);
    expect(exchanged.seasonal.reunionFishGiftClaimed).toBe(true);
    expect(inventoryQuantity(exchanged.farm.produceInventory, 450)).toBe(1);
    expect(inventoryQuantity(exchanged.farm.seedInventory, 448)).toBe(5);
    expect(inventoryQuantity(exchanged.farm.fishPool.seedInventory, 15)).toBe(2);
    expect(exchanged.farm.fishPool.unlockedFishIds).toContain(15);
    expect(exchanged.decorationOwnerships.filter((ownership) => (
      ownership.area === "farm" && ownership.decorationId >= 377 && ownership.decorationId <= 384
    ))).toHaveLength(8);
    expect(() => transitionManorV7State(exchanged, { type: "claim-reunion-fish-gift" }, now))
      .toThrow("团圆鱼礼包已经领取");
  });

  it("adopts all three seasonal animals with the original atomic costs", () => {
    const now = 7_000;
    let visitor = createManorV7State(now);
    let owner = createManorV7State(now);
    visitor.coins = 3_000;
    visitor.pasture.wild.moralExperience = 200;
    visitor.pasture.wild.crystalInventory = [{ sourceId: 1, quantity: 15 }];
    owner.seasonal.animalDrops = [
      { serial: 1, animalId: 1085, createdAt: now },
      { serial: 2, animalId: 1086, createdAt: now },
      { serial: 3, animalId: 1593, createdAt: now }
    ];
    owner.seasonal.nextAnimalDropSerial = 4;

    for (const animalId of [1085, 1086, 1593]) {
      const result = transitionManorV7FriendStates(
        visitor,
        owner,
        "visitor",
        "访客",
        "owner",
        "主人",
        { type: "adopt-seasonal-animal", animalId },
        now
      );
      visitor = result.visitor;
      owner = result.owner;
    }

    expect(visitor.coins).toBe(1_000);
    expect(inventoryQuantity(visitor.pasture.wild.crystalInventory, 1)).toBe(0);
    expect(visitor.pasture.wild.moralExperience).toBe(200);
    expect(visitor.pasture.cubInventory).toEqual(expect.arrayContaining([
      { sourceId: 1085, quantity: 1 },
      { sourceId: 1086, quantity: 1 },
      { sourceId: 1593, quantity: 1 }
    ]));
    expect(owner.seasonal.animalDrops).toEqual([]);
  });

  it("offers one cookie per friend and returns one or two cookie sprites", () => {
    const now = 7_500;
    const visitor = createManorV7State(now);
    const owner = createManorV7State(now);
    visitor.pasture.cubInventory = [{ sourceId: 1037, quantity: 4 }];
    visitor.pasture.productInventory = [{ sourceId: 1037, quantity: 2 }];

    const result = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "offer-halloween-cookie" },
      now
    );
    expect(inventoryQuantity(result.visitor.pasture.productInventory, 1037)).toBe(1);
    expect(inventoryQuantity(result.visitor.pasture.cubInventory, 1037)).toBeGreaterThanOrEqual(5);
    expect(inventoryQuantity(result.visitor.pasture.cubInventory, 1037)).toBeLessThanOrEqual(6);
    expect(result.visitor.seasonal.cookieOfferingsRemaining).toBe(MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT - 1);
    expect(result.owner.seasonal).toMatchObject({
      halloweenCookies: 1,
      cookieOfferedByUserIds: ["visitor"]
    });
    expect(() => transitionManorV7FriendStates(
      result.visitor,
      result.owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "offer-halloween-cookie" },
      now
    )).toThrow("今天已经给这位好友投放过饼干");

    const noCookieVisitor = createManorV7State(now);
    noCookieVisitor.pasture.cubInventory = [{ sourceId: 1037, quantity: 3 }];
    expect(() => transitionManorV7FriendStates(
      noCookieVisitor,
      createManorV7State(now),
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "offer-halloween-cookie" },
      now
    )).toThrow("没有饼干可以投放");
  });

  it("offers one candy per friend and returns one or two candy seeds", () => {
    const now = 7_600;
    let visitor = createManorV7State(now);
    visitor.farm.produceInventory = [{ sourceId: 167, quantity: 11 }];

    for (let index = 0; index < MANOR_V7_CANDY_OFFERING_DAILY_LIMIT; index += 1) {
      const result = transitionManorV7FriendStates(
        visitor,
        createManorV7State(now),
        "visitor",
        "访客",
        `owner-${index}`,
        `主人${index}`,
        { type: "offer-halloween-candy" },
        now
      );
      visitor = result.visitor;
      expect(result.owner.seasonal).toMatchObject({
        halloweenCandies: 1,
        candyOfferedByUserIds: ["visitor"]
      });
    }

    expect(inventoryQuantity(visitor.farm.produceInventory, 167)).toBe(1);
    expect(inventoryQuantity(visitor.farm.seedInventory, 167)).toBeGreaterThanOrEqual(10);
    expect(inventoryQuantity(visitor.farm.seedInventory, 167)).toBeLessThanOrEqual(20);
    expect(visitor.seasonal.candyOfferingsRemaining).toBe(0);
    expect(() => transitionManorV7FriendStates(
      visitor,
      createManorV7State(now),
      "visitor",
      "访客",
      "owner-limit",
      "主人",
      { type: "offer-halloween-candy" },
      now
    )).toThrow("今天已经投放糖果 10 次");

    const oneCandyVisitor = createManorV7State(now);
    oneCandyVisitor.farm.produceInventory = [{ sourceId: 167, quantity: 1 }];
    const first = transitionManorV7FriendStates(
      oneCandyVisitor,
      createManorV7State(now),
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "offer-halloween-candy" },
      now
    );
    expect(() => transitionManorV7FriendStates(
      { ...first.visitor, farm: { ...first.visitor.farm, produceInventory: [{ sourceId: 167, quantity: 1 }] } },
      first.owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "offer-halloween-candy" },
      now
    )).toThrow("今天已经给这位好友投放过糖果");

    expect(() => transitionManorV7FriendStates(
      createManorV7State(now),
      createManorV7State(now),
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "offer-halloween-candy" },
      now
    )).toThrow("没有糖果可以投放");
  });

  it("keeps activity rewards out of ordinary purchases", () => {
    const initial = createManorV7State(5_500);
    initial.coins = 1_000_000;

    expect(initial.farm.fishPool.unlockedFishIds).not.toContain(15);
    expect(() => transitionManorV7State(
      initial,
      { type: "buy-seed", cropId: MANOR_V7_HIDDEN_SEED_IDS[0]!, quantity: 1 },
      5_500
    )).toThrow("该种子只能通过活动获得");
    expect(() => transitionManorV7State(
      initial,
      { type: "buy-animal", animalId: 1085, quantity: 1 },
      5_500
    )).toThrow("该动物只能通过活动获得");
    expect(() => transitionManorV7State(
      initial,
      { type: "buy-fish-seed", fishId: 15, quantity: 1 },
      5_500
    )).toThrow("该鱼苗只能通过活动获得");
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

  it("keeps all 13 original house levels and charges their original coin prices", () => {
    expect(MANOR_V7_HOUSE_UPGRADES.hutch).toHaveLength(13);
    expect(MANOR_V7_HOUSE_UPGRADES.shed).toHaveLength(13);
    expect(MANOR_V7_HOUSE_UPGRADES.hutch[12]).toEqual({
      level: 13,
      requiredLevel: 54,
      coins: 1_200_000,
      premiumPrice: 90
    });
    expect(MANOR_V7_HOUSE_UPGRADES.shed[12]).toEqual({
      level: 13,
      requiredLevel: 57,
      coins: 1_250_000,
      premiumPrice: 95
    });

    const initial = createManorV7State(4_500);
    initial.coins = 1_700_000;
    initial.pastureExperience = manorV7ExperienceForLevel(60);
    initial.pasture.hutchLevel = 8;
    initial.pasture.shedLevel = 8;
    const upgraded = transitionManorV7State(
      initial,
      { type: "upgrade-house", house: "hutch", useVip: true },
      4_500
    );
    expect(upgraded.coins).toBe(901_000);
    expect(upgraded.pasture.hutchLevel).toBe(9);

    const paid = transitionManorV7State(upgraded, { type: "upgrade-house", house: "shed" }, 4_500);
    expect(paid.coins).toBe(51_000);
    expect(paid.pasture.shedLevel).toBe(9);

    const underleveled = createManorV7State(4_500);
    underleveled.pasture.hutchLevel = 8;
    expect(() => transitionManorV7State(
      underleveled,
      { type: "upgrade-house", house: "hutch", useVip: true },
      4_500
    )).toThrow("升级需要牧场达到 30 级");
  });

  it("runs the original tutorial sequence separately from cumulative tasks", () => {
    const now = 5_000;
    const initial = createManorV7State(now);
    expect(initial.tutorialTask).toEqual({ taskId: 0, accepted: true });
    const completedHelp = transitionManorV7State(initial, { type: "complete-tutorial-task" }, now);
    expect(completedHelp).toMatchObject({
      coins: 50,
      pastureExperience: 50,
      tutorialTask: { taskId: 1, accepted: true }
    });
    expect(completedHelp.tasks).toEqual(initial.tasks);
  });

  it("grants all unclaimed original level rewards once and migrates old saves as claimed", () => {
    const now = 6_000;
    const initial = createManorV7State(now);
    initial.farmExperience = manorV7ExperienceForLevel(3);
    const rewarded = transitionManorV7State(
      initial,
      { type: "claim-level-rewards", area: "farm", throughLevel: 3 },
      now
    );
    expect(rewarded.levelRewardClaims.farm).toBe(3);
    expect(inventoryQuantity(rewarded.farm.seedInventory, 4)).toBe(2);
    expect(inventoryQuantity(rewarded.farm.toolInventory, 1)).toBe(2);
    expect(inventoryQuantity(rewarded.farm.seedInventory, 6)).toBe(2);
    expect(() => transitionManorV7State(
      rewarded,
      { type: "claim-level-rewards", area: "farm", throughLevel: 3 },
      now
    )).toThrow("升级奖励已经领取");

    const legacy = structuredClone(initial) as unknown as Record<string, unknown>;
    delete legacy.tutorialTask;
    delete legacy.levelRewardClaims;
    const migrated = migrateManorV7State(legacy, now);
    expect(migrated.tutorialTask.taskId).toBe(10);
    expect(migrated.levelRewardClaims.farm).toBe(3);
  });

  it("persists the one-time research guide, return gift and real activity clearing", () => {
    const now = 7_000;
    const initial = createManorV7State(now);
    const guided = transitionManorV7State(initial, { type: "show-research-guide" }, now);
    expect(guided.researchGuideSeen).toBe(true);
    expect(() => transitionManorV7State(guided, { type: "show-research-guide" }, now))
      .toThrow("科研引导已经展示");

    const gifted = transitionManorV7State(guided, { type: "claim-vip-return-gift" }, now);
    expect(gifted.rewardClaims.vipReturnGiftClaimed).toBe(true);
    expect(gifted.coins - guided.coins).toBe(1_000);
    expect(inventoryQuantity(gifted.farm.seedInventory, 1)).toBe(2);
    expect(() => transitionManorV7State(gifted, { type: "claim-vip-return-gift" }, now))
      .toThrow("VIP 回归礼包已经领取");

    const cleared = transitionManorV7State(gifted, { type: "clear-activities" }, now);
    expect(cleared.activities).toEqual([]);
  });

  it("normalizes local redeem codes and grants each code only once per account", () => {
    const now = 9_000;
    const state = createManorV7State(now);
    const initialSeeds = inventoryQuantity(state.farm.seedInventory, 1);
    const initialFertilizers = inventoryQuantity(state.farm.toolInventory, 1);
    const redeemed = transitionManorV7State(state, { type: "redeem-code", code: " manor2026 " }, now);
    expect(redeemed.redeemedCodes).toEqual(["MANOR2026"]);
    expect(redeemed.coins).toBe(state.coins + 5_000);
    expect(inventoryQuantity(redeemed.farm.seedInventory, 1)).toBe(initialSeeds + 5);
    expect(inventoryQuantity(redeemed.farm.toolInventory, 1)).toBe(initialFertilizers + 3);
    expect(() => transitionManorV7State(redeemed, { type: "redeem-code", code: "MANOR2026" }, now))
      .toThrow("该兑换码已经使用");
    expect(() => transitionManorV7State(state, { type: "redeem-code", code: "UNKNOWN" }, now))
      .toThrow("兑换码无效");
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

  it("grants the land expansion fund once when farm level first reaches the land-upgrade threshold", () => {
    const now = 1_500;
    const initial = createManorV7State(now);
    initial.coins = 100;
    initial.farmExperience = manorV7ExperienceForLevel(MANOR_V7_LAND_EXPANSION_FUND_LEVEL) - 1;
    initial.farm.lands[0]!.weeds = true;

    const granted = transitionManorV7State(initial, { type: "remove-weeds", landId: 1 }, now);
    expect(granted.rewardClaims.landExpansionFundClaimed).toBe(true);
    expect(granted.coins).toBe(100 + MANOR_V7_LAND_EXPANSION_FUND_COINS);
    expect(granted.activities[0]?.message).toContain("土地扩建基金");

    const advanced = advanceManorV7State(granted, now + 1_000);
    expect(advanced.coins).toBe(granted.coins);
    expect(advanced.activities.filter((activity) => activity.message.includes("土地扩建基金"))).toHaveLength(1);
  });

  it("expires, unequips and renews decorations without mixing farm and pasture IDs", () => {
    const now = 100_000;
    const state = createManorV7State(now);
    state.coins = 1_000_000;
    state.farmExperience = manorV7ExperienceForLevel(60);
    state.pastureExperience = manorV7ExperienceForLevel(60);
    const farmDecoration = manorV7Decoration("farm", 217);

    const bought = transitionManorV7State(
      state,
      { type: "buy-decoration", area: "farm", decorationId: 217 },
      now
    );
    const equipped = transitionManorV7State(
      bought,
      { type: "equip-decoration", area: "farm", decorationId: 217 },
      now
    );
    expect(equipped.decorationOwnerships).toContainEqual({
      area: "farm",
      decorationId: 217,
      validUntil: now + farmDecoration.validSeconds * 1_000
    });
    expect(equipped.decorationOwnerships).not.toContainEqual(expect.objectContaining({ area: "pasture", decorationId: 217 }));

    const renewAt = now + farmDecoration.validSeconds * 1_000 + 1;
    const expired = advanceManorV7State(equipped, renewAt);
    expect(expired.ownedDecorationIds).not.toContain(217);
    expect(expired.farm.selectedDecorationIds).not.toContain(217);
    const renewed = transitionManorV7State(
      expired,
      { type: "renew-decoration", area: "farm", decorationId: 217 },
      renewAt
    );
    expect(renewed.decorationOwnerships).toContainEqual({
      area: "farm",
      decorationId: 217,
      validUntil: renewAt + farmDecoration.validSeconds * 1_000
    });
    expect(renewed.coins).toBe(expired.coins - farmDecoration.coinPrice);

    const withPasture = transitionManorV7State(
      renewed,
      { type: "buy-decoration", area: "pasture", decorationId: 217, useVip: true },
      renewAt
    );
    expect(withPasture.decorationOwnerships.filter((ownership) => ownership.decorationId === 217))
      .toHaveLength(2);
  });

  it("keeps hidden decorations reward-only and preserves blocked legacy ownerships without rendering them", () => {
    const now = 100_000;
    const state = createManorV7State(now);
    state.coins = 1_000_000;
    state.farmExperience = manorV7ExperienceForLevel(60);

    expect(() => transitionManorV7State(
      state,
      { type: "buy-decoration", area: "farm", decorationId: 11 },
      now
    )).toThrow("该装扮只能通过活动或奖励获得");

    const withHiddenOwnership = structuredClone(state);
    withHiddenOwnership.decorationOwnerships.push({ area: "farm", decorationId: 11, validUntil: 0 });
    const equippedHidden = transitionManorV7State(
      withHiddenOwnership,
      { type: "equip-decoration", area: "farm", decorationId: 11 },
      now
    );
    expect(equippedHidden.farm.selectedDecorationIds).toContain(11);

    const withBlockedOwnership = structuredClone(equippedHidden);
    withBlockedOwnership.decorationOwnerships.push({ area: "farm", decorationId: 627, validUntil: 0 });
    withBlockedOwnership.farm.selectedDecorationIds.push(627);
    const synchronized = advanceManorV7State(withBlockedOwnership, now + 1);
    expect(synchronized.decorationOwnerships).toContainEqual({
      area: "farm",
      decorationId: 627,
      validUntil: 0
    });
    expect(synchronized.farm.selectedDecorationIds).not.toContain(627);
    expect(isManorV7RewardAvailable({
      kind: "decoration",
      area: "farm",
      sourceId: 627,
      quantity: 1
    })).toBe(false);
    expect(() => transitionManorV7State(
      synchronized,
      { type: "buy-decoration", area: "farm", decorationId: 627 },
      now + 1
    )).toThrow("该装扮素材不完整，暂不可使用");
    expect(() => transitionManorV7State(
      synchronized,
      { type: "renew-decoration", area: "farm", decorationId: 627 },
      now + 1
    )).toThrow("该装扮素材不完整，暂不可使用");
    expect(() => transitionManorV7State(
      synchronized,
      { type: "equip-decoration", area: "farm", decorationId: 627 },
      now + 1
    )).toThrow("该装扮素材不完整，暂不可使用");
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

    const withFemaleAvatar = transitionManorV7State(
      withAvatar,
      { type: "set-avatar", avatarId: 546375 },
      2_000
    );
    expect(withFemaleAvatar.farm.selectedAvatarId).toBe(546375);

    const clearedBoard = transitionManorV7State(withFemaleAvatar, { type: "set-board", boardId: null }, 2_000);
    const clearedAvatar = transitionManorV7State(clearedBoard, { type: "set-avatar", avatarId: null }, 2_000);
    expect(clearedAvatar.farm).toMatchObject({ selectedBoardId: null, selectedAvatarId: null });
    expect(() => transitionManorV7State(initial, { type: "set-board", boardId: 1 }, 2_000))
      .toThrow("告示牌不存在");
    expect(() => transitionManorV7State(initial, { type: "set-board", boardId: 90019 }, 2_000))
      .toThrow("告示牌不存在");
    expect(() => transitionManorV7State(initial, { type: "set-avatar", avatarId: 1 }, 2_000))
      .toThrow("农场形象不存在或未接入 V7 素材");
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

  it("closes the purchase, planting and harvest loop for a partial-stage source crop", () => {
    const now = 2_000;
    const crop = manorV7Crop(9);
    let state = createManorV7State(now);
    state.coins = crop.seedPrice;
    state.farmExperience = manorV7ExperienceForLevel(crop.originalLevel);

    state = transitionManorV7State(state, { type: "buy-seed", cropId: crop.id, quantity: 1 }, now);
    state = transitionManorV7State(state, { type: "plant", landId: 5, cropId: crop.id }, now);
    state.farm.lands[4]!.growthSeconds = crop.growthSeconds;
    state = transitionManorV7State(state, { type: "harvest", landId: 5 }, now);

    expect(inventoryQuantity(state.farm.produceInventory, crop.id)).toBe(crop.baseYield);
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

  it("uses the original Lovesday prices and 99-item sale multiplier", () => {
    const now = 2_050;
    const initial = createManorV7State(now);
    initial.coins = 1_000;
    initial.farmExperience = manorV7ExperienceForLevel(5);
    initial.farm.produceInventory = [{ sourceId: MANOR_V7_LOVESDAY_CROP_ID, quantity: 197 }];
    initial.pasture.productInventory = [{ sourceId: MANOR_V7_LOVESDAY_ANIMAL_ID, quantity: 197 }];
    Object.assign(initial.tasks.find((task) => task.key === "sell")!, {
      progress: 10,
      completed: true,
      claimed: true
    });

    expect(manorV7Crop(MANOR_V7_LOVESDAY_CROP_ID)).toMatchObject({ seedPrice: 99, salePrice: 99 });
    const bought = transitionManorV7State(
      initial,
      { type: "buy-seed", cropId: MANOR_V7_LOVESDAY_CROP_ID, quantity: 1 },
      now
    );
    expect(bought.coins).toBe(901);

    const crop = manorV7Crop(MANOR_V7_LOVESDAY_CROP_ID);
    const soldCropBatch = transitionManorV7State(
      bought,
      { type: "sell-produce", cropId: crop.id, quantity: 99 },
      now
    );
    expect(soldCropBatch.coins - bought.coins).toBe(crop.salePrice * 99 * MANOR_V7_LOVESDAY_SALE_MULTIPLIER);
    const soldCropRemainder = transitionManorV7State(
      soldCropBatch,
      { type: "sell-produce", cropId: crop.id, quantity: 98 },
      now
    );
    expect(soldCropRemainder.coins - soldCropBatch.coins).toBe(crop.salePrice * 98);

    const animal = manorV7Animal(MANOR_V7_LOVESDAY_ANIMAL_ID);
    const soldProductBatch = transitionManorV7State(
      soldCropRemainder,
      { type: "sell-animal-product", animalId: animal.id, quantity: 99 },
      now
    );
    expect(soldProductBatch.coins - soldCropRemainder.coins)
      .toBe(animal.byproductPrice * 99 * MANOR_V7_LOVESDAY_SALE_MULTIPLIER);
    const soldProductRemainder = transitionManorV7State(
      soldProductBatch,
      { type: "sell-animal-product", animalId: animal.id, quantity: 98 },
      now
    );
    expect(soldProductRemainder.coins - soldProductBatch.coins).toBe(animal.byproductPrice * 98);
    expect(soldProductRemainder.activities.some((activity) => activity.message.includes("情人节 9 倍收益"))).toBe(true);

    const bulk = createManorV7State(now);
    bulk.coins = 50;
    bulk.farm.produceInventory = [
      { sourceId: crop.id, quantity: 99 },
      { sourceId: 1, quantity: 2 }
    ];
    bulk.pasture.productInventory = [{ sourceId: animal.id, quantity: 99 }];
    bulk.pasture.harvestedAnimalInventory = [{ sourceId: animal.id, quantity: 1 }];
    Object.assign(bulk.tasks.find((task) => task.key === "sell")!, {
      progress: 10,
      completed: true,
      claimed: true
    });
    const soldAllCrops = transitionManorV7State(bulk, { type: "sell-all-produce" }, now);
    expect(soldAllCrops.coins).toBe(
      50 + crop.salePrice * 99 * MANOR_V7_LOVESDAY_SALE_MULTIPLIER + manorV7Crop(1).salePrice * 2
    );
    const soldAllProducts = transitionManorV7State(soldAllCrops, { type: "sell-all-pasture-products" }, now);
    expect(soldAllProducts.coins - soldAllCrops.coins).toBe(
      animal.byproductPrice * 99 * MANOR_V7_LOVESDAY_SALE_MULTIPLIER + animal.productPrice
    );
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

  it("sells one seed quantity or every selected seed at the original half-price rule", () => {
    const now = 2_200;
    const initial = createManorV7State(now);
    initial.coins = 10;
    initial.farm.seedInventory = [
      { sourceId: 1, quantity: 3 },
      { sourceId: 6, quantity: 2 }
    ];

    const single = transitionManorV7State(initial, { type: "sell-seed", cropId: 1, quantity: 1 }, now);
    expect(single.coins).toBe(10 + Math.ceil(manorV7Crop(1).seedPrice / 2));
    expect(inventoryQuantity(single.farm.seedInventory, 1)).toBe(2);

    const selected = transitionManorV7State(single, { type: "sell-selected-seeds", cropIds: [1, 6] }, now);
    expect(selected.coins).toBe(
      single.coins + Math.ceil(manorV7Crop(1).seedPrice / 2) * 2 + Math.ceil(manorV7Crop(6).seedPrice / 2) * 2
    );
    expect(selected.farm.seedInventory).toEqual([]);
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
    initial.coins = 40_000;
    const guard = manorV7PastureGuard(1);

    const bought = transitionManorV7State(initial, { type: "buy-pasture-guard", guardId: guard.id }, 6_200);
    expect(bought.coins).toBe(40_000 - guard.coinPrice);
    expect(bought.pasture.guards).toEqual([{
      id: guard.id,
      remainingSeconds: 7 * 24 * 60 * 60,
      active: true
    }]);

    const advanced = advanceManorV7State(bought, 6_200 + 3_600_000);
    expect(advanced.pasture.guards[0]?.remainingSeconds).toBe(6 * 24 * 60 * 60 + 23 * 60 * 60);

    const hidden = transitionManorV7State(
      advanced,
      { type: "set-pasture-guard-active", guardId: guard.id, active: false },
      advanced.updatedAt
    );
    expect(hidden.pasture.guards[0]?.active).toBe(false);
    const restored = transitionManorV7State(
      hidden,
      { type: "set-pasture-guard-active", guardId: guard.id, active: true },
      hidden.updatedAt
    );
    const paid = transitionManorV7State(
      restored,
      { type: "pay-pasture-guard", guardId: guard.id, days: 7 },
      restored.updatedAt
    );
    expect(paid.pasture.guards[0]!.remainingSeconds - restored.pasture.guards[0]!.remainingSeconds)
      .toBe(7 * 24 * 60 * 60);
    expect(paid.coins).toBe(10_000);

    const owner = structuredClone(paid);
    owner.randomState = 0;
    owner.pasture.animals[1]!.pendingProduct = manorV7Animal(owner.pasture.animals[1]!.animalId).baseYield;
    const visitor = createManorV7State(owner.updatedAt);
    visitor.coins = 500;
    const caught = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "steal-product", serial: owner.pasture.animals[1]!.serial },
      owner.updatedAt
    );
    expect(caught.message).toContain("看守员");
    expect(caught.visitor.coins).toBeLessThan(500);
    expect(caught.visitor.coins + caught.owner.coins).toBe(visitor.coins + owner.coins);
  });

  it("shares two VIP sign-in cards per Shanghai calendar day", () => {
    const now = Date.UTC(2026, 7, 22, 2, 0, 0);
    const initial = createManorV7State(now);
    const packaged = transitionManorV7State(initial, { type: "claim-daily-package" }, now);
    expect(packaged.coins).toBe(300);
    expect(packaged.rewardClaims.dailyPackageDay).toBe("2026-08-22");
    expect(packaged.farm.toolInventory).toEqual([
      { sourceId: 1, quantity: 1 },
      { sourceId: 2, quantity: 1 },
      { sourceId: 3, quantity: 1 },
      { sourceId: 7, quantity: 1 }
    ]);
    expect(packaged.pasture.toolInventory).toEqual([
      { sourceId: 1, quantity: 1 },
      { sourceId: 2, quantity: 1 },
      { sourceId: 3, quantity: 1 }
    ]);
    expect(inventoryQuantity(packaged.farm.produceInventory, 40)).toBe(100);
    expect(packaged.farm.dog.feedSeconds).toBe(24 * 60 * 60);
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

  it("requires and consumes the original crystal cost when unlocking fish", () => {
    const now = 6_600;
    const initial = createManorV7State(now);
    expect(() => transitionManorV7State(initial, { type: "unlock-fish", fishId: 4 }, now))
      .toThrow("金币不足");
    initial.coins = 100_000;

    expect(() => transitionManorV7State(initial, { type: "unlock-fish", fishId: 4 }, now))
      .toThrow("水晶库存不足");

    initial.pasture.wild.crystalInventory = [{ sourceId: 1, quantity: 10 }];
    const unlocked = transitionManorV7State(initial, { type: "unlock-fish", fishId: 4 }, now);
    expect(unlocked.coins).toBe(50_000);
    expect(unlocked.pasture.wild.crystalInventory).toEqual([]);
    expect(unlocked.farm.fishPool.unlockedFishIds).toContain(4);
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

  it("clears legacy farm avatar ids that are outside the audited catalog", () => {
    const legacy = createManorV7State(7_500);
    legacy.farm.selectedAvatarId = 1;

    const migrated = migrateManorV7State(legacy, 7_500);

    expect(migrated.farm.selectedAvatarId).toBeNull();
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
      seasonal?: ManorV7State["seasonal"];
      decorationOwnerships?: ManorV7State["decorationOwnerships"];
      redeemedCodes?: ManorV7State["redeemedCodes"];
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
    delete legacy.seasonal;
    delete legacy.decorationOwnerships;
    delete legacy.redeemedCodes;
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
    expect(migrated.decorationOwnerships).toEqual(expect.arrayContaining([
      { area: "farm", decorationId: 1, validUntil: 0 },
      { area: "pasture", decorationId: 105, validUntil: 0 }
    ]));
    expect(migrated.redeemedCodes).toEqual([]);
    expect(migrated.rewardClaims).toEqual({
      dailyPackageDay: null,
      signInDay: null,
      signInRewardDay: null,
      signInRewardId: null,
      signInRewardIds: [],
      signInStreak: 0,
      signInStreakRewardDays: [],
      vipReturnGiftClaimed: false,
      landExpansionFundClaimed: false
    });
    expect(migrated.seasonal).toEqual({
      animalDrops: [],
      nextAnimalDropSerial: 1,
      candySeedsClaimed: false,
      halloweenCandies: 0,
      candyOfferingDay: "1970-01-01",
      candyOfferingsRemaining: MANOR_V7_CANDY_OFFERING_DAILY_LIMIT,
      candyOfferedByUserIds: [],
      cookieSpritesClaimed: false,
      halloweenCookies: 0,
      cookieOfferingDay: "1970-01-01",
      cookieOfferingsRemaining: MANOR_V7_COOKIE_OFFERING_DAILY_LIMIT,
      cookieOfferedByUserIds: [],
      halloweenCarnivalGiftClaimed: false,
      springFestivalClaimDay: null,
      reunionFishGiftClaimed: false
    });
    expect(migrated.pasture).toMatchObject({ cubInventory: [], toolInventory: [] });
    expect(migrated.pasture.animals[0]).toMatchObject({ productionActive: false, productionCount: 5 });
    expect(migrated.pasture.animals[1]).toMatchObject({ productionActive: false, productionCount: 0 });
  });

  it("adds independent candy activity fields to existing seasonal saves", () => {
    const legacy = createManorV7State(8_100);
    legacy.seasonal.cookieSpritesClaimed = true;
    legacy.seasonal.halloweenCookies = 2;
    const seasonal = legacy.seasonal as Partial<ManorV7State["seasonal"]>;
    delete seasonal.candySeedsClaimed;
    delete seasonal.halloweenCandies;
    delete seasonal.candyOfferingDay;
    delete seasonal.candyOfferingsRemaining;
    delete seasonal.candyOfferedByUserIds;
    delete seasonal.halloweenCarnivalGiftClaimed;

    const migrated = migrateManorV7State(legacy, 8_100);
    expect(migrated.seasonal).toMatchObject({
      candySeedsClaimed: false,
      halloweenCandies: 0,
      candyOfferingDay: "1970-01-01",
      candyOfferingsRemaining: MANOR_V7_CANDY_OFFERING_DAILY_LIMIT,
      candyOfferedByUserIds: [],
      halloweenCarnivalGiftClaimed: false,
      cookieSpritesClaimed: true,
      halloweenCookies: 2
    });
  });

  it("migrates weather, yield, flowers, friend filters and workshop materials", () => {
    const legacy = createManorV7State(8_200) as ManorV7State & {
      farm: ManorV7State["farm"] & { weather?: ManorV7State["farm"]["weather"] };
      pasture: ManorV7State["pasture"] & { materialInventory?: ManorV7State["pasture"]["materialInventory"] };
      friendFilterUserIds?: string[];
      receivedFlowers?: ManorV7State["receivedFlowers"];
      nextFlowerGiftId?: number;
    };
    delete legacy.farm.weather;
    delete (legacy.farm.lands[0] as Partial<ManorV7State["farm"]["lands"][number]>).yieldPenaltyPercent;
    delete legacy.pasture.materialInventory;
    delete legacy.friendFilterUserIds;
    delete legacy.receivedFlowers;
    delete legacy.nextFlowerGiftId;

    const migrated = migrateManorV7State(legacy, 8_200);
    expect(migrated.farm.weather).toMatchObject({ kind: "rainy" });
    expect(migrated.farm.lands[0]?.yieldPenaltyPercent).toBe(0);
    expect(migrated.pasture.materialInventory).toEqual([]);
    expect(migrated.friendFilterUserIds).toEqual([]);
    expect(migrated.receivedFlowers).toEqual([]);
    expect(migrated.nextFlowerGiftId).toBe(1);
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
    delete legacy.rewardClaims.landExpansionFundClaimed;

    const migrated = migrateManorV7State(legacy, 8_500);
    expect(migrated.rewardClaims).toMatchObject({
      signInDay: "2026-08-22",
      signInRewardDay: "2026-08-22",
      signInRewardId: 2,
      signInRewardIds: [2],
      signInStreak: 4,
      signInStreakRewardDays: [],
      landExpansionFundClaimed: false
    });
  });

  it("produces identical random care events from identical snapshots", () => {
    const initial = createManorV7State(10_000);
    const first = advanceManorV7State(initial, 10_000 + 86_400_000, { timeScale: 10 });
    const second = advanceManorV7State(initial, 10_000 + 86_400_000, { timeScale: 10 });
    expect(first).toEqual(second);
  });

  it("can generate pasture pests even when no farm crop can receive a care event", () => {
    const now = 21_600_000;
    const initial = createManorV7State(now);
    for (const land of initial.farm.lands) {
      delete land.cropId;
      Object.assign(land, { growthSeconds: 0, weeds: false, pests: false });
    }
    initial.randomState = 1_972;

    const advanced = advanceManorV7State(initial, now + 21_600_000);

    expect(advanced.pasture.mosquitoes.sourceUserIds).toContain("system");
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

  it("limits friend weeds and pests to 50 per day and resets the allowance next day", () => {
    const now = Date.UTC(2026, 7, 22, 2, 0, 0);
    let visitor = createManorV7State(now);
    let owner = createManorV7State(now);
    const landId = 3;

    for (let index = 0; index < MANOR_V7_BAD_ACTION_DAILY_LIMIT; index += 1) {
      const added = transitionManorV7FriendStates(
        visitor,
        owner,
        "visitor",
        "访客",
        "owner",
        "主人",
        { type: index % 2 === 0 ? "add-weeds" : "add-pests", landId },
        now
      );
      const cleared = transitionManorV7FriendStates(
        added.visitor,
        added.owner,
        "visitor",
        "访客",
        "owner",
        "主人",
        { type: index % 2 === 0 ? "remove-weeds" : "remove-pests", landId },
        now
      );
      visitor = cleared.visitor;
      owner = cleared.owner;
    }

    expect(visitor.farm.badActions.remaining).toBe(0);
    expect(() => transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "add-weeds", landId },
      now
    )).toThrow("次数已经用完");

    const tomorrow = now + 24 * 60 * 60 * 1_000;
    const reset = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "add-weeds", landId },
      tomorrow
    );
    expect(reset.visitor.farm.badActions.remaining).toBe(MANOR_V7_BAD_ACTION_DAILY_LIMIT - 1);
  });

  it("lets a fed watchdog intercept stealing, transfer coins and expire over time", () => {
    const now = 50_000;
    const visitor = createManorV7State(now);
    const owner = createManorV7State(now);
    visitor.coins = 500;
    owner.randomState = 0;
    owner.farm.dog = { ownedIds: [2], activeId: 2, feedSeconds: 24 * 60 * 60 };
    const land = owner.farm.lands[0]!;
    land.growthSeconds = manorV7Crop(land.cropId!).growthSeconds;
    land.thiefUserIds = [];

    const caught = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "steal-crop", landId: land.id },
      now
    );
    expect(caught.message).toContain("损失");
    expect(caught.visitor.coins).toBeLessThan(500);
    expect(caught.visitor.coins + caught.owner.coins).toBe(500);
    expect(caught.visitor.farm.produceInventory).toEqual([]);

    const expiredAt = now + 24 * 60 * 60 * 1_000;
    const expiredOwner = advanceManorV7State(caught.owner, expiredAt);
    expect(expiredOwner.farm.dog.feedSeconds).toBe(0);
    const secondVisitor = createManorV7State(expiredAt);
    const stolen = transitionManorV7FriendStates(
      secondVisitor,
      expiredOwner,
      "visitor-2",
      "第二位访客",
      "owner",
      "主人",
      { type: "steal-crop", landId: land.id },
      expiredAt
    );
    expect(inventoryQuantity(stolen.visitor.farm.produceInventory, land.cropId!)).toBeGreaterThan(0);
  });

  it("enforces fish feeding stages, half-yield protection, locking and net harvest output", () => {
    const now = 60_000;
    const fish = manorV7Fish(2);
    const own = createManorV7State(now);
    own.farm.fishPool.opened = true;
    own.farm.fishPool.fish = [{ serial: 1, fishId: fish.id, growthSeconds: 0, stolen: 0, thiefUserIds: [], fedStage: 0 }];
    own.farm.fishPool.toolInventory = [{ sourceId: 1, quantity: 2 }];

    const firstFeed = transitionManorV7State(own, { type: "fertilize-fish", serial: 1, toolId: 1 }, now);
    expect(firstFeed.farm.fishPool.fish[0]).toMatchObject({ fedStage: 1, growthSeconds: 7_200 });
    expect(() => transitionManorV7State(
      firstFeed,
      { type: "fertilize-fish", serial: 1, toolId: 1 },
      now
    )).toThrow("当前生长阶段已经使用过鱼食");

    const secondStageAt = now + (fish.cycleSeconds[0]! - 7_200) * 1_000;
    const secondStage = advanceManorV7State(firstFeed, secondStageAt);
    const secondFeed = transitionManorV7State(
      secondStage,
      { type: "fertilize-fish", serial: 1, toolId: 1 },
      secondStageAt
    );
    expect(secondFeed.farm.fishPool.fish[0]?.fedStage).toBe(2);

    const matureAt = secondStageAt + fish.cycleSeconds.at(-1)! * 1_000;
    const matureOwner = advanceManorV7State(secondFeed, matureAt);
    const stolen = transitionManorV7FriendStates(
      createManorV7State(matureAt),
      matureOwner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "steal-fish", serial: 1 },
      matureAt
    );
    const stolenCount = stolen.owner.farm.fishPool.fish[0]!.stolen;
    expect(stolenCount).toBeGreaterThan(0);
    expect(fish.baseYield - stolenCount).toBeGreaterThanOrEqual(Math.ceil(fish.baseYield / 2));

    const harvested = transitionManorV7State(stolen.owner, { type: "harvest-fish", serial: 1 }, matureAt);
    expect(inventoryQuantity(harvested.farm.fishPool.produceInventory, fish.id)).toBe(fish.baseYield - stolenCount);
    const locked = transitionManorV7State(harvested, { type: "set-fish-lock", fishId: fish.id, locked: true }, matureAt);
    expect(() => transitionManorV7State(
      locked,
      { type: "sell-fish", fishId: fish.id, quantity: 1 },
      matureAt
    )).toThrow("锁定的成鱼不能出售");
  });

  it("keeps cans, hourglasses and weapons in dedicated inventories and completes research", () => {
    const now = 70_000;
    let state = createManorV7State(now);
    state.coins = 1_000_000;
    state = transitionManorV7State(state, {
      type: "buy-tool", area: "pasture", toolId: 1, itemType: 7, quantity: 2, useVip: true
    }, now);
    state = transitionManorV7State(state, {
      type: "buy-tool", area: "pasture", toolId: 43, itemType: 12, quantity: 1, useVip: true
    }, now);
    state = transitionManorV7State(state, {
      type: "buy-tool", area: "pasture", toolId: 7, itemType: 10, quantity: 1, useVip: true
    }, now);
    expect(state.pasture.toolInventory).toEqual([
      { sourceId: 1, quantity: 2 },
      { sourceId: 43, quantity: 1 }
    ]);
    expect(state.pasture.weaponInventory).toEqual([{ sourceId: 7, quantity: 1 }]);
    expect(state.coins).toBe(914_000);

    const rule = MANOR_V7_RESEARCH_RULES.hutch[0];
    const started = transitionManorV7State(
      state,
      { type: "start-research", house: "hutch", animalId: rule.animalId },
      now
    );
    const accelerated = transitionManorV7State(
      started,
      { type: "use-research-hourglass", house: "hutch", toolId: 43 },
      now
    );
    expect(accelerated.pasture.research.hutch.remainingSeconds).toBe(rule.seconds - 43_200);
    expect(accelerated.pasture.toolInventory).toEqual([{ sourceId: 1, quantity: 2 }]);

    const completedAt = now + accelerated.pasture.research.hutch.remainingSeconds * 1_000;
    const completed = advanceManorV7State(accelerated, completedAt);
    expect(completed.pasture.research.hutch).toMatchObject({ animalId: rule.animalId, remainingSeconds: 0 });
    const collected = transitionManorV7State(completed, { type: "collect-research", house: "hutch" }, completedAt);
    expect(inventoryQuantity(collected.pasture.cubInventory, rule.animalId)).toBeGreaterThanOrEqual(1);
    expect(inventoryQuantity(collected.pasture.cubInventory, rule.animalId)).toBeLessThanOrEqual(2);
    expect(collected.pasture.research.hutch).toEqual({ animalId: null, remainingSeconds: 0 });
  });

  it("cleans one manure sprite per action even after the daily reward limit is reached", () => {
    const now = 75_000;
    const initial = createManorV7State(now);
    initial.pasture.manure = 2;
    initial.farm.manureCollection.remaining = 1;

    const first = transitionManorV7State(initial, { type: "collect-manure" }, now);
    expect(first.pasture.manure).toBe(1);
    expect(first.farm.manureCollection.remaining).toBe(0);
    expect(inventoryQuantity(first.pasture.materialInventory, 1506)).toBe(1);

    const second = transitionManorV7State(first, { type: "collect-manure" }, now);
    expect(second.pasture.manure).toBe(0);
    expect(second.farm.manureCollection.remaining).toBe(0);
    expect(inventoryQuantity(second.pasture.materialInventory, 1506)).toBe(1);
    expect(() => transitionManorV7State(second, { type: "collect-manure" }, now))
      .toThrow("没有可清理的便便");
  });

  it("applies friend special feed, manure, mosquito and mouse actions to both saves", () => {
    const now = 80_000;
    let visitor = createManorV7State(now);
    let owner = createManorV7State(now);
    const animal = owner.pasture.animals[1]!;
    const cropId = manorV7SpecialFeedCropId(animal.animalId);
    visitor.farm.produceInventory = [{ sourceId: cropId, quantity: 1 }];
    owner.pasture.manure = 150;

    let result = transitionManorV7FriendStates(
      visitor, owner, "visitor", "访客", "owner", "主人", { type: "special-feed", serial: animal.serial }, now
    );
    expect(inventoryQuantity(result.visitor.farm.produceInventory, cropId)).toBe(0);
    expect(result.owner.pasture.animals[1]!.growthSeconds).toBe(animal.growthSeconds + 300);

    result = transitionManorV7FriendStates(
      result.visitor,
      result.owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "clean-manure", quantity: 150 },
      now
    );
    expect(result.owner.pasture.manure).toBe(0);
    expect(inventoryQuantity(result.visitor.pasture.materialInventory, 1506)).toBe(MANOR_V7_MANURE_COLLECTION_DAILY_LIMIT);
    expect(result.visitor.farm.manureCollection.remaining).toBe(0);

    result = transitionManorV7FriendStates(
      result.visitor, result.owner, "visitor", "访客", "owner", "主人", { type: "add-mosquito", quantity: 1 }, now
    );
    expect(result.owner.pasture.mosquitoes.sourceUserIds).toEqual(["visitor"]);
    result = transitionManorV7FriendStates(
      result.visitor, result.owner, "visitor", "访客", "owner", "主人", { type: "remove-mosquito" }, now
    );
    expect(result.owner.pasture.mosquitoes.sourceUserIds).toEqual([]);

    result.owner.pasture.mousePresent = true;
    const beforeCoins = result.visitor.coins;
    result = transitionManorV7FriendStates(
      result.visitor, result.owner, "visitor", "访客", "owner", "主人", { type: "catch-mouse" }, now
    );
    expect(result.owner.pasture.mousePresent).toBe(false);
    expect(result.visitor.coins - beforeCoins).toBeGreaterThanOrEqual(50);
    expect(result.visitor.coins - beforeCoins).toBeLessThanOrEqual(100);
  });

  it("keeps crop growth speed while care delays reduce final yield by at most half", () => {
    const now = Date.parse("2026-08-17T00:00:00.000Z");
    const initial = createManorV7State(now);
    const land = initial.farm.lands[0]!;
    land.growthSeconds = 0;
    land.watered = false;
    land.weeds = true;
    land.pests = true;

    const advanced = advanceManorV7State(initial, now + 10 * 60 * 1_000);
    expect(advanced.farm.lands[0]).toMatchObject({ growthSeconds: 600, yieldPenaltyPercent: 8 });

    const capped = advanceManorV7State(advanced, now + 2 * 60 * 60 * 1_000);
    expect(capped.farm.lands[0]?.yieldPenaltyPercent).toBe(50);
    expect(toManorV7View(capped, capped.updatedAt).farm.lands[0]?.effectiveYield).toBe(
      Math.ceil(manorV7Crop(land.cropId!).baseYield / 2)
    );
  });

  it("uses the original Thursday rain schedule and keeps active plots watered", () => {
    const wednesday = Date.parse("2026-08-19T00:00:00.000Z");
    const thursday = Date.parse("2026-08-20T00:00:00.000Z");
    const initial = createManorV7State(wednesday);
    initial.farm.lands[0]!.watered = false;

    const advanced = advanceManorV7State(initial, thursday);
    expect(advanced.farm.weather).toEqual({ day: "2026-08-20", kind: "rainy" });
    expect(advanced.farm.lands[0]?.watered).toBe(true);
  });

  it("can discover one or two audited hidden seeds after the final scarify", () => {
    const now = 81_000;
    const initial = createManorV7State(now);
    const land = initial.farm.lands[0]!;
    land.cropId = 1;
    land.harvests = manorV7Crop(1).harvestCycles;
    initial.farm.seedInventory = [];
    initial.randomState = 1_972;

    const cleared = transitionManorV7State(initial, { type: "clear-land", landId: land.id }, now);
    const reward = cleared.farm.seedInventory[0];
    expect(reward).toBeDefined();
    expect(MANOR_V7_HIDDEN_SEED_IDS).toContain(reward!.sourceId);
    expect(reward!.quantity).toBeGreaterThanOrEqual(1);
    expect(reward!.quantity).toBeLessThanOrEqual(2);
  });

  it("processes the original manure and red rose fertilizer recipe", () => {
    const now = 82_000;
    const initial = createManorV7State(now);
    initial.coins = 2_000;
    initial.pasture.materialInventory = [{ sourceId: 1506, quantity: 5 }];
    initial.farm.produceInventory = [{ sourceId: 41, quantity: 5 }];

    const processed = transitionManorV7State(initial, { type: "process-manure-fertilizer" }, now);
    expect(processed.coins).toBe(1_000);
    expect(inventoryQuantity(processed.pasture.materialInventory, 1506)).toBe(0);
    expect(inventoryQuantity(processed.farm.produceInventory, 41)).toBe(0);
    expect(inventoryQuantity(processed.farm.toolInventory, 3)).toBe(1);
  });

  it("packages the audited flower recipes and delivers a persistent gift", () => {
    const now = 83_000;
    const visitor = createManorV7State(now);
    const owner = createManorV7State(now);
    visitor.farm.produceInventory = [{ sourceId: 41, quantity: 3 }];

    const result = transitionManorV7FriendStates(
      visitor, owner, "visitor", "访客", "owner", "主人", { type: "send-flower", flowerId: 12, message: "祝你开心" }, now
    );
    expect(MANOR_V7_FLOWERS).toHaveLength(14);
    expect(inventoryQuantity(result.visitor.farm.produceInventory, 41)).toBe(0);
    expect(result.owner.receivedFlowers).toEqual([expect.objectContaining({
      id: 1,
      flowerId: 12,
      fromUserId: "visitor",
      message: "祝你开心"
    })]);
    expect(result.owner.nextFlowerGiftId).toBe(2);
  });

  it("deletes only the selected received flower records", () => {
    const now = 83_500;
    const initial = createManorV7State(now);
    initial.receivedFlowers = [
      { id: 1, flowerId: 12, fromUserId: "friend-a", fromDisplayName: "好友甲", message: "第一束", sentAt: now },
      { id: 2, flowerId: 12, fromUserId: "friend-b", fromDisplayName: "好友乙", message: "第二束", sentAt: now + 1_000 }
    ];
    initial.nextFlowerGiftId = 3;

    const deleted = transitionManorV7State(
      initial,
      { type: "delete-received-flowers", giftIds: [1] },
      now
    );
    expect(deleted.receivedFlowers).toEqual([expect.objectContaining({ id: 2, message: "第二束" })]);
    expect(() => transitionManorV7State(
      deleted,
      { type: "delete-received-flowers", giftIds: [1] },
      now
    )).toThrow("花束记录不存在");
  });

  it("blocks friend visits until the owner removes the visitor from the filter", () => {
    const now = 84_000;
    const visitor = createManorV7State(now);
    const owner = transitionManorV7State(
      createManorV7State(now),
      { type: "block-friend", userId: "visitor" },
      now
    );
    owner.farm.lands[0]!.weeds = 1;

    expect(() => transitionManorV7FriendStates(
      visitor, owner, "visitor", "访客", "owner", "主人", { type: "remove-weeds", landId: 1 }, now
    )).toThrow("对方暂未允许你进入庄园");

    const unblockedOwner = transitionManorV7State(
      owner,
      { type: "unblock-friend", userId: "visitor" },
      now
    );
    expect(unblockedOwner.friendFilterUserIds).toEqual([]);
    expect(() => transitionManorV7FriendStates(
      visitor, unblockedOwner, "visitor", "访客", "owner", "主人", { type: "remove-weeds", landId: 1 }, now
    )).not.toThrow();
  });

  it("buys grass for a friend and enforces the independent 25-mosquito daily limit", () => {
    const now = Date.UTC(2026, 7, 23, 8);
    const visitor = createManorV7State(now);
    const owner = createManorV7State(now);
    visitor.coins = 1_000;
    owner.pasture.grass = 990;

    const grass = transitionManorV7FriendStates(
      visitor,
      owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "buy-grass-for-friend", quantity: 20 },
      now
    );
    expect(grass.visitor.coins).toBe(700);
    expect(grass.owner.pasture.grass).toBe(1_000);

    const mosquitoes = transitionManorV7FriendStates(
      grass.visitor,
      grass.owner,
      "visitor",
      "访客",
      "owner",
      "主人",
      { type: "add-mosquito", quantity: MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT },
      now
    );
    expect(mosquitoes.visitor.pasture.mosquitoActions.remaining).toBe(0);
    expect(mosquitoes.owner.pasture.mosquitoes.sourceUserIds).toHaveLength(
      MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT
    );
    expect(() => transitionManorV7FriendStates(
      mosquitoes.visitor,
      createManorV7State(now),
      "visitor",
      "访客",
      "second-owner",
      "另一位主人",
      { type: "add-mosquito", quantity: 1 },
      now
    )).toThrow("今天最多还能放 0 只蚊子");

    const nextDay = now + 24 * 60 * 60 * 1_000;
    const reset = advanceManorV7State(mosquitoes.visitor, nextDay);
    expect(reset.pasture.mosquitoActions.remaining).toBe(MANOR_V7_MOSQUITO_ACTION_DAILY_LIMIT);
  });

  it("supports cub sales, animal donation, parade persistence and coin-priced VIP goods", () => {
    const now = 90_000;
    let state = createManorV7State(now);
    state.coins = 2_000_000;
    state.farmExperience = manorV7ExperienceForLevel(60);
    state.pastureExperience = manorV7ExperienceForLevel(60);
    state.pasture.shedLevel = 8;
    state.pasture.animals = [];
    state.pasture.cubInventory = [{ sourceId: 1002, quantity: 2 }];

    const soldCub = transitionManorV7State(state, { type: "sell-cub", animalId: 1002, quantity: 1 }, now);
    expect(inventoryQuantity(soldCub.pasture.cubInventory, 1002)).toBe(1);
    const withAnimal = transitionManorV7State(soldCub, { type: "buy-animal", animalId: 1001, quantity: 1 }, now);
    const donated = transitionManorV7State(
      withAnimal,
      { type: "donate-animal", serial: withAnimal.pasture.animals[0]!.serial },
      now
    );
    expect(donated.pasture.animals).toEqual([]);
    const paraded = transitionManorV7State(
      donated,
      { type: "set-parade", info: "1,2,3", patternId: 2 },
      now
    );
    expect(paraded.pasture.parade).toEqual({ info: "1,2,3", patternId: 2, version: 1 });

    const vipCrop = manorV7Crop(335);
    let vip = transitionManorV7State(paraded, { type: "buy-seed", cropId: vipCrop.id, quantity: 1 }, now);
    const vipAnimal = manorV7Animal(1558);
    vip = transitionManorV7State(vip, { type: "buy-animal", animalId: vipAnimal.id, quantity: 1 }, now);
    vip = transitionManorV7State(vip, {
      type: "buy-tool", area: "farm", toolId: 2, itemType: 3, quantity: 1, useVip: true
    }, now);
    vip = transitionManorV7State(vip, {
      type: "buy-decoration", area: "farm", decorationId: 45, useVip: true
    }, now);
    vip = transitionManorV7State(vip, {
      type: "upgrade-land", landId: 5, tier: "red", useVip: true
    }, now);
    vip = transitionManorV7State(vip, {
      type: "upgrade-land", landId: 5, tier: "black", useVip: true
    }, now);
    const tool = MANOR_V7_TOOLS.find((item) => item.area === "farm" && item.id === 2 && item.itemType === 3)!;
    const decoration = manorV7Decoration("farm", 45);
    const redLand = manorV7LandUpgrade("red", 0);
    const blackLand = manorV7LandUpgrade("black", 0);
    expect(vip.coins).toBe(
      paraded.coins
      - vipCrop.seedPrice
      - vipAnimal.purchasePrice
      - manorV7ToolCoinPrice(tool)
      - manorV7DecorationCoinPrice(decoration)
      - redLand.coins
      - blackLand.coins
    );
    expect(inventoryQuantity(vip.farm.seedInventory, vipCrop.id)).toBe(1);
    expect(vip.pasture.animals).toEqual([expect.objectContaining({ animalId: vipAnimal.id })]);
    expect(inventoryQuantity(vip.farm.toolInventory, 2)).toBe(1);
    expect(vip.ownedDecorationIds).toContain(45);
    expect(vip.farm.lands[4]).toMatchObject({ tier: "black" });
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

    const defender = createManorV7State(now);
    defender.pasture.weaponInventory = [{ sourceId: 7, quantity: 1 }];
    const attacked = transitionManorV7FriendStates(
      defender,
      released.owner,
      "friend",
      "好友",
      "friend-farm",
      "好友牧场",
      { type: "attack-wild-animal", serial: 1, attackType: "Gun", weaponId: 7 },
      now
    );
    expect(attacked.visitor.pasture.wild.moralExperience).toBe(1);
    expect(attacked.visitor.pasture.weaponInventory).toEqual([]);
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

  it("sells wild crystals for their audited coin value", () => {
    const now = 41_000;
    const initial = createManorV7State(now);
    initial.coins = 100;
    initial.pasture.wild.crystalInventory = [{ sourceId: 1, quantity: 3 }];

    const sold = transitionManorV7State(
      initial,
      { type: "sell-wild-crystal", crystalId: 1, quantity: 2 },
      now
    );
    expect(sold.coins).toBe(120);
    expect(sold.pasture.wild.crystalInventory).toEqual([{ sourceId: 1, quantity: 1 }]);
    expect(() => transitionManorV7State(
      sold,
      { type: "sell-wild-crystal", crystalId: 1, quantity: 2 },
      now
    )).toThrow("水晶库存不足");
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
