import { describe, expect, it } from "vitest";
import {
  applyManorAction,
  createManorFarm,
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
    const harvested = toManorFarmView(farm, "玩家", readyAt + 1);
    const radish = harvested.catalog.find((crop) => crop.id === "radish");
    expect(harvested.plots[0]?.status).toBe("empty");
    expect(radish?.produce).toBe(16);

    farm = applyManorAction(
      farm,
      { type: "sell", cropId: "radish", quantity: 16 },
      readyAt + 2
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
      plots: current.plots.slice(0, 6)
    };

    const migrated = migrateManorFarm(legacy);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.plots).toHaveLength(18);
    expect(migrated.plots[1]).toMatchObject({ id: 2, cropId: "radish" });
    expect(migrated.seeds.potato).toBe(0);
    expect(migrated.produce.cabbage).toBe(0);
    expect(migrated.plots.slice(6)).toEqual(
      Array.from({ length: 12 }, (_, index) => ({ id: index + 7, cycle: 0 }))
    );
  });
});
