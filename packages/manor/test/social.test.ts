import { describe, expect, it } from "vitest";
import {
  applyManorAction,
  applyManorFriendFarmAction,
  applyManorFriendPastureAction,
  applyManorFriendVisit,
  createManorFarm,
  MANOR_CROPS,
  MANOR_FLOWERS,
  MANOR_TASKS,
  migrateManorFarm,
  toManorFlowerCatalog
} from "../src/index.js";

describe("manor social rules", () => {
  it("keeps all 14 original bouquet recipes", () => {
    expect(MANOR_FLOWERS).toHaveLength(14);
    expect(MANOR_FLOWERS[0]).toMatchObject({ id: 1, name: "最爱纯真", requirements: [{ sourceId: 105, quantity: 33 }] });
    expect(MANOR_FLOWERS[13]).toMatchObject({ id: 14, name: "真爱久久", requirements: [{ sourceId: 41, quantity: 99 }] });
  });

  it("completes starter tasks only when the matching real action occurs", () => {
    const now = 1_000;
    const initial = createManorFarm(now, "task-user", { enableStarterTasks: true });
    expect(initial.nextTaskId).toBe(0);

    const planted = applyManorAction(
      initial,
      { type: "plant", plotId: 1, cropId: "radish" },
      now + 1
    );
    expect(planted).toMatchObject({ nextTaskId: 1, coins: 120, experience: 102 });

    const unrelated = applyManorAction(
      planted,
      { type: "plant", plotId: 2, cropId: "radish" },
      now + 2
    );
    expect(unrelated.nextTaskId).toBe(1);
    expect(MANOR_TASKS).toHaveLength(12);
  });

  it("records a friend visit without creating unrelated revisions", () => {
    const now = 2_000;
    const visitor = createManorFarm(now, "visitor", { enableStarterTasks: true });
    visitor.nextTaskId = 9;

    const completed = applyManorFriendVisit(visitor, now + 1);
    expect(completed.changed).toBe(true);
    expect(completed.visitor).toMatchObject({ nextTaskId: 10, revision: 1, coins: 570 });

    const ignored = applyManorFriendVisit(completed.visitor, now + 2);
    expect(ignored.changed).toBe(false);
    expect(ignored.visitor.revision).toBe(1);
  });

  it("rewards the visitor for care while leaving the owner reward unchanged", () => {
    const now = 10_000;
    const visitor = createManorFarm(now, "care-visitor", { enableStarterTasks: true });
    visitor.nextTaskId = 10;
    let owner = applyManorAction(
      createManorFarm(now, "care-owner"),
      { type: "plant", plotId: 1, cropId: "radish" },
      now
    );
    const plot = owner.plots[0]!;
    plot.dryAt = now + 1;
    delete plot.wateredAt;

    const result = applyManorFriendFarmAction(
      visitor,
      owner,
      "visitor-id",
      { type: "water", plotId: 1 },
      now + 2
    );
    owner = result.owner;
    expect(result.visitor).toMatchObject({ nextTaskId: 11, coins: 622, experience: 102 });
    expect(owner).toMatchObject({ coins: 120, experience: 2 });
    expect(owner.plots[0]?.wateredAt).toBe(now + 2);
  });

  it("packages original bouquets and moves them between accounts atomically", () => {
    const now = 15_000;
    const visitor = createManorFarm(now, "flower-sender");
    const owner = createManorFarm(now, "flower-owner");
    const lily = MANOR_CROPS.find((crop) => crop.sourceId === 103);
    const daisy = MANOR_CROPS.find((crop) => crop.sourceId === 105);
    if (!lily || !daisy) throw new Error("flower crops missing");
    visitor.produce[lily.id] = 10;
    visitor.produce[daisy.id] = 50;

    expect(toManorFlowerCatalog(visitor).find((flower) => flower.id === 2)?.canSend).toBe(true);
    const result = applyManorFriendFarmAction(
      visitor,
      owner,
      "sender-id",
      { type: "send-flower", flowerId: 2, message: "聚会愉快" },
      now + 1,
      {},
      "送花人"
    );

    expect(result.visitor.produce[lily.id]).toBe(0);
    expect(result.visitor.produce[daisy.id]).toBe(0);
    expect(result.owner.receivedFlowers).toEqual([{
      id: 1,
      flowerId: 2,
      senderUserId: "sender-id",
      senderDisplayName: "送花人",
      message: "聚会愉快",
      createdAt: now + 1
    }]);
    expect(result.owner.nextReceivedFlowerId).toBe(2);
    expect(toManorFlowerCatalog(result.visitor).find((flower) => flower.id === 2)?.canSend).toBe(false);
    expect(() => applyManorFriendFarmAction(
      result.visitor,
      result.owner,
      "sender-id",
      { type: "send-flower", flowerId: 2, message: "" },
      now + 2
    )).toThrow("天香百合不足");
  });

  it("uses original crop steal odds, minimum output and one steal per player per season", () => {
    const now = 20_000;
    const visitor = createManorFarm(now, "crop-thief", { enableStarterTasks: true });
    visitor.nextTaskId = 11;
    let owner = applyManorAction(
      createManorFarm(now, "crop-owner"),
      { type: "plant", plotId: 1, cropId: "radish" },
      now,
      { timeScale: 3_600 }
    );
    const readyAt = owner.plots[0]?.readyAt;
    if (!readyAt) throw new Error("readyAt missing");
    owner.randomState = 1;

    const result = applyManorFriendFarmAction(
      visitor,
      owner,
      "visitor-id",
      { type: "steal-crop", plotId: 1 },
      readyAt,
      { timeScale: 3_600 }
    );
    const stolen = result.owner.plots[0]?.stolenYield ?? 0;
    expect(stolen).toBeGreaterThanOrEqual(1);
    expect(stolen).toBeLessThanOrEqual(5);
    expect(result.visitor.produce.radish).toBe(stolen);
    expect(result.visitor).toMatchObject({ nextTaskId: 12, coins: 670, experience: 100 });
    expect(() =>
      applyManorFriendFarmAction(
        result.visitor,
        result.owner,
        "visitor-id",
        { type: "steal-crop", plotId: 1 },
        readyAt,
        { timeScale: 3_600 }
      )
    ).toThrow("已经偷过");
  });

  it("supports friend production help and one byproduct steal per production round", () => {
    const now = 30_000;
    const visitor = createManorFarm(now, "pasture-visitor", { enableStarterTasks: true });
    visitor.nextTaskId = 10;
    const owner = createManorFarm(now, "pasture-owner");

    const helped = applyManorFriendPastureAction(
      visitor,
      owner,
      "visitor-id",
      { type: "help-production", animalSerial: 2 },
      now + 1
    );
    expect(helped.visitor.pasture.experience).toBe(2);
    expect(helped.owner.pasture.animals[1]?.pendingProduct).toBe(12);

    const stolen = applyManorFriendPastureAction(
      helped.visitor,
      helped.owner,
      "visitor-id",
      { type: "steal-product", animalSerial: 2 },
      now + 2
    );
    expect(stolen.owner.pasture.animals[1]).toMatchObject({ pendingProduct: 11, stolenProduct: 1 });
    expect(stolen.visitor.pasture.byproducts[1002]).toBe(1);
    expect(stolen.visitor.nextTaskId).toBe(12);
    expect(() =>
      applyManorFriendPastureAction(
        stolen.visitor,
        stolen.owner,
        "visitor-id",
        { type: "steal-product", animalSerial: 2 },
        now + 3
      )
    ).toThrow("已经偷过");
  });

  it("migrates v8 farm and v1 pasture records without replaying tasks", () => {
    const legacy = JSON.parse(JSON.stringify(createManorFarm(40_000, "legacy-social")));
    legacy.schemaVersion = 8;
    delete legacy.nextTaskId;
    legacy.pasture.schemaVersion = 1;
    for (const animal of legacy.pasture.animals) {
      delete animal.productThiefUserIds;
      delete animal.stolenProduct;
    }

    expect(migrateManorFarm(legacy)).toMatchObject({
      schemaVersion: 12,
      nextTaskId: 12,
      pasture: { schemaVersion: 3 }
    });
  });

  it("lets a fed watchdog catch thieves without creating coins", () => {
    const now = 50_000;
    const visitor = createManorFarm(now, "caught-visitor");
    let owner = applyManorAction(
      createManorFarm(now, "dog-owner"),
      { type: "plant", plotId: 1, cropId: "radish" },
      now,
      { timeScale: 3_600 }
    );
    const readyAt = owner.plots[0]?.readyAt;
    if (!readyAt) throw new Error("readyAt missing");
    owner.ownedDogIds = [1];
    owner.activeDogId = 1;
    owner.dogFedUntil = readyAt + 1;
    owner.randomState = 1;
    const coinsBefore = visitor.coins + owner.coins;

    const result = applyManorFriendFarmAction(
      visitor,
      owner,
      "caught-visitor-id",
      { type: "steal-crop", plotId: 1 },
      readyAt,
      { timeScale: 3_600 },
      "小偷"
    );

    expect(result.message).toContain("被狗发现");
    expect(result.visitor.coins + result.owner.coins).toBe(coinsBefore);
    expect(result.visitor.produce.radish).toBe(0);
    expect(result.owner.plots[0]?.thiefUserIds).toContain("caught-visitor-id");
    expect(result.owner.activities[0]).toMatchObject({ kind: "dog", actorName: "小偷" });
  });

  it("limits farm pranks per visitor day and records the owner's activity", () => {
    const now = 60_000;
    const visitor = createManorFarm(now, "prank-visitor");
    visitor.daily.farmPranksUsed = 49;
    let owner = createManorFarm(now, "prank-owner");
    owner = applyManorAction(owner, { type: "plant", plotId: 1, cropId: "radish" }, now);
    owner = applyManorAction(owner, { type: "plant", plotId: 2, cropId: "radish" }, now);

    const result = applyManorFriendFarmAction(
      visitor,
      owner,
      "prank-visitor-id",
      { type: "add-weed", plotId: 1 },
      now + 1,
      {},
      "好友"
    );
    expect(result.visitor.daily.farmPranksUsed).toBe(50);
    expect(result.owner.plots[0]?.weedLevel).toBe(1);
    expect(result.owner.activities[0]).toMatchObject({ kind: "prank", actorName: "好友" });
    expect(() =>
      applyManorFriendFarmAction(
        result.visitor,
        result.owner,
        "prank-visitor-id",
        { type: "add-pest", plotId: 2 },
        now + 2
      )
    ).toThrow("50 次");
  });

  it("supports pasture mosquitoes, cleanup and special carrot feeding", () => {
    const now = 70_000;
    let visitor = createManorFarm(now, "pasture-prank-visitor");
    const owner = createManorFarm(now, "pasture-prank-owner");
    visitor.produce.carrot = 1;

    const released = applyManorFriendPastureAction(
      visitor,
      owner,
      "visitor-id",
      { type: "release-mosquito", quantity: 2 },
      now + 1
    );
    expect(released.owner.pasture.mosquitoSources).toEqual(["visitor-id", "visitor-id"]);
    expect(() =>
      applyManorFriendPastureAction(
        released.visitor,
        released.owner,
        "visitor-id",
        { type: "clean-mosquito" },
        now + 2
      )
    ).toThrow("没有可以帮忙清理");

    const feedOwner = released.owner;
    feedOwner.pasture.animals[1]!.growthSeconds = 0;
    const fed = applyManorFriendPastureAction(
      released.visitor,
      feedOwner,
      "visitor-id",
      { type: "feed-carrot", animalSerial: 2 },
      now + 3
    );
    expect(fed.visitor.produce.carrot).toBe(0);
    expect(fed.owner.pasture.animals[1]?.growthSeconds).toBeCloseTo(300, 2);
    expect(fed.owner.daily.specialFeedsReceived).toBe(1);
  });
});
