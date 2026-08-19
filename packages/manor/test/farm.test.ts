import { describe, expect, it } from "vitest";
import {
  applyManorAction,
  createManorFarm,
  experienceForLevel,
  MANOR_CROPS,
  MANOR_FERTILIZERS,
  MANOR_LAND_UNLOCKS,
  MANOR_LEVEL_REWARDS,
  migrateManorFarm,
  toManorFarmView
} from "../src/index.js";

describe("manor farm", () => {
  it("starts with six plots and reclaims later plots using the original level and coin rules", () => {
    const startedAt = 1_000;
    let farm = createManorFarm(startedAt, "land-progression");
    const initial = toManorFarmView(farm, "玩家", startedAt);

    expect(farm.unlockedPlotCount).toBe(6);
    expect(initial.plots[5]).toMatchObject({ id: 6, unlocked: true, nextUnlock: false });
    expect(initial.plots[6]).toMatchObject({
      id: 7,
      unlocked: false,
      nextUnlock: true,
      unlockLevel: 5,
      unlockCost: 10_000
    });
    expect(initial.plots[7]).toMatchObject({
      id: 8,
      unlocked: false,
      nextUnlock: false,
      unlockLevel: 7,
      unlockCost: 20_000
    });
    expect(MANOR_LAND_UNLOCKS).toHaveLength(12);
    expect(MANOR_LAND_UNLOCKS.at(-1)).toEqual({
      plotId: 18,
      levelRequired: 27,
      coinCost: 500_000
    });
    expect(() =>
      applyManorAction(farm, { type: "plant", plotId: 7, cropId: "radish" }, startedAt + 1)
    ).toThrow("尚未开垦");
    expect(() =>
      applyManorAction(farm, { type: "reclaim-plot", plotId: 7 }, startedAt + 1)
    ).toThrow("达到 5 级");

    farm.experience = experienceForLevel(5);
    farm.coins = 9_999;
    expect(() =>
      applyManorAction(farm, { type: "reclaim-plot", plotId: 7 }, startedAt + 2)
    ).toThrow("金币不足");
    farm.coins = 10_000;
    expect(() =>
      applyManorAction(farm, { type: "reclaim-plot", plotId: 8 }, startedAt + 2)
    ).toThrow("请先开垦第 7 块土地");

    farm = applyManorAction(farm, { type: "reclaim-plot", plotId: 7 }, startedAt + 2);
    expect(farm).toMatchObject({ unlockedPlotCount: 7, coins: 0, revision: 1 });
    expect(toManorFarmView(farm, "玩家", startedAt + 2).plots[6]).toMatchObject({
      id: 7,
      unlocked: true,
      nextUnlock: false
    });
    expect(() =>
      applyManorAction(farm, { type: "reclaim-plot", plotId: 7 }, startedAt + 3)
    ).toThrow("已经开垦");
  });

  it("runs the seed, plant, care, harvest and sale loop", () => {
    const startedAt = 1_000_000;
    let farm = createManorFarm(startedAt, "account-1");
    expect(farm.plots).toHaveLength(18);
    farm = applyManorAction(farm, { type: "plant", plotId: 1, cropId: "radish" }, startedAt);

    const growing = toManorFarmView(farm, "玩家", startedAt + 30_000);
    expect(growing.plots[0]).toMatchObject({ status: "growing", watered: true });

    const readyAt = growing.plots[0]?.readyAt;
    if (!readyAt) throw new Error("readyAt missing");
    const mature = toManorFarmView(farm, "玩家", readyAt);
    let careActions = 0;
    if (!mature.plots[0]?.watered) {
      farm = applyManorAction(farm, { type: "water", plotId: 1 }, readyAt);
      careActions += 1;
    }
    if (mature.plots[0]?.weed) {
      farm = applyManorAction(farm, { type: "clear-weed", plotId: 1 }, readyAt);
      careActions += 1;
    }
    if (mature.plots[0]?.pest) {
      farm = applyManorAction(farm, { type: "clear-pest", plotId: 1 }, readyAt);
      careActions += 1;
    }
    farm = applyManorAction(farm, { type: "harvest", plotId: 1 }, readyAt + 1);
    const withered = toManorFarmView(farm, "玩家", readyAt + 1);
    expect(withered.plots[0]?.status).toBe("withered");
    farm = applyManorAction(farm, { type: "clear-plot", plotId: 1 }, readyAt + 2);
    const harvested = toManorFarmView(farm, "玩家", readyAt + 2);
    const radish = harvested.catalog.find((crop) => crop.id === "radish");
    expect(harvested.plots[0]?.status).toBe("empty");
    expect(radish?.produce).toBe(16);
    expect(harvested.profile.experience).toBe(20 + careActions * 2);

    farm = applyManorAction(
      farm,
      { type: "sell", cropId: "radish", quantity: 16 },
      readyAt + 3
    );
    expect(farm.coins).toBe(392 + careActions * 2);
    expect(farm.produce.radish).toBe(0);
  });

  it("enforces unlocks, balances and maturity", () => {
    const farm = createManorFarm(1_000, "account-2");
    expect(() =>
      applyManorAction(farm, { type: "buy-seeds", cropId: "cabbage", quantity: 1 }, 2_000)
    ).toThrow("2 级");
    expect(() =>
      applyManorAction(farm, { type: "sell", cropId: "radish", quantity: 1 }, 2_000)
    ).toThrow("仓库数量不足");
    const planted = applyManorAction(
      farm,
      { type: "plant", plotId: 1, cropId: "radish" },
      2_000
    );
    expect(() =>
      applyManorAction(planted, { type: "harvest", plotId: 1 }, 3_000)
    ).toThrow("尚未成熟");
  });

  it("supports accelerated development time and validates persisted data", () => {
    const startedAt = 10_000;
    const farm = applyManorAction(
      createManorFarm(startedAt, "account-3"),
      { type: "plant", plotId: 1, cropId: "radish" },
      startedAt,
      { timeScale: 3_600 }
    );
    const view = toManorFarmView(farm, "玩家", startedAt + 10_000, { timeScale: 3_600 });
    expect(view.catalog[0]?.growthSeconds).toBe(10);
    expect(view.catalog[0]?.growthStageSeconds).toEqual([2, 4, 7, 10, 10]);
    expect(view.plots[0]?.status).toBe("mature");
    expect(migrateManorFarm(JSON.parse(JSON.stringify(farm)))).toEqual(farm);
  });

  it("uses original care rewards and time-based output penalties", () => {
    const startedAt = 100_000;
    let farm = applyManorAction(
      createManorFarm(startedAt, "care-rules"),
      { type: "plant", plotId: 1, cropId: "radish" },
      startedAt
    );
    expect(() => applyManorAction(farm, { type: "water", plotId: 1 }, startedAt + 1)).toThrow(
      "当前不需要浇水"
    );

    const plot = farm.plots[0];
    if (!plot) throw new Error("plot missing");
    plot.dryAt = startedAt + 1_000;
    plot.weedAt = startedAt + 1_000;
    plot.pestAt = startedAt + 1_000;
    delete plot.wateredAt;
    delete plot.weedClearedAt;
    delete plot.pestClearedAt;
    const careAt = startedAt + 301_000;
    expect(toManorFarmView(farm, "玩家", careAt).plots[0]).toMatchObject({
      watered: false,
      weed: true,
      pest: true,
      estimatedYield: 15
    });

    farm = applyManorAction(farm, { type: "water", plotId: 1 }, careAt);
    farm = applyManorAction(farm, { type: "clear-weed", plotId: 1 }, careAt);
    farm = applyManorAction(farm, { type: "clear-pest", plotId: 1 }, careAt);
    expect(farm.coins).toBe(126);
    expect(farm.experience).toBe(8);
    expect(toManorFarmView(farm, "玩家", careAt).plots[0]).toMatchObject({
      watered: true,
      weed: false,
      pest: false,
      estimatedYield: 16
    });
  });

  it("claims the original starter gift once", () => {
    const startedAt = 400_000;
    const initial = createManorFarm(startedAt, "starter-gift");
    const tomato = MANOR_CROPS.find((crop) => crop.sourceId === 7);
    if (!tomato) throw new Error("tomato missing");

    expect(toManorFarmView(initial, "玩家", startedAt).starterGift).toMatchObject({
      claimed: false,
      items: [
        { kind: "fertilizer", sourceId: 1, quantity: 4 },
        { kind: "seed", sourceId: 7, quantity: 2 }
      ]
    });

    const claimed = applyManorAction(initial, { type: "claim-starter-gift" }, startedAt + 1);
    expect(claimed.starterGiftClaimed).toBe(true);
    expect(claimed.fertilizers.ordinary).toBe(4);
    expect(claimed.seeds[tomato.id]).toBe(2);
    expect(() =>
      applyManorAction(claimed, { type: "claim-starter-gift" }, startedAt + 2)
    ).toThrow("已经领取");
  });

  it("awards every crossed original level threshold and acknowledges the popup once", () => {
    const startedAt = 450_000;
    let farm = createManorFarm(startedAt, "level-rewards");
    const corn = MANOR_CROPS.find((crop) => crop.sourceId === 4);
    if (!corn) throw new Error("corn missing");
    farm.experience = 598;

    farm = applyManorAction(
      farm,
      { type: "plant", plotId: 1, cropId: "radish" },
      startedAt + 1
    );

    expect(farm.experience).toBe(600);
    expect(farm.rewardedThroughOriginalLevel).toBe(2);
    expect(farm.pendingLevelRewardLevels).toEqual([1, 2]);
    expect(farm.seeds[corn.id]).toBe(2);
    expect(farm.fertilizers.ordinary).toBe(2);
    expect(toManorFarmView(farm, "玩家", startedAt + 1).pendingLevelRewards).toMatchObject([
      { originalLevel: 1, displayLevel: 2 },
      { originalLevel: 2, displayLevel: 3 }
    ]);

    const acknowledged = applyManorAction(
      farm,
      { type: "acknowledge-level-rewards" },
      startedAt + 2
    );
    expect(acknowledged.pendingLevelRewardLevels).toEqual([]);
    expect(acknowledged.seeds[corn.id]).toBe(2);
    expect(acknowledged.fertilizers.ordinary).toBe(2);
    expect(() =>
      applyManorAction(
        acknowledged,
        { type: "acknowledge-level-rewards" },
        startedAt + 3
      )
    ).toThrow("没有待确认");
  });

  it("applies the complete original thirty-level reward table", () => {
    const startedAt = 475_000;
    let farm = createManorFarm(startedAt, "all-level-rewards");
    farm.experience = 92_998;

    farm = applyManorAction(
      farm,
      { type: "plant", plotId: 1, cropId: "radish" },
      startedAt + 1
    );

    expect(MANOR_LEVEL_REWARDS).toHaveLength(30);
    expect(MANOR_LEVEL_REWARDS.at(-1)).toMatchObject({
      originalLevel: 30,
      displayLevel: 31,
      requiredExperience: 93_000,
      item: { kind: "seed", sourceId: 80, quantity: 2 }
    });
    expect(farm.rewardedThroughOriginalLevel).toBe(30);
    expect(farm.pendingLevelRewardLevels).toHaveLength(30);
    expect(farm.fertilizers).toEqual({ ordinary: 2, fast: 2, instant: 20 });
    expect(farm.decorationEntitlements).toEqual([253, 255, 256, 254]);
  });

  it("buys and applies original normal fertilizer once per growth stage", () => {
    const startedAt = 500_000;
    let farm = createManorFarm(startedAt, "fertilizer-rules");
    farm.coins = 800;
    farm = applyManorAction(farm, { type: "buy-fertilizer", quantity: 2 }, startedAt);
    expect(farm).toMatchObject({ coins: 0, fertilizers: { ordinary: 2, fast: 0, instant: 0 } });
    farm = applyManorAction(
      farm,
      { type: "plant", plotId: 1, cropId: "radish" },
      startedAt,
      { timeScale: 3_600 }
    );
    const originalReadyAt = farm.plots[0]?.readyAt;
    if (!originalReadyAt) throw new Error("readyAt missing");

    farm = applyManorAction(
      farm,
      { type: "fertilize", plotId: 1, fertilizerId: "ordinary" },
      startedAt,
      { timeScale: 3_600 }
    );
    expect(farm.plots[0]).toMatchObject({
      readyAt: originalReadyAt - 1_000,
      fertilizedStage: 0
    });
    expect(farm.fertilizers.ordinary).toBe(1);
    expect(() =>
      applyManorAction(
        farm,
        { type: "fertilize", plotId: 1, fertilizerId: "ordinary" },
        startedAt,
        { timeScale: 3_600 }
      )
    ).toThrow("当前生长阶段已经施过肥");

    farm = applyManorAction(
      farm,
      { type: "fertilize", plotId: 1, fertilizerId: "ordinary" },
      startedAt + 1_000,
      { timeScale: 3_600 }
    );
    expect(farm.plots[0]?.readyAt).toBe(originalReadyAt - 2_000);
    expect(farm.plots[0]?.fertilizedStage).toBe(1);
    expect(farm.fertilizers.ordinary).toBe(0);
    expect(migrateManorFarm(JSON.parse(JSON.stringify(farm)))).toEqual(farm);
  });

  it("uses the original effects for all three fertilizer types", () => {
    const crop = MANOR_CROPS.reduce((longest, candidate) =>
      (candidate.growthStageSeconds[0] ?? 0) > (longest.growthStageSeconds[0] ?? 0)
        ? candidate
        : longest
    );
    const effects = Object.fromEntries(
      MANOR_FERTILIZERS.map((fertilizer) => [fertilizer.id, fertilizer.effectSeconds])
    );

    for (const fertilizerId of ["ordinary", "fast", "instant"] as const) {
      const startedAt = 600_000;
      let farm = createManorFarm(startedAt, `fertilizer-${fertilizerId}`);
      farm.seeds[crop.id] = 1;
      farm.fertilizers[fertilizerId] = 1;
      farm = applyManorAction(
        farm,
        { type: "plant", plotId: 1, cropId: crop.id },
        startedAt
      );
      const originalReadyAt = farm.plots[0]?.readyAt;
      if (!originalReadyAt) throw new Error("readyAt missing");

      farm = applyManorAction(
        farm,
        { type: "fertilize", plotId: 1, fertilizerId },
        startedAt
      );

      const expectedReduction = Math.min(
        effects[fertilizerId] ?? 0,
        crop.growthStageSeconds[0] ?? 0
      ) * 1_000;
      expect(originalReadyAt - (farm.plots[0]?.readyAt ?? 0)).toBe(expectedReduction);
      expect(farm.fertilizers[fertilizerId]).toBe(0);
    }
  });

  it("exposes the complete original crop catalog and hides event seeds from the shop", () => {
    const view = toManorFarmView(createManorFarm(1_000, "catalog"), "玩家", 1_000);
    expect(view.catalog).toHaveLength(86);
    expect(view.catalog.filter((crop) => crop.purchasable)).toHaveLength(57);
    expect(view.catalog.filter((crop) => !crop.purchasable)).toHaveLength(29);
    expect(view.catalog.find((crop) => crop.id === "radish")).toMatchObject({
      sourceId: 2,
      levelRequired: 1,
      harvestCycles: 1
    });
    expect(view.catalog.find((crop) => crop.id === "legacy-87")).toMatchObject({
      name: "百香果",
      levelRequired: 40,
      harvestCycles: 6
    });

    expect(() =>
      applyManorAction(
        createManorFarm(1_000, "hidden-shop"),
        { type: "buy-seeds", cropId: "legacy-81", quantity: 1 },
        2_000
      )
    ).toThrow("特殊种子无法在商店购买");
  });

  it("runs every harvest cycle before withering and uses the original regrowth duration", () => {
    const startedAt = 50_000;
    let farm = createManorFarm(startedAt, "multi-season");
    farm.seeds["legacy-13"] = 1;
    farm = applyManorAction(
      farm,
      { type: "plant", plotId: 1, cropId: "legacy-13" },
      startedAt,
      { timeScale: 3_600 }
    );

    let readyAt = farm.plots[0]?.readyAt;
    if (!readyAt) throw new Error("first readyAt missing");
    farm = applyManorAction(farm, { type: "harvest", plotId: 1 }, readyAt, { timeScale: 3_600 });
    expect(farm.plots[0]).toMatchObject({ harvestedCycles: 1, plantedAt: readyAt });
    expect((farm.plots[0]?.readyAt ?? 0) - readyAt).toBe(20_000);
    expect(toManorFarmView(farm, "玩家", readyAt, { timeScale: 3_600 }).plots[0]?.visualStageThresholds).toEqual([0, 0]);

    readyAt = farm.plots[0]?.readyAt;
    if (!readyAt) throw new Error("second readyAt missing");
    farm = applyManorAction(farm, { type: "harvest", plotId: 1 }, readyAt, { timeScale: 3_600 });
    readyAt = farm.plots[0]?.readyAt;
    if (!readyAt) throw new Error("third readyAt missing");
    farm = applyManorAction(farm, { type: "harvest", plotId: 1 }, readyAt, { timeScale: 3_600 });

    expect(toManorFarmView(farm, "玩家", readyAt).plots[0]).toMatchObject({
      status: "withered",
      harvestedCycles: 3,
      harvestCycles: 3
    });
    expect(farm.experience).toBe(92);

    const hiddenSeedCount = () => MANOR_CROPS
      .filter((crop) => !crop.purchasable)
      .reduce((total, crop) => total + farm.seeds[crop.id], 0);
    const beforeReward = hiddenSeedCount();
    farm.randomState = 1;
    farm = applyManorAction(farm, { type: "clear-plot", plotId: 1 }, readyAt + 1);
    expect(hiddenSeedCount() - beforeReward).toBeGreaterThanOrEqual(1);
    expect(hiddenSeedCount() - beforeReward).toBeLessThanOrEqual(2);
    expect(farm.experience).toBe(95);
    expect(farm.plots[0]?.cropId).toBeUndefined();
  });

  it("migrates the six-plot v1 save without losing existing progress", () => {
    const startedAt = 20_000;
    const current = applyManorAction(
      createManorFarm(startedAt, "legacy-account"),
      { type: "plant", plotId: 2, cropId: "radish" },
      startedAt
    );
    const legacy = {
      ...current,
      schemaVersion: 1,
      seeds: {
        radish: current.seeds.radish,
        carrot: current.seeds.carrot,
        corn: current.seeds.corn,
        tomato: current.seeds.tomato
      },
      produce: {
        radish: current.produce.radish,
        carrot: current.produce.carrot,
        corn: current.produce.corn,
        tomato: current.produce.tomato
      },
      plots: current.plots.slice(0, 6).map(({ harvestedCycles: _harvestedCycles, ...plot }) => plot)
    };

    const migrated = migrateManorFarm(legacy);

    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.fertilizers).toEqual({ ordinary: 0, fast: 0, instant: 0 });
    expect(migrated.starterGiftClaimed).toBe(true);
    expect(migrated.unlockedPlotCount).toBe(18);
    expect(migrated.plots).toHaveLength(18);
    expect(migrated.plots[1]).toMatchObject({ id: 2, cropId: "radish", harvestedCycles: 0 });
    expect(migrated.seeds.potato).toBe(0);
    expect(migrated.produce.cabbage).toBe(0);
    expect(migrated.plots.slice(6)).toEqual(
      Array.from({ length: 12 }, (_, index) => ({ id: index + 7, cycle: 0 }))
    );
  });

  it("keeps all plots available when migrating an existing v4 farm", () => {
    const startedAt = 30_000;
    let current = createManorFarm(startedAt, "v4-account");
    current.unlockedPlotCount = 18;
    current = applyManorAction(
      current,
      { type: "plant", plotId: 18, cropId: "radish" },
      startedAt
    );
    const { unlockedPlotCount: _unlockedPlotCount, ...withoutLandProgress } = current;
    const migrated = migrateManorFarm({ ...withoutLandProgress, schemaVersion: 4 });

    expect(migrated).toMatchObject({ schemaVersion: 6, unlockedPlotCount: 18 });
    expect(migrated.plots[17]).toMatchObject({ id: 18, cropId: "radish" });
  });

  it("migrates a v5 farm without replaying starter or level rewards", () => {
    const startedAt = 40_000;
    const current = createManorFarm(startedAt, "v5-account");
    current.experience = experienceForLevel(8);
    current.coins = 400;
    const {
      fertilizers: _fertilizers,
      starterGiftClaimed: _starterGiftClaimed,
      rewardedThroughOriginalLevel: _rewardedThroughOriginalLevel,
      pendingLevelRewardLevels: _pendingLevelRewardLevels,
      decorationEntitlements: _decorationEntitlements,
      ...legacyFields
    } = current;

    const migrated = migrateManorFarm({
      ...legacyFields,
      schemaVersion: 5,
      fertilizer: 3
    });

    expect(migrated).toMatchObject({
      schemaVersion: 6,
      starterGiftClaimed: true,
      rewardedThroughOriginalLevel: 7,
      pendingLevelRewardLevels: [],
      fertilizers: { ordinary: 3, fast: 0, instant: 0 }
    });
    expect(
      applyManorAction(migrated, { type: "buy-fertilizer", quantity: 1 }, startedAt + 1)
        .pendingLevelRewardLevels
    ).toEqual([]);
  });
});
