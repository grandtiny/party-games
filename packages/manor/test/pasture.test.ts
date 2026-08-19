import { describe, expect, it } from "vitest";
import {
  advanceManorPasture,
  applyManorPastureAction,
  createManorPasture,
  experienceForPastureLevel,
  MANOR_ANIMALS,
  MANOR_GRASS_CAPACITY,
  MANOR_HUTCH_UPGRADES,
  MANOR_SHED_UPGRADES,
  toManorPastureView,
  type ManorPastureState
} from "../src/index.js";

describe("manor pasture", () => {
  it("starts with the original two rabbits, twenty grass and initial house capacities", () => {
    const now = 1_000;
    const pasture = createManorPasture(now);
    const view = toManorPastureView(pasture, 120, 0, "玩家", now);

    expect(MANOR_ANIMALS).toHaveLength(35);
    expect(pasture.grass).toBe(20);
    expect(pasture.animals).toHaveLength(2);
    expect(pasture.animals.map((animal) => animal.sourceId)).toEqual([1002, 1002]);
    expect(view.animals.map((animal) => animal.visualState)).toEqual([
      "lifecycle_complete",
      "ready_to_produce"
    ]);
    expect(view.houses.hutch).toMatchObject({ level: 1, capacity: 2, occupied: 2 });
    expect(view.houses.shed).toMatchObject({ level: 0, capacity: 0, occupied: 0 });
    expect(MANOR_HUTCH_UPGRADES).toHaveLength(8);
    expect(MANOR_SHED_UPGRADES).toHaveLength(9);
  });

  it("uses shared grass and pauses consumers when feed runs out", () => {
    const now = 10_000;
    const state = emptyPasture(now, {
      grass: 1,
      animals: [{ serial: 1, sourceId: 1001, growthSeconds: 0, pendingProduct: 0 }]
    });
    const advanced = advanceManorPasture(state, now + 8 * 3_600_000);

    expect(advanced.grass).toBe(0);
    expect(advanced.animals[0]?.growthSeconds).toBe(14_400);
    const view = toManorPastureView(advanced, 0, 0, "玩家", now + 8 * 3_600_000);
    expect(view.animals[0]).toMatchObject({ visualState: "growing", hungry: true });
  });

  it("keeps zero-consumption animals growing without grass", () => {
    const now = 20_000;
    const pixiu = MANOR_ANIMALS.find((animal) => animal.sourceId === 1512);
    if (!pixiu) throw new Error("pixiu missing");
    const state = emptyPasture(now, {
      grass: 0,
      shedLevel: 1,
      animals: [{ serial: 1, sourceId: 1512, growthSeconds: 0, pendingProduct: 0 }]
    });
    const advanced = advanceManorPasture(state, now + 3_600_000);

    expect(advanced.animals[0]?.growthSeconds).toBe(3_600);
    expect(toManorPastureView(advanced, 0, 0, "玩家", now + 3_600_000).animals[0]?.hungry).toBe(false);
    expect(pixiu.grassPerFourHours).toBe(0);
  });

  it("runs production, byproduct harvest, adult harvest and sale", () => {
    const now = 30_000;
    let pasture = createManorPasture(now);
    let result = applyManorPastureAction(
      pasture,
      0,
      { type: "start-animal-production", animalSerial: 2 },
      now
    );
    pasture = result.pasture;
    expect(pasture.animals[1]).toMatchObject({ pendingProduct: 12 });
    expect(pasture.experience).toBe(5);
    expect(toManorPastureView(pasture, 0, 0, "玩家", now).animals[1]?.visualState).toBe(
      "production_early"
    );

    pasture = advanceManorPasture(pasture, now + 181_000);
    expect(toManorPastureView(pasture, 0, 0, "玩家", now + 181_000).animals[1]?.visualState).toBe(
      "production_late"
    );
    expect(() =>
      applyManorPastureAction(
        pasture,
        0,
        { type: "start-animal-production", animalSerial: 2 },
        now + 181_000
      )
    ).toThrow("下一次生产");

    result = applyManorPastureAction(
      pasture,
      0,
      { type: "harvest-animal-product", animalSerial: 2 },
      now + 182_000
    );
    pasture = result.pasture;
    expect(pasture.byproducts[1002]).toBe(12);
    expect(pasture.experience).toBe(13);

    expect(() =>
      applyManorPastureAction(
        pasture,
        0,
        { type: "harvest-animal", animalSerial: 2 },
        now + 183_000
      )
    ).toThrow("还未到收获时间");
    result = applyManorPastureAction(
      pasture,
      0,
      { type: "harvest-animal", animalSerial: 1 },
      now + 183_000
    );
    pasture = result.pasture;
    expect(pasture.harvestedAnimals[1002]).toBe(1);
    expect(pasture.experience).toBe(41);

    result = applyManorPastureAction(
      pasture,
      0,
      { type: "sell-pasture-item", animalId: 1002, itemType: "byproduct", quantity: 12 },
      now + 184_000
    );
    expect(result.coins).toBe(468);
    result = applyManorPastureAction(
      result.pasture,
      result.coins,
      { type: "sell-pasture-item", animalId: 1002, itemType: "animal", quantity: 1 },
      now + 185_000
    );
    expect(result.coins).toBe(1_928);
  });

  it("uses the package sale table that the original CGI actually reads", () => {
    const goose = MANOR_ANIMALS.find((animal) => animal.sourceId === 1003);
    const pangolin = MANOR_ANIMALS.find((animal) => animal.sourceId === 1018);
    expect(goose).toMatchObject({
      configuredAnimalSalePrice: 1_850,
      animalSalePrice: 1_060,
      byproductHarvestExperience: 11
    });
    expect(pangolin).toMatchObject({
      configuredByproductSalePrice: 78,
      byproductSalePrice: 18
    });
  });

  it("enforces house capacity, pasture levels, grass cap and balances", () => {
    const now = 40_000;
    let pasture = createManorPasture(now);
    expect(() =>
      applyManorPastureAction(
        pasture,
        10_000,
        { type: "buy-animal", animalId: 1001, quantity: 1 },
        now
      )
    ).toThrow("窝的空位不足");
    expect(() =>
      applyManorPastureAction(
        pasture,
        10_000,
        { type: "upgrade-animal-house", house: "hutch" },
        now
      )
    ).toThrow("达到 2 级");

    pasture.experience = experienceForPastureLevel(2);
    let result = applyManorPastureAction(
      pasture,
      3_000,
      { type: "upgrade-animal-house", house: "hutch" },
      now
    );
    pasture = result.pasture;
    expect(result.coins).toBe(0);
    expect(toManorPastureView(pasture, 0, 0, "玩家", now).houses.hutch.capacity).toBe(3);
    expect(() =>
      applyManorPastureAction(
        pasture,
        699,
        { type: "buy-animal", animalId: 1001, quantity: 1 },
        now
      )
    ).toThrow("金币不足");
    result = applyManorPastureAction(
      pasture,
      700,
      { type: "buy-animal", animalId: 1001, quantity: 1 },
      now
    );
    expect(result.pasture.animals).toHaveLength(3);

    const nearlyFull = emptyPasture(now, { grass: 399.5 });
    expect(() =>
      applyManorPastureAction(nearlyFull, 1_000, { type: "buy-grass", quantity: 1 }, now)
    ).toThrow("已经加满");
    const feedable = emptyPasture(now, { grass: 398.5 });
    result = applyManorPastureAction(feedable, 60, { type: "buy-grass", quantity: 5 }, now);
    expect(result.pasture.grass).toBe(399.5);
    expect(result.coins).toBe(0);
    expect(MANOR_GRASS_CAPACITY).toBe(400);
  });
});

function emptyPasture(
  now: number,
  overrides: Partial<ManorPastureState> = {}
): ManorPastureState {
  return {
    schemaVersion: 1,
    experience: 0,
    grass: 0,
    hutchLevel: 1,
    shedLevel: 0,
    nextAnimalSerial: 2,
    animals: [],
    byproducts: {},
    harvestedAnimals: {},
    updatedAt: now,
    ...overrides
  };
}
