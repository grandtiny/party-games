import { describe, expect, it } from "vitest";
import {
  applyManorAction,
  createManorFarm,
  MANOR_CROPS,
  migrateManorFarm,
  toManorFarmView
} from "../src/index.js";

describe("manor farm", () => {
  it("runs the seed, plant, care, harvest and sale loop", () => {
    const startedAt = 1_000_000;
    let farm = createManorFarm(startedAt, "account-1");
    expect(farm.plots).toHaveLength(18);
    farm = applyManorAction(farm, { type: "plant", plotId: 1, cropId: "radish" }, startedAt);
    farm = applyManorAction(farm, { type: "water", plotId: 1 }, startedAt + 1_000);

    const growing = toManorFarmView(farm, "玩家", startedAt + 30_000);
    expect(growing.plots[0]).toMatchObject({ status: "growing", watered: true });

    const readyAt = growing.plots[0]?.readyAt;
    if (!readyAt) throw new Error("readyAt missing");
    const mature = toManorFarmView(farm, "玩家", readyAt);
    if (mature.plots[0]?.weed) {
      farm = applyManorAction(farm, { type: "clear-weed", plotId: 1 }, readyAt);
    }
    if (mature.plots[0]?.pest) {
      farm = applyManorAction(farm, { type: "clear-pest", plotId: 1 }, readyAt);
    }
    farm = applyManorAction(farm, { type: "harvest", plotId: 1 }, readyAt + 1);
    const withered = toManorFarmView(farm, "玩家", readyAt + 1);
    expect(withered.plots[0]?.status).toBe("withered");
    farm = applyManorAction(farm, { type: "clear-plot", plotId: 1 }, readyAt + 2);
    const harvested = toManorFarmView(farm, "玩家", readyAt + 2);
    const radish = harvested.catalog.find((crop) => crop.id === "radish");
    expect(harvested.plots[0]?.status).toBe("empty");
    expect(radish?.produce).toBe(16);
    expect(harvested.profile.experience).toBe(20);

    farm = applyManorAction(
      farm,
      { type: "sell", cropId: "radish", quantity: 16 },
      readyAt + 3
    );
    expect(farm.coins).toBe(392);
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
    expect(view.plots[0]?.status).toBe("mature");
    expect(migrateManorFarm(JSON.parse(JSON.stringify(farm)))).toEqual(farm);
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

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.plots).toHaveLength(18);
    expect(migrated.plots[1]).toMatchObject({ id: 2, cropId: "radish", harvestedCycles: 0 });
    expect(migrated.seeds.potato).toBe(0);
    expect(migrated.produce.cabbage).toBe(0);
    expect(migrated.plots.slice(6)).toEqual(
      Array.from({ length: 12 }, (_, index) => ({ id: index + 7, cycle: 0 }))
    );
  });
});
