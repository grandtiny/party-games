import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";
import {
  MANOR_V7_DAILY_SIGN_IN_REWARDS,
  manorV7Animal,
  manorV7Crop,
  manorV7DayKey,
  manorV7ExperienceForLevel,
  manorV7Fish,
  type ManorV7State
} from "@party-games/manor-v7";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { stableFlashUserId } from "../src/manor-v7-flash-adapter.js";

describe("QQ Farm V7 account persistence", () => {
  it("reports unsupported Flash protocols once without request or account data", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-protocol-monitor-test-"));
    const events: Array<{ area: string; module: string; action: string | null }> = [];
    const instance = await createApp({
      databasePath: join(directory, "test.sqlite"),
      logger: false,
      manorUnsupportedProtocolHandler: (event) => events.push(event)
    });
    try {
      const owner = await bootstrapOwner(instance.app);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await instance.app.inject({
          method: "POST",
          url: "/api/manor/flash/farm?mod=task&act=not-supported%3Ftoken%3Dsecret",
          headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
          payload: "password=must-not-be-logged"
        });
        expect(response.json()).toMatchObject({ code: 0 });
      }
      const pasture = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_future_feature",
        headers: { cookie: owner.cookie }
      });
      expect(pasture.json()).toMatchObject({ code: 0 });
      expect(events).toEqual([
        { area: "farm", module: "task", action: "invalid" },
        { area: "pasture", module: "cgi_future_feature", action: null }
      ]);
      expect(JSON.stringify(events)).not.toContain("secret");
      expect(JSON.stringify(events)).not.toContain("password");
      expect(JSON.stringify(events)).not.toContain(owner.userId);
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("serves origin-bound Flash configuration and the original module URL alias", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-static-test-"));
    const webDistPath = join(directory, "web");
    const configPath = join(webDistPath, "assets", "manor", "v7-swf", "config");
    const modulePath = join(webDistPath, "assets", "manor", "v7-swf", "module");
    mkdirSync(configPath, { recursive: true });
    mkdirSync(modulePath, { recursive: true });
    writeFileSync(join(webDistPath, "index.html"), "<!doctype html><title>test</title>");
    const wasm = Buffer.from("precompressed-ruffle-wasm");
    const compressedWasm = brotliCompressSync(wasm);
    writeFileSync(join(webDistPath, "ruffle.wasm"), wasm);
    writeFileSync(join(webDistPath, "ruffle.wasm.br"), compressedWasm);
    writeFileSync(
      join(configPath, "load_main_v_20120209.xml"),
      '<data module="__MANOR_ORIGIN__/module/test.swf" api="__MANOR_ORIGIN__/api/manor/flash/farm?" />'
    );
    writeFileSync(join(modulePath, "test.swf"), "swf-test");

    const instance = await createApp({
      databasePath: join(directory, "test.sqlite"),
      webDistPath,
      logger: false
    });
    try {
      const config = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/config/load_main_v_20120209.xml",
        headers: { host: "127.0.0.1:18081" }
      });
      expect(config.statusCode, config.body).toBe(200);
      expect(config.headers["content-type"]).toContain("application/xml");
      expect(config.body).toContain('module="http://127.0.0.1:18081/module/test.swf"');
      expect(config.body).toContain('api="http://127.0.0.1:18081/api/manor/flash/farm?"');
      expect(config.body).not.toContain("__MANOR_ORIGIN__");

      const module = await instance.app.inject({ method: "GET", url: "/module/test.swf" });
      expect(module.statusCode, module.body).toBe(200);
      expect(module.body).toBe("swf-test");

      const precompressed = await instance.app.inject({
        method: "GET",
        url: "/ruffle.wasm",
        headers: { "accept-encoding": "br" }
      });
      expect(precompressed.statusCode, precompressed.body).toBe(200);
      expect(precompressed.headers["content-encoding"]).toBe("br");
      expect(precompressed.headers.vary).toContain("Accept-Encoding");
      expect(precompressed.rawPayload).toEqual(compressedWasm);

      const uncompressed = await instance.app.inject({ method: "GET", url: "/ruffle.wasm" });
      expect(uncompressed.statusCode, uncompressed.body).toBe(200);
      expect(uncompressed.headers["content-encoding"]).toBeUndefined();
      expect(uncompressed.rawPayload).toEqual(wasm);
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("serves the authenticated Flash bootstrap and form-encoded farm actions", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-flash-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const unauthorized = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?qzonemod=user&act=run"
      });
      expect(unauthorized.statusCode).toBe(401);

      const owner = await bootstrapOwner(instance.app);
      const bootstrap = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?qzonemod=user&act=run",
        headers: { cookie: owner.cookie }
      });
      expect(bootstrap.statusCode, bootstrap.body).toBe(200);
      expect(bootstrap.json()).toMatchObject({
        exp: 0,
        user: {
          userName: "庄园主人",
          money: 0,
          pf: 1,
          yellowlevel: 7,
          yellowstatus: 2
        },
        weather: { weatherId: 1 }
      });
      expect(bootstrap.json().farmlandStatus).toHaveLength(6);
      expect(bootstrap.json().farmlandStatus[1]).toMatchObject({ a: 1, f: 1 });

      const lockedLandUpgrade = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_upgrade",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(lockedLandUpgrade.statusCode, lockedLandUpgrade.body).toBe(200);
      expect(lockedLandUpgrade.json()).toMatchObject({
        code: 1,
        ecode: -30123,
        level: 28,
        money: 200_000,
        place: 4
      });
      expect(lockedLandUpgrade.json().direction).toContain("28 级");

      const decorations = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=item&act=getUserItems",
        headers: { cookie: owner.cookie }
      });
      expect(decorations.statusCode, decorations.body).toBe(200);
      expect(decorations.json()).toMatchObject({ code: 1, direction: "", ecode: 0 });
      expect(decorations.json().current).toEqual(expect.arrayContaining([
        expect.objectContaining({ itemId: 1, itemName: "田园风光", itemType: 1, status: 1 }),
        expect.objectContaining({ itemId: 2, itemName: "茅草屋", itemType: 2, status: 1 }),
        expect.objectContaining({ itemId: 3, itemName: "木桩栅栏", itemType: 3, status: 1 }),
        expect.objectContaining({ itemId: 4, itemName: "茅草狗屋", itemType: 4, status: 1 })
      ]));

      const shop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=item&act=shop",
        headers: { cookie: owner.cookie }
      });
      expect(shop.statusCode, shop.body).toBe(200);
      expect(shop.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ itemId: expect.any(Number), itemName: expect.any(String), itemType: expect.any(Number) })
      ]));

      const seedShop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=usertool&act=getSeedInfo",
        headers: { cookie: owner.cookie }
      });
      expect(seedShop.statusCode, seedShop.body).toBe(200);
      expect(seedShop.json()).toHaveLength(317);
      expect(seedShop.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ cId: 1, cName: "草莓", price: 605, sale: 27 }),
        expect.objectContaining({ cId: 450, cName: "火舞草", price: 210, sale: 15 }),
        expect.objectContaining({ cId: 460, cName: "园艺熊猫" }),
        expect.objectContaining({ cId: 601, cName: "园艺海星" })
      ]));

      const produceInventory = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=cgi_farm_getusercrop",
        headers: { cookie: owner.cookie }
      });
      expect(produceInventory.statusCode, produceInventory.body).toBe(200);
      expect(produceInventory.json()).toMatchObject({
        allFlower: expect.arrayContaining([
          expect.objectContaining({ fId: 1, fName: "最爱纯真", need: expect.any(Array) }),
          expect.objectContaining({ fId: 14, fName: "真爱久久", need: expect.any(Array) })
        ]),
        crop: [],
        flowerPath: "module/ui/flower"
      });
      expect(produceInventory.json().allFlower).toHaveLength(14);

      const active = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=item&act=activeItem",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "id=1"
      });
      expect(active.statusCode, active.body).toBe(200);
      expect(active.json()).toEqual({ code: 1, id: 1 });

      const selectedBoard = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=item&act=activeItem",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "id=90020&type=1"
      });
      expect(selectedBoard.statusCode, selectedBoard.body).toBe(200);
      expect(selectedBoard.json()).toEqual({ code: 1, id: 90020 });

      const qshowProfile = await instance.app.inject({
        method: "POST",
        url: "/mync.php?mod=user&act=qqshow",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "param=1"
      });
      expect(qshowProfile.statusCode, qshowProfile.body).toBe(200);
      expect(qshowProfile.json()).toMatchObject({ code: "0", red: 1, style: "1", showtype: "0", sex: "M" });

      const selectedAvatar = await instance.app.inject({
        method: "POST",
        url: "/mync.php?mod=item&act=activeitem",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "mod=qqshow&act=activeItem&id=515000"
      });
      expect(selectedAvatar.statusCode, selectedAvatar.body).toBe(200);
      expect(selectedAvatar.json()).toEqual({ code: "1", id: 515000 });

      const decoratedFarm = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?qzonemod=user&act=run",
        headers: { cookie: owner.cookie }
      });
      expect(decoratedFarm.statusCode, decoratedFarm.body).toBe(200);
      expect(decoratedFarm.json()).toMatchObject({
        items: { 1: { itemId: 1 }, 2: { itemId: 2 }, 3: { itemId: 3 }, 4: { itemId: 4 }, 9: { itemId: 90020 }, 10: { itemId: 515000 } }
      });

      const clearedBoard = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=item&act=deactiveItem",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "id=90020&type=1"
      });
      expect(clearedBoard.json()).toEqual({ code: 1, id: 90020 });

      const clearedAvatar = await instance.app.inject({
        method: "POST",
        url: "/mync.php?mod=item&act=deactiveItem",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "mod=qqshow&act=deactiveItem&id=0"
      });
      expect(clearedAvatar.json()).toEqual({ code: "1", id: 0 });
      expect(instance.repository.getManorV7State(owner.userId)?.farm).toMatchObject({
        selectedBoardId: null,
        selectedAvatarId: null
      });

      const cared = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=farmlandstatus&act=clearweed",
        headers: {
          cookie: owner.cookie,
          "content-type": "application/x-www-form-urlencoded"
        },
        payload: "ownerId=0&place=1"
      });
      expect(cared.statusCode, cared.body).toBe(200);
      expect(cared.json()).toEqual([
        expect.objectContaining({ code: 1, farmlandIndex: 1, weed: 0 })
      ]);
      const state = await getManor(instance.app, owner.cookie);
      expect(state.farm.lands[1]).toMatchObject({ weeds: false });

      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Farm V7 state missing");
      const funded: ManorV7State = structuredClone(current);
      funded.coins = 1_000_000;
      funded.farmExperience = manorV7ExperienceForLevel(40);
      funded.revision += 1;
      funded.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, funded);

      const reclaimCost = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=user&act=reclaimPay",
        headers: { cookie: owner.cookie }
      });
      expect(reclaimCost.statusCode, reclaimCost.body).toBe(200);
      expect(reclaimCost.json()).toMatchObject({ code: 1, ecode: 0, level: 5, money: 10_000 });
      const beforeReclaim = instance.repository.getManorV7State(owner.userId);
      if (!beforeReclaim) throw new Error("Farm V7 state missing before reclaim");
      const reclaim = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=user&act=reclaim",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(reclaim.statusCode, reclaim.body).toBe(200);
      expect(reclaim.json()).toMatchObject({ code: 1, ecode: 0, money: -10_000, place: 7 });
      const afterReclaim = instance.repository.getManorV7State(owner.userId);
      expect(afterReclaim).toMatchObject({ coins: 990_000, revision: beforeReclaim.revision + 1 });
      expect(afterReclaim?.farm.lands[6]).toMatchObject({ id: 7, unlocked: true });

      const redCondition = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_upgrade",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(redCondition.statusCode, redCondition.body).toBe(200);
      expect(redCondition.json()).toMatchObject({ code: 1, ecode: 0, level: 28, money: 200_000, place: 4 });

      const redUpgrade = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_upgrade",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "confirm=1"
      });
      expect(redUpgrade.statusCode, redUpgrade.body).toBe(200);
      expect(redUpgrade.json()).toMatchObject({ code: 1, ecode: 0, money: -200_000, place: 4, red: true });

      const blackCondition = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_upgrade_black",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "op=0"
      });
      expect(blackCondition.statusCode, blackCondition.body).toBe(200);
      expect(blackCondition.json()).toMatchObject({ code: 1, ecode: 0, level: 40, money: 500_000, place: 4 });

      const blackUpgrade = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_upgrade_black",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "op=1"
      });
      expect(blackUpgrade.statusCode, blackUpgrade.body).toBe(200);
      expect(blackUpgrade.json()).toMatchObject({ code: 1, ecode: 0, money: -500_000, place: 4, black: true });

      const nextRedCondition = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_upgrade",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(nextRedCondition.statusCode, nextRedCondition.body).toBe(200);
      expect(nextRedCondition.json()).toMatchObject({ code: 1, ecode: 0, level: 29, money: 220_000, place: 5 });

      const nextRedUpgrade = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_upgrade",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "confirm=1"
      });
      expect(nextRedUpgrade.statusCode, nextRedUpgrade.body).toBe(200);
      expect(nextRedUpgrade.json()).toMatchObject({ code: 1, ecode: 0, money: -220_000, place: 5, red: true });
      const upgradedState = await getManor(instance.app, owner.cookie);
      expect(upgradedState.coins).toBe(70_000);
      expect(upgradedState.farm.lands[4]).toMatchObject({ tier: "black" });
      expect(upgradedState.farm.lands[5]).toMatchObject({ tier: "red" });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("closes the original Flash fish pond unlock, buy, plant, harvest and sale loop", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-fish-flash-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Fish pond V7 state missing");
      const funded: ManorV7State = structuredClone(current);
      funded.coins = 20_000;
      funded.farm.fishPool.seedInventory = [{ sourceId: 16, quantity: 7 }];
      funded.revision += 1;
      funded.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, funded);

      const shop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=cgi_fish_list",
        headers: { cookie: owner.cookie }
      });
      expect(shop.statusCode, shop.body).toBe(200);
      expect(shop.json()).toHaveLength(12);
      expect((shop.json() as Array<{ fid: number }>).some((fish) => fish.fid === 15)).toBe(false);
      expect(shop.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ fid: 2, lock: 2, type: 23 }),
        expect.objectContaining({ fid: 16, lock: 1, type: 23 })
      ]));

      const unlocked = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_fish_unlock",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "fid=2"
      });
      expect(unlocked.statusCode, unlocked.body).toBe(200);
      expect(unlocked.json()).toMatchObject({ code: 1, fid: 2, money: -10_000 });

      const bought = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_fish_buy",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "fid=2&num=1"
      });
      expect(bought.statusCode, bought.body).toBe(200);
      expect(bought.json()).toMatchObject({ cId: 2, code: 1, direction: "", money: -650, name: "小丑鱼", num: 1 });
      expect(instance.repository.getManorV7State(owner.userId)?.farm.fishPool.seedInventory).toEqual(
        expect.arrayContaining([
          { sourceId: 2, quantity: 1 },
          { sourceId: 16, quantity: 7 }
        ])
      );

      const fishBag = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=repertory&act=getUserSeed",
        headers: { cookie: owner.cookie }
      });
      expect(fishBag.statusCode, fishBag.body).toBe(200);
      expect(fishBag.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ amount: 1, cId: 2, cName: "小丑鱼", fId: 2, type: 23 }),
        expect.objectContaining({ amount: 7, cId: 16, cName: "假面鱼", fId: 16, type: 23 })
      ]));

      const planted = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_fish_plant",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "fid=2"
      });
      expect(planted.statusCode, planted.body).toBe(200);
      expect(planted.json()).toMatchObject({ code: 1, fid: 2, i: 1, l: 0, o: 0 });

      const pool = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=cgi_fish_index",
        headers: { cookie: owner.cookie }
      });
      expect(pool.statusCode, pool.body).toBe(200);
      expect(pool.json()).toMatchObject({ open: 1, fish: [expect.objectContaining({ fid: 2, i: 1 })] });

      const growing = instance.repository.getManorV7State(owner.userId);
      if (!growing) throw new Error("Fish pond state missing before maturity");
      const mature: ManorV7State = structuredClone(growing);
      mature.farm.fishPool.fish[0]!.growthSeconds = manorV7Fish(2).cycleSeconds.at(-1)!;
      mature.revision += 1;
      mature.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, growing.revision, mature);

      const harvested = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_fish_harvest",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "index=1"
      });
      expect(harvested.statusCode, harvested.body).toBe(200);
      expect(harvested.json()).toMatchObject({ code: 1, i: 1, o: 15 });

      const repertory = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=cgi_fish_user_rep",
        headers: { cookie: owner.cookie }
      });
      expect(repertory.statusCode, repertory.body).toBe(200);
      expect(repertory.json()).toEqual([expect.objectContaining({ fid: 2, num: 15, type: 23 })]);

      const sold = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_fish_sale",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "fIds=2&num=15&flag=single"
      });
      expect(sold.statusCode, sold.body).toBe(200);
      expect(sold.json()).toMatchObject({ code: 1, money: 1_350, name: "小丑鱼", number: 15 });
      const final = await getManor(instance.app, owner.cookie);
      expect(final).toMatchObject({ coins: 10_700, farm: { fishPool: { fish: [], produceInventory: [] } } });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns original action fields for immediate harvest updates and buys coin decorations through the SWF route", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-action-protocol-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Farm V7 state missing before action protocol test");
      const funded: ManorV7State = structuredClone(current);
      funded.coins = 100_000;
      funded.farm.lands[0]!.growthSeconds = manorV7Crop(funded.farm.lands[0]!.cropId!).growthSeconds;
      funded.revision += 1;
      funded.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, funded);

      const harvested = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=farmlandstatus&act=harvest",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "place=0"
      });
      expect(harvested.statusCode, harvested.body).toBe(200);
      expect(harvested.json()).toMatchObject({
        code: 1,
        farmlandIndex: 0,
        status: {
          action: [],
          bitmap: 0,
          cId: 6,
          cropStatus: expect.any(Number),
          harvestTimes: 1,
          health: 100,
          humidity: 1,
          output: 0,
          pId: 0,
          thief: {},
          updateTime: expect.any(Number)
        }
      });
      expect(harvested.json().status).not.toHaveProperty("a");

      const shop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=item&act=shop",
        headers: { cookie: owner.cookie }
      });
      const item = (shop.json() as Array<{ itemId: number; price: number; FBPrice: number }>).find(
        (candidate) => candidate.price > 0
      );
      expect(item).toBeDefined();
      expect(shop.json()).toEqual(expect.arrayContaining([expect.objectContaining({ price: 0, FBPrice: expect.any(Number) })]));

      const bought = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_farm_buyitem",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `itemId=${item!.itemId}&useFB=0`
      });
      expect(bought.statusCode, bought.body).toBe(200);
      expect(bought.json()).toMatchObject({ code: 1, FB: 0, itemId: item!.itemId, money: -item!.price, num: 1 });
      expect(instance.repository.getManorV7State(owner.userId)?.ownedDecorationIds).toContain(item!.itemId);
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("persists original crop locks and excludes locked fruit from the saleAll route", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-sale-all-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Farm V7 state missing before saleAll test");
      const stocked: ManorV7State = structuredClone(current);
      stocked.coins = 100;
      stocked.farm.produceInventory = [
        { sourceId: 1, quantity: 3 },
        { sourceId: 6, quantity: 2 }
      ];
      stocked.revision += 1;
      stocked.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, stocked);

      const locked = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_get_repertory",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "target=lock&cId=1"
      });
      expect(locked.statusCode, locked.body).toBe(200);
      expect(locked.json()).toMatchObject({
        code: 1,
        ecode: 0,
        post_data: { cId: "1", target: "lock" }
      });

      const inventory = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=cgi_farm_getusercrop",
        headers: { cookie: owner.cookie }
      });
      expect(inventory.statusCode, inventory.body).toBe(200);
      expect(inventory.json().crop).toEqual(expect.arrayContaining([
        expect.objectContaining({ cId: 1, isLock: 1, lock: 1 }),
        expect.objectContaining({ cId: 6, isLock: 0, lock: 0 })
      ]));

      const sold = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=repertory&act=saleAll",
        headers: { cookie: owner.cookie }
      });
      const revenue = manorV7Crop(6).salePrice * 2;
      expect(sold.statusCode, sold.body).toBe(200);
      expect(sold.json()).toEqual({ code: 1, direction: "", money: revenue });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        coins: 100 + revenue,
        farm: { produceInventory: [{ sourceId: 1, quantity: 3, locked: true }] }
      });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("sells every pasture product and harvested animal when the original client sends saleAll=1", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-pasture-sale-all-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Pasture V7 state missing before saleAll test");
      const stocked: ManorV7State = structuredClone(current);
      stocked.coins = 100;
      stocked.pasture.productInventory = [{ sourceId: 1002, quantity: 4 }];
      stocked.pasture.harvestedAnimalInventory = [{ sourceId: 1002, quantity: 2 }];
      stocked.revision += 1;
      stocked.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, stocked);

      const sold = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_sale_product",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "saleAll=1"
      });
      const animal = manorV7Animal(1002);
      const revenue = animal.byproductPrice * 4 + animal.productPrice * 2;
      expect(sold.statusCode, sold.body).toBe(200);
      expect(sold.json()).toMatchObject({ code: 1, money: revenue });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        coins: 100 + revenue,
        pasture: { productInventory: [], harvestedAnimalInventory: [] }
      });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("closes the original profile, notice, daily package and sign-in protocol loops", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-toolbar-flash-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);

      const profile = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=chat&act=getAllInfo",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "flag=16"
      });
      expect(profile.statusCode, profile.body).toBe(200);
      expect(profile.json()).toMatchObject({
        chat: [],
        code: 1,
        post_data: { flag: "16" },
        repertory: [],
        user: {
          FB: 0,
          homePage: "",
          money: 0,
          uLevel: 0,
          uName: "庄园主人"
        }
      });
      expect(profile.json().log).toEqual(expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("欢迎来到 QQ 农场"),
          msg: expect.stringContaining("欢迎来到 QQ 农场")
        })
      ]));

      const sentMessage = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=chat&act=sendChat",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "msg=%E6%B5%8B%E8%AF%95%E7%95%99%E8%A8%80&isReply=0"
      });
      expect(sentMessage.statusCode, sentMessage.body).toBe(200);
      expect(sentMessage.json()).toMatchObject({
        code: 1,
        chat: [expect.objectContaining({ fromName: "庄园主人", msg: "测试留言" })]
      });

      const persistedMessage = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=chat&act=getAllInfo",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "msg=1"
      });
      expect(persistedMessage.json()).toMatchObject({
        code: 1,
        chat: [expect.objectContaining({ msg: "测试留言" })],
        post_data: { msg: "1" }
      });

      const feeds = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=hydra_feeds_select",
        headers: { cookie: owner.cookie }
      });
      expect(feeds.statusCode, feeds.body).toBe(200);
      expect(feeds.json()).toMatchObject({
        data: expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("欢迎来到 QQ 农场") })]),
        ecode: 0
      });

      const systemMessages = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=sysmsg_select",
        headers: { cookie: owner.cookie }
      });
      expect(systemMessages.statusCode, systemMessages.body).toBe(200);
      expect(systemMessages.json()).toMatchObject({
        data: [expect.objectContaining({ words: expect.stringContaining("欢迎来到 QQ 农场") })],
        info: "succ",
        ret: 0
      });

      const farmCost = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_farm_exchange",
        headers: { cookie: owner.cookie }
      });
      expect(farmCost.statusCode, farmCost.body).toBe(200);
      expect(farmCost.json()).toMatchObject({ code: 1, cost: expect.any(Array) });

      const pastureCost = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=fcg_ws_get_costfeeds",
        headers: { cookie: owner.cookie }
      });
      expect(pastureCost.statusCode, pastureCost.body).toBe(200);
      expect(pastureCost.json()).toEqual({ code: 1, cost: [] });

      const notice = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=user&act=getNotice",
        headers: { cookie: owner.cookie }
      });
      expect(notice.statusCode, notice.body).toBe(200);
      expect(notice.json()).toMatchObject({ code: 1, have_new_feeds: false, have_new_sysmsg: false });
      expect(notice.json().content).toContain("本地 QQ 农牧场");

      const packageInfo = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=Feast&act=getPackageList",
        headers: { cookie: owner.cookie }
      });
      expect(packageInfo.statusCode, packageInfo.body).toBe(200);
      expect(packageInfo.json()).toMatchObject({
        code: 1,
        item: expect.arrayContaining([expect.objectContaining({ eNum: 300, eParam: 1, eType: "6" })]),
        title: "每日礼包"
      });

      const beforePackage = instance.repository.getManorV7State(owner.userId);
      if (!beforePackage) throw new Error("V7 state missing before daily package");
      const packageClaim = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=Feast&act=getPackage",
        headers: { cookie: owner.cookie }
      });
      expect(packageClaim.statusCode, packageClaim.body).toBe(200);
      expect(packageClaim.json()).toMatchObject({ code: 1, item: expect.arrayContaining([expect.objectContaining({ eNum: 300 })]) });
      const afterPackage = instance.repository.getManorV7State(owner.userId);
      expect(afterPackage).toMatchObject({ coins: 300, revision: beforePackage.revision + 1 });
      expect(afterPackage?.rewardClaims.dailyPackageDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const duplicatePackage = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=Feast&act=getPackage",
        headers: { cookie: owner.cookie }
      });
      expect(duplicatePackage.json()).toMatchObject({ code: 0, direction: expect.stringContaining("已经领取") });
      expect(instance.repository.getManorV7State(owner.userId)?.revision).toBe(afterPackage?.revision);

      const claimedPackageInfo = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=Feast&act=getPackageList",
        headers: { cookie: owner.cookie }
      });
      expect(claimedPackageInfo.json()).toMatchObject({
        claimed: true,
        code: 1,
        direction: expect.stringContaining("已经领取"),
        item: []
      });

      const claimedBootstrap = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=user&act=run",
        headers: { cookie: owner.cookie }
      });
      expect(claimedBootstrap.json()).toMatchObject({ d: 3 });

      const pastureClaimedBootstrap = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: owner.cookie }
      });
      expect(pastureClaimedBootstrap.statusCode, pastureClaimedBootstrap.body).toBe(200);
      expect(pastureClaimedBootstrap.json()).toMatchObject({ d: 0 });

      const pastureClaimedPackage = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_get_gifts",
        headers: { cookie: owner.cookie }
      });
      expect(pastureClaimedPackage.statusCode, pastureClaimedPackage.body).toBe(200);
      expect(pastureClaimedPackage.json()).toMatchObject({
        claimed: true,
        code: 1,
        direction: expect.stringContaining("已经领取"),
        item: []
      });

      const signInStatus = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_login_click",
        headers: { cookie: owner.cookie }
      });
      expect(signInStatus.statusCode, signInStatus.body).toBe(200);
      expect(signInStatus.json()).toMatchObject({ bonus: 0, code: 1, number: 0 });

      const beforeSignIn = instance.repository.getManorV7State(owner.userId);
      if (!beforeSignIn) throw new Error("V7 state missing before sign-in");
      const signIn = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_pasture_signin",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "flag=2&pid=0&yellow=0"
      });
      expect(signIn.statusCode, signIn.body).toBe(200);
      expect(signIn.json()).toMatchObject({ canNum: 1, code: 1, id: expect.any(Number), number: 1 });
      expect(MANOR_V7_DAILY_SIGN_IN_REWARDS.map((reward) => reward.id)).toContain(signIn.json().id);
      const afterSignIn = instance.repository.getManorV7State(owner.userId);
      expect(afterSignIn).toMatchObject({ revision: beforeSignIn.revision + 1 });
      expect(afterSignIn?.rewardClaims).toMatchObject({ signInRewardId: signIn.json().id });

      const completedStatus = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_farm_login_home",
        headers: { cookie: owner.cookie }
      });
      expect(completedStatus.json()).toMatchObject({ code: 1, number: 1 });

      const pastureSignIn = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_signin",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `flag=2&pid=${signIn.json().id}&yellow=1`
      });
      expect(pastureSignIn.statusCode, pastureSignIn.body).toBe(200);
      expect(pastureSignIn.json()).toMatchObject({ canNum: 0, code: 1, id: expect.any(Number), number: 2 });
      expect(pastureSignIn.json().id).not.toBe(signIn.json().id);

      const duplicateSignIn = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?qzonemod=cgi_pasture_signin",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "flag=2&pid=0&yellow=0"
      });
      expect(duplicateSignIn.json()).toMatchObject({ code: 0, direction: expect.stringContaining("次数已经用完") });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("claims the original pasture five-day sign-in reward into the shared animal package", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-streak-sign-in-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("V7 state missing before streak sign-in test");
      const now = Date.now();
      const prepared: ManorV7State = structuredClone(current);
      prepared.rewardClaims.signInDay = manorV7DayKey(now - 24 * 60 * 60 * 1_000);
      prepared.rewardClaims.signInStreak = 4;
      prepared.rewardClaims.signInStreakRewardDays = [3];
      prepared.pasture.hutchLevel = 2;
      prepared.pasture.toolInventory = [{ sourceId: 1, quantity: 1 }];
      prepared.revision += 1;
      prepared.updatedAt = now;
      instance.repository.updateManorV7State(owner.userId, current.revision, prepared);

      const panel = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_pasture_login_click",
        headers: { cookie: owner.cookie }
      });
      expect(panel.statusCode, panel.body).toBe(200);
      expect(panel.json()).toMatchObject({ bonus: 1, code: 1, days: 5, number: 0 });

      const reward = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_signin",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "flag=1&days=5"
      });
      expect(reward.statusCode, reward.body).toBe(200);
      expect(reward.json()).toMatchObject({ code: 1, ecode: 0, id: 16 });

      const animalPackage = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_package",
        headers: { cookie: owner.cookie }
      });
      expect(animalPackage.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ amount: 1, tId: 1047, tName: "丝光鸡", type: 9 }),
        expect.objectContaining({ amount: 1, tId: 1, tName: "普通罐头", type: 7 })
      ]));

      const raised = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_raise_cub",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "type=1047&number=1"
      });
      expect(raised.statusCode, raised.body).toBe(200);
      expect(raised.json()).toMatchObject({
        code: 1,
        ecode: 0,
        animal: [expect.objectContaining({ cId: 1047, status: 1 })]
      });
      const serial = raised.json().animal[0].serial;

      const accelerated = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_feedcan",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `serial=${serial}&tid=1`
      });
      expect(accelerated.statusCode, accelerated.body).toBe(200);
      expect(accelerated.json()).toMatchObject({
        code: 1,
        ecode: 0,
        serial,
        animal: expect.objectContaining({ cId: 1047, growTime: 10_800 })
      });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps original grass purchases separate between backpack and feeder", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-grass-routing-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Pasture V7 state missing before grass routing test");
      const funded: ManorV7State = structuredClone(current);
      funded.coins = 1_000;
      funded.farm.produceInventory = [];
      funded.pasture.grass = 21.75;
      funded.revision += 1;
      funded.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, funded);

      const grassShop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_food",
        headers: { cookie: owner.cookie }
      });
      expect(grassShop.statusCode, grassShop.body).toBe(200);
      expect(grassShop.json()).toEqual([
        expect.objectContaining({ price: 60, tId: 1, tName: "牧草" })
      ]);

      const boughtToBackpack = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_buy_food",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "tId=1&foodnum=3"
      });
      expect(boughtToBackpack.statusCode, boughtToBackpack.body).toBe(200);
      expect(boughtToBackpack.json()).toMatchObject({ code: 1, money: 90, num: 3, tId: 1 });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        coins: 910,
        farm: { produceInventory: [{ sourceId: 40, quantity: 3 }] },
        pasture: { grass: 21.75 }
      });

      const bootstrap = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: owner.cookie }
      });
      expect(bootstrap.statusCode, bootstrap.body).toBe(200);
      expect(bootstrap.json()).toMatchObject({ animalFood: 21 });

      const movedFromBackpack = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_feed_food",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "foodnum=2&type=0"
      });
      expect(movedFromBackpack.statusCode, movedFromBackpack.body).toBe(200);
      expect(movedFromBackpack.json()).toMatchObject({ added: 2, code: 1, money: 0, total: 23, type: 0 });

      const boughtToFeeder = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_feed_food",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "foodnum=1&type=1"
      });
      expect(boughtToFeeder.statusCode, boughtToFeeder.body).toBe(200);
      expect(boughtToFeeder.json()).toMatchObject({ added: 0, code: 1, money: 30, total: 24, type: 1 });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        coins: 880,
        farm: { produceInventory: [{ sourceId: 40, quantity: 1 }] }
      });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("buys and restores a pasture guard through the original protocols", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-guard-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Pasture V7 state missing before guard test");
      const funded: ManorV7State = structuredClone(current);
      funded.coins = 20_000;
      funded.revision += 1;
      funded.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, funded);

      const bought = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_buy_guard",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "id=1&type=106&number=1"
      });
      expect(bought.statusCode, bought.body).toBe(200);
      expect(bought.json()).toMatchObject({
        code: 1,
        ecode: 0,
        id: 1,
        money: -10_000,
        name: "猎人",
        post_data: { id: 1, number: 1, type: 106 },
        striketime: 7 * 24 * 60 * 60
      });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        coins: 10_000,
        pasture: { guards: [{ id: 1, active: true }] }
      });

      const bootstrap = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: owner.cookie }
      });
      expect(bootstrap.statusCode, bootstrap.body).toBe(200);
      expect(bootstrap.json()).toMatchObject({
        guard: { id: 1, name: "猎人", striketime: expect.any(Number) }
      });

      const guards = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_userguard",
        headers: { cookie: owner.cookie }
      });
      expect(guards.statusCode, guards.body).toBe(200);
      expect(guards.json()).toEqual([
        expect.objectContaining({ itemId: 1, itemName: "猎人", status: 1 })
      ]);
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("persists free VIP tools and decorations through the original gb_buy protocol", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-vip-buy-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);

      const verify = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=shop_verify",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "payitem=30002-2-%E9%AB%98%E9%80%9F%E5%8C%96%E8%82%A5"
      });
      expect(verify.statusCode, verify.body).toBe(200);
      expect(verify.json()).toEqual({ code: 1, open: "0" });

      const farmTool = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=gb_buy",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "payitem=30002-2-%E9%AB%98%E9%80%9F%E5%8C%96%E8%82%A5"
      });
      expect(farmTool.statusCode, farmTool.body).toBe(200);
      expect(farmTool.json()).toMatchObject({
        code: 0,
        msg: "success",
        post_data: { itemId: 2, number: 2, type: 3 }
      });

      const farmDecoration = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=gb_buy",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "payitem=60045-1-%E9%AD%94%E5%B9%BB%E4%B9%90%E5%9B%AD%E8%83%8C%E6%99%AF&itemId=45&exp=720"
      });
      expect(farmDecoration.statusCode, farmDecoration.body).toBe(200);
      expect(farmDecoration.json()).toMatchObject({ code: 0, post_data: { itemId: 45, exp: 720 } });

      for (const payitem of [
        "70001-2-%E6%99%AE%E9%80%9A%E7%BD%90%E5%A4%B4",
        "120040-1-%E8%BF%B7%E4%BD%A0%E6%B2%99%E6%BC%8F",
        "100007-1-%E9%BB%84%E9%87%91%E9%A3%9E%E5%88%80"
      ]) {
        const bought = await instance.app.inject({
          method: "POST",
          url: "/api/manor/flash/pasture?mod=gb_buy",
          headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
          payload: `payitem=${payitem}`
        });
        expect(bought.statusCode, bought.body).toBe(200);
        expect(bought.json()).toMatchObject({ code: 0, msg: "success" });
      }

      const pastureDecoration = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=gb_buy",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "payitem=60106-1-%E8%A5%BF%E9%83%A8%E6%98%A5%E8%89%B2&itemId=106&exp=180"
      });
      expect(pastureDecoration.statusCode, pastureDecoration.body).toBe(200);
      expect(pastureDecoration.json()).toMatchObject({ code: 0, post_data: { itemId: 106, exp: 180 } });

      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        coins: 0,
        farm: {
          toolInventory: [{ sourceId: 2, quantity: 2 }],
          selectedDecorationIds: expect.arrayContaining([45])
        },
        pasture: {
          toolInventory: [
            { sourceId: 1, quantity: 2 },
            { sourceId: 40, quantity: 1 }
          ],
          weaponInventory: [{ sourceId: 7, quantity: 1 }],
          selectedDecorationIds: [106]
        },
        ownedDecorationIds: expect.arrayContaining([45, 106])
      });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("charges the displayed catalog price when buying an animal and persists the balance", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-animal-price-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Pasture V7 state missing before animal price test");
      const funded: ManorV7State = structuredClone(current);
      funded.coins = 800;
      funded.pasture.animals = [];
      funded.pasture.nextAnimalSerial = 1;
      funded.revision += 1;
      funded.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, funded);

      const shop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_animals",
        headers: { cookie: owner.cookie }
      });
      expect(shop.statusCode, shop.body).toBe(200);
      expect(shop.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ cId: 1001, cName: "鸡", price: 700 })
      ]));

      const bought = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_buy_animal",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "cId=1001&number=1"
      });
      expect(bought.statusCode, bought.body).toBe(200);
      expect(bought.json()).toMatchObject({
        animal: [expect.objectContaining({ cId: 1001, serial: 1 })],
        code: 0,
        money: 700,
        num: 1
      });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        coins: 100,
        pasture: { animals: [expect.objectContaining({ animalId: 1001, serial: 1 })] }
      });

      const restored = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: owner.cookie }
      });
      expect(restored.statusCode, restored.body).toBe(200);
      expect(restored.json()).toMatchObject({
        animal: [expect.objectContaining({ cId: 1001, serial: 1 })],
        user: { money: 100 }
      });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("serves the authenticated original pasture bootstrap and persistent actions", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-pasture-flash-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const unauthorized = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter"
      });
      expect(unauthorized.statusCode).toBe(401);

      const owner = await bootstrapOwner(instance.app);
      const bootstrap = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: owner.cookie }
      });
      expect(bootstrap.statusCode, bootstrap.body).toBe(200);
      expect(bootstrap.json()).toMatchObject({
        animalFood: 20,
        items: {
          1: { id: 105, lv: 1 },
          2: { id: 102, lv: 1 },
          3: { id: 103, lv: 0 }
        },
        research: {
          den: { endtime: 0, animalid: 0 },
          shed: { endtime: 0, animalid: 0 }
        },
        task: { taskFlag: 1, taskId: 0 },
        user: { userName: "庄园主人", money: 0, yellowlevel: 7, yellowstatus: 2 },
        weather: { weatherId: 1 }
      });
      expect(bootstrap.json().animal).toHaveLength(2);
      expect(bootstrap.json().animal).not.toContain(null);
      expect(bootstrap.json().animal[0]).toMatchObject({ cId: 1002, serial: 1, status: 6 });
      expect(bootstrap.json().animal[1]).toMatchObject({
        cId: 1002,
        growTimeNext: 12_993,
        serial: 2,
        status: 3,
        statusNext: 6
      });

      const profile = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_get_user_info",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "profile=1"
      });
      expect(profile.statusCode, profile.body).toBe(200);
      expect(profile.json()).toMatchObject({
        code: 1,
        log: expect.any(Array),
        post_data: { profile: "1" },
        user: { money: 0, uExp: 0, uLevel: 0, uName: "庄园主人" }
      });

      const messages = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=chat&act=getAllInfo",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "msg=1"
      });
      expect(messages.statusCode, messages.body).toBe(200);
      expect(messages.json()).toMatchObject({ chat: [], code: 1, post_data: { msg: "1" } });

      const production = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_post_product",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "serial=2"
      });
      expect(production.statusCode, production.body).toBe(200);
      expect(production.json(), production.body).toMatchObject({
        animal: { cId: 1002, growTimeNext: 15, serial: 2, status: 4, statusNext: 5 },
        code: 0,
        ecode: 0,
        serial: 2
      });

      const refreshedProduction = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: owner.cookie }
      });
      expect(refreshedProduction.statusCode, refreshedProduction.body).toBe(200);
      expect(refreshedProduction.json().animal).toHaveLength(2);
      expect(refreshedProduction.json().animal[1]).toMatchObject({
        cId: 1002,
        serial: 2,
        status: 4,
        statusNext: 5
      });

      const activeProduction = instance.repository.getManorV7State(owner.userId);
      if (!activeProduction) throw new Error("Pasture V7 state missing during production");
      const readyForNextProduction: ManorV7State = structuredClone(activeProduction);
      Object.assign(readyForNextProduction.pasture.animals[1]!, {
        pendingProduct: 0,
        productionActive: false,
        productionCount: 1,
        productionProgressSeconds: 0
      });
      readyForNextProduction.revision += 1;
      readyForNextProduction.updatedAt = Date.now();
      instance.repository.updateManorV7State(
        owner.userId,
        activeProduction.revision,
        readyForNextProduction
      );
      const refreshedReadyForNextProduction = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: owner.cookie }
      });
      expect(refreshedReadyForNextProduction.statusCode, refreshedReadyForNextProduction.body).toBe(200);
      expect(refreshedReadyForNextProduction.json().animal[1]).toMatchObject({
        cId: 1002,
        growTimeNext: 12_993,
        serial: 2,
        status: 3,
        statusNext: 6
      });

      const friendFlags = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_get_Exp",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "uin=1"
      });
      expect(friendFlags.statusCode, friendFlags.body).toBe(200);
      expect(friendFlags.json()).toMatchObject({ ecode: 0, msg: "success", result: 0, userFlag: {} });

      const signInPanel = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_pasture_login_click",
        headers: { cookie: owner.cookie }
      });
      expect(signInPanel.statusCode, signInPanel.body).toBe(200);
      expect(signInPanel.json()).toMatchObject({ bonus: 0, code: 1, ecode: 0, is_playing: 1, number: 0 });

      const shop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_animals",
        headers: { cookie: owner.cookie }
      });
      expect(shop.statusCode, shop.body).toBe(200);
      expect(shop.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ cId: 1002, cName: "兔子", bName: "兔子崽", cType: 0, price: 1200 }),
        expect.objectContaining({ cId: 1040, cType: 4, expect: 7 }),
        expect.objectContaining({ cId: 1066, isvip: 1 })
      ]));
      const activityAnimalIds = new Set([1037, 1085, 1086, 1537, 1546, 1593]);
      expect((shop.json() as Array<{ cId: number }>).some((animal) => activityAnimalIds.has(animal.cId))).toBe(false);

      const toolShop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_toollist",
        headers: { cookie: owner.cookie }
      });
      expect(toolShop.statusCode, toolShop.body).toBe(200);
      const toolItems = toolShop.json() as Array<{ appid?: number; attacksucc?: number; type: number }>;
      expect(toolShop.json()).toEqual(expect.arrayContaining([expect.objectContaining({ price: 0, qdprice: 0 })]));
      expect(toolItems.some((item) => item.type !== 10 && item.appid === undefined)).toBe(true);
      expect(toolItems.some((item) => item.type === 10 && item.appid === 353 && item.attacksucc === 100)).toBe(true);

      const materials = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_farm_getusercrop",
        headers: { cookie: owner.cookie }
      });
      expect(materials.statusCode, materials.body).toBe(200);
      expect(materials.json()).toEqual([]);

      const crystals = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_farm_get_usercrystal",
        headers: { cookie: owner.cookie }
      });
      expect(crystals.statusCode, crystals.body).toBe(200);
      expect(crystals.json()).toEqual({ ecode: 0, info: [] });

      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Pasture V7 state missing");
      const funded: ManorV7State = structuredClone(current);
      funded.coins = 10_000;
      funded.farm.produceInventory = [{ sourceId: 40, quantity: 5 }];
      funded.pasture.animals[1]!.productionActive = false;
      funded.pasture.animals[1]!.productionProgressSeconds = 0;
      funded.pasture.animals[1]!.pendingProduct = manorV7Animal(1002).baseYield;
      funded.revision += 1;
      funded.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, funded);

      const pasturePackage = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_package",
        headers: { cookie: owner.cookie }
      });
      expect(pasturePackage.statusCode, pasturePackage.body).toBe(200);
      expect(pasturePackage.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ amount: 5, tId: 40, tName: "牧草", type: 4 })
      ]));

      const beforeInventoryFeed = instance.repository.getManorV7State(owner.userId);
      if (!beforeInventoryFeed) throw new Error("Pasture V7 state missing before inventory feed");
      const inventoryFed = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_feed_food",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "foodnum=3&type=0"
      });
      expect(inventoryFed.statusCode, inventoryFed.body).toBe(200);
      expect(inventoryFed.json(), inventoryFed.body).toMatchObject({ added: 3, code: 1, money: 0, total: 23, type: 0 });
      const afterInventoryFeed = instance.repository.getManorV7State(owner.userId);
      expect(afterInventoryFeed).toMatchObject({
        coins: 10_000,
        revision: beforeInventoryFeed.revision + 1,
        farm: { produceInventory: [{ sourceId: 40, quantity: 2 }] }
      });

      const beforePurchaseFeed = instance.repository.getManorV7State(owner.userId);
      if (!beforePurchaseFeed) throw new Error("Pasture V7 state missing before purchased feed");
      const purchasedFeed = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_feed_food",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "foodnum=1&type=1"
      });
      expect(purchasedFeed.statusCode, purchasedFeed.body).toBe(200);
      expect(purchasedFeed.json()).toMatchObject({ added: 0, code: 1, money: 30, total: 24, type: 1 });
      const afterPurchaseFeed = instance.repository.getManorV7State(owner.userId);
      expect(afterPurchaseFeed).toMatchObject({
        coins: 9_970,
        revision: beforePurchaseFeed.revision + 1,
        farm: { produceInventory: [{ sourceId: 40, quantity: 2 }] }
      });

      const harvested = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_harvest_product",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "harvesttype=1&type=1002"
      });
      expect(harvested.statusCode, harvested.body).toBe(200);
      expect(harvested.json()).toEqual([8, [], [[1002, 12]]]);

      const state = await getManor(instance.app, owner.cookie);
      expect(state).toMatchObject({ coins: 10_770, pasture: { grass: 24 } });
      expect(state.pasture.productInventory).toEqual(
        expect.arrayContaining([expect.objectContaining({ sourceId: 1002, quantity: 12 })])
      );

      const repertory = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_repertory?target=animal",
        headers: { cookie: owner.cookie }
      });
      expect(repertory.statusCode, repertory.body).toBe(200);
      expect(repertory.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ cId: 1002, cName: "兔子崽", amount: 12 })
      ]));

      const beforeAdultHarvest = instance.repository.getManorV7State(owner.userId);
      if (!beforeAdultHarvest) throw new Error("Pasture V7 state missing before adult harvest");
      const adultHarvest = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_harvest_product",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "harvesttype=2&serial=1&serialIndex=1"
      });
      expect(adultHarvest.statusCode, adultHarvest.body).toBe(200);
      expect(adultHarvest.json()).toEqual([28, [1], []]);
      const afterAdultHarvest = instance.repository.getManorV7State(owner.userId);
      expect(afterAdultHarvest).toMatchObject({
        coins: beforeAdultHarvest.coins,
        revision: beforeAdultHarvest.revision + 1,
        pasture: { harvestedAnimalInventory: [{ sourceId: 1002, quantity: 1 }] }
      });

      const adultRepertory = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_repertory?target=animal",
        headers: { cookie: owner.cookie }
      });
      expect(adultRepertory.statusCode, adultRepertory.body).toBe(200);
      expect(adultRepertory.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ amount: 1, cId: 11002, cName: "兔子", price: 1460, type: 3 })
      ]));

      const soldAdult = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_sale_product",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "cId=11002&num=1"
      });
      expect(soldAdult.statusCode, soldAdult.body).toBe(200);
      expect(soldAdult.json()).toMatchObject({ cId: 11002, money: 1460 });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        coins: 12_230,
        pasture: { harvestedAnimalInventory: [] }
      });

      const decorationShop = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_items",
        headers: { cookie: owner.cookie }
      });
      expect(decorationShop.statusCode, decorationShop.body).toBe(200);
      expect(decorationShop.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ itemId: 109, itemName: "qzone五周年套装", price: 1 })
      ]));

      const boughtDecoration = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_buy_item",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "itemId=109&skinBool=0&msgBool=0"
      });
      expect(boughtDecoration.statusCode, boughtDecoration.body).toBe(200);
      expect(boughtDecoration.json()).toMatchObject({ code: 1, money: -1, post_data: { itemId: 109 } });

      const decorationInventory = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_get_useritem",
        headers: { cookie: owner.cookie }
      });
      expect(decorationInventory.statusCode, decorationInventory.body).toBe(200);
      expect(decorationInventory.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ itemId: 109, status: 1 })
      ]));

      const decoratedBootstrap = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: owner.cookie }
      });
      expect(decoratedBootstrap.statusCode, decoratedBootstrap.body).toBe(200);
      expect(decoratedBootstrap.json()).toMatchObject({ items: { 1: { id: 109 } } });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses the platform account, schema 9 and an independent persistent V7 save", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-v7-test-"));
    const databasePath = join(directory, "test.sqlite");
    const first = await createApp({ databasePath, logger: false });
    let firstClosed = false;
    try {
      expect(first.repository.getSchemaVersion()).toBe(9);
      expect((await first.app.inject({ method: "GET", url: "/api/manor" })).statusCode).toBe(401);

      const setup = await first.app.inject({
        method: "POST",
        url: "/api/account/bootstrap",
        payload: {
          username: "farmer",
          displayName: "农场主",
          password: "farmer-password"
        }
      });
      expect(setup.statusCode, JSON.stringify(setup.json())).toBe(200);
      const cookie = sessionCookie(setup.headers["set-cookie"]);
      const initial = await first.app.inject({
        method: "GET",
        url: "/api/manor",
        headers: { cookie }
      });
      expect(initial.statusCode, JSON.stringify(initial.json())).toBe(200);
      expect(initial.json()).toMatchObject({
        version: "7.0 Beta1 Build 20120209.1000",
        owner: { displayName: "农场主" },
        coins: 0,
        farmLevel: 0,
        pastureLevel: 0,
        pasture: {
          grass: expect.any(Number),
          hutchLevel: 1,
          shedLevel: 0,
          hutchCapacity: 2,
          shedCapacity: 0
        }
      });
      expect(initial.json().farm.lands).toHaveLength(24);
      expect(initial.json().farm.lands.filter((land: { unlocked: boolean }) => land.unlocked)).toHaveLength(6);
      expect(initial.json().catalogs.crops).toHaveLength(405);
      expect(initial.json().catalogs.crops.filter((crop: { isHidden?: boolean }) => crop.isHidden)).toHaveLength(88);
      expect(initial.json().catalogs.animals).toHaveLength(167);
      expect(initial.json().catalogs.tools).toHaveLength(91);
      expect(initial.json().catalogs.decorations).toHaveLength(631);

      const cared = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "remove-weeds", landId: 2 }
      });
      expect(cared.statusCode, JSON.stringify(cared.json())).toBe(200);
      expect(cared.json().farm.lands[1]).toMatchObject({ id: 2, weeds: false });
      expect(first.repository.getManorV7State(String(setup.json().user.id))).toBeDefined();

      await first.app.close();
      firstClosed = true;
      const second = await createApp({ databasePath, logger: false });
      try {
        const restored = await second.app.inject({
          method: "GET",
          url: "/api/manor",
          headers: { cookie }
        });
        expect(restored.statusCode, JSON.stringify(restored.json())).toBe(200);
        expect(restored.json().farm.lands[1]).toMatchObject({ id: 2, weeds: false });
        expect(restored.json().activities).toEqual(
          expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("清除了第 2 块土地") })])
        );
      } finally {
        await second.app.close();
      }
    } finally {
      if (!firstClosed) await first.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("closes the original wild-animal adoption, friend release, attack and crystal protocols", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-wild-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      const visitor = await registerMember(instance.app, owner.cookie);
      await getManor(instance.app, owner.cookie);
      await getManor(instance.app, visitor.cookie);
      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("Wild test state missing");
      const funded: ManorV7State = structuredClone(current);
      funded.coins = 500_000;
      funded.revision += 1;
      funded.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, funded);

      const moral = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_farm_get_moralexp",
        headers: { cookie: owner.cookie }
      });
      expect(moral.json()).toEqual({ ecode: 0, moralexp: 0 });

      const initialSlots = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_farm_get_userbeast",
        headers: { cookie: owner.cookie }
      });
      expect(initialSlots.json()).toMatchObject({ ecode: 0, maxslotid: 0, beasts: { 0: null } });

      const adopted = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_adopt_beast",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "slotid=0&type=1"
      });
      expect(adopted.json()).toMatchObject({ ecode: 0, money: -10_000 });

      const opened = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_open_slot",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "slotid=1"
      });
      expect(opened.json()).toMatchObject({ ecode: 0, maxslotid: 1, money: -300_000 });

      const adoptedSecond = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_adopt_beast",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "slotid=1&type=1"
      });
      expect(adoptedSecond.json()).toMatchObject({ ecode: 0, money: -10_000 });

      const released = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_raise_beast",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `slotid=0&type=1&ownerId=${stableFlashUserId(visitor.userId)}&isfarm=0`
      });
      expect(released.json()).toMatchObject({
        ecode: 0,
        moralexp: 3,
        beast: { info: [expect.objectContaining({ type: 1, blood: 50, status: 2 })] }
      });

      const visitorBootstrap = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_enter",
        headers: { cookie: visitor.cookie }
      });
      expect(visitorBootstrap.json()).toMatchObject({
        beast: { info: [expect.objectContaining({ type: 1, blood: 50, status: 2 })] }
      });

      const visitorViewedByOwner = await instance.app.inject({
        method: "GET",
        url: `/api/manor/flash/pasture?mod=cgi_enter&uId=${stableFlashUserId(visitor.userId)}`,
        headers: { cookie: owner.cookie }
      });
      expect(visitorViewedByOwner.json()).toMatchObject({
        beast: {
          info: [expect.objectContaining({ type: 1, blood: 50, status: 2 })],
          return: [expect.objectContaining({ id: 1, type: 1, status: 1 })]
        }
      });

      const releasedToFarm = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_raise_beast",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `slotid=1&type=1&ownerId=${stableFlashUserId(visitor.userId)}&isfarm=1`
      });
      expect(releasedToFarm.json()).toMatchObject({
        ecode: 0,
        beast: { info: [expect.objectContaining({ type: 1, status: 2 })] }
      });

      const mixedAreaState = instance.repository.getManorV7State(visitor.userId);
      if (!mixedAreaState) throw new Error("Mixed-area wild state missing");
      const reversedMixedAreaState: ManorV7State = structuredClone(mixedAreaState);
      reversedMixedAreaState.pasture.wild.incomingAnimals.reverse();
      reversedMixedAreaState.pasture.weaponInventory = [{ sourceId: 7, quantity: 1 }];
      reversedMixedAreaState.revision += 1;
      reversedMixedAreaState.updatedAt = Date.now();
      instance.repository.updateManorV7State(visitor.userId, mixedAreaState.revision, reversedMixedAreaState);

      const attacked = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_attack_beast",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `index=0&slotid=0&attackType=Gun&flag=8&weapon=7&ownerId=${stableFlashUserId(visitor.userId)}&isfarm=0`
      });
      const attackBody = attacked.json();
      expect(attackBody).toMatchObject({ ecode: 0, result: 1, leftblood: 15, subblood: 35, addmoral: 1 });
      expect(attackBody.drop).toEqual([expect.objectContaining({ type: 9, id: 1, num: 1 })]);

      const picked = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_pickup_crystal",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `index=0&id=${attackBody.drop[0].id}&time=${attackBody.drop[0].time}&ownerId=${stableFlashUserId(visitor.userId)}&farm=0`
      });
      expect(picked.json()).toMatchObject({ ecode: 0, direction: expect.stringContaining("水晶") });
      const crystals = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_farm_get_usercrystal&type=9",
        headers: { cookie: visitor.cookie }
      });
      expect(crystals.json()).toMatchObject({
        ecode: 0,
        info: [expect.objectContaining({ cId: 1, cName: "蓝水晶", amount: 1, type: 9 })]
      });
      const soldCrystal = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_sell_crystal",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "id=1&num=1"
      });
      expect(soldCrystal.json()).toMatchObject({ code: 1, ecode: 0, money: 10 });
      const crystalsAfterSale = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_farm_get_usercrystal&type=9",
        headers: { cookie: visitor.cookie }
      });
      expect(crystalsAfterSale.json()).toEqual({ ecode: 0, info: [] });

      const releasedState = instance.repository.getManorV7State(owner.userId);
      if (!releasedState) throw new Error("Released wild state missing");
      const returned: ManorV7State = structuredClone(releasedState);
      returned.pasture.wild.slots[0]!.returnAt = Date.now() - 1;
      returned.updatedAt = Date.now() - 2;
      returned.revision += 1;
      instance.repository.updateManorV7State(owner.userId, releasedState.revision, returned);
      const returnedSlots = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_farm_get_userbeast",
        headers: { cookie: owner.cookie }
      });
      expect(returnedSlots.json()).toMatchObject({ beasts: { 0: expect.objectContaining({ status: 3 }) } });
      const reward = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_farm_reward_beast",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "slotid=0&type=1"
      });
      expect(reward.json()).toMatchObject({ ecode: 0, money: 500, drop: [expect.objectContaining({ type: 9, id: 1 })] });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("updates both accounts atomically for friend care and V7 stealing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-social-v7-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      expect((await instance.app.inject({ method: "GET", url: "/api/manor/social" })).statusCode).toBe(401);
      const owner = await bootstrapOwner(instance.app);
      const visitor = await registerMember(instance.app, owner.cookie);

      await getManor(instance.app, owner.cookie);
      await getManor(instance.app, visitor.cookie);

      const cared = await instance.app.inject({
        method: "POST",
        url: `/api/manor/friends/${owner.userId}/actions`,
        headers: { cookie: visitor.cookie },
        payload: { type: "remove-weeds", landId: 2 }
      });
      expect(cared.statusCode, JSON.stringify(cared.json())).toBe(200);
      expect(cared.json()).toMatchObject({
        visitor: { owner: { userId: visitor.userId }, farmExperience: 2 },
        owner: { owner: { userId: owner.userId } }
      });
      expect(cared.json().owner.farm.lands[1]).toMatchObject({ weeds: false });

      prepareStealableOwnerState(instance.repository, owner.userId);
      const cropStolen = await instance.app.inject({
        method: "POST",
        url: `/api/manor/friends/${owner.userId}/actions`,
        headers: { cookie: visitor.cookie },
        payload: { type: "steal-crop", landId: 1 }
      });
      expect(cropStolen.statusCode, JSON.stringify(cropStolen.json())).toBe(200);
      expect(cropStolen.json().message).toContain("偷到了");
      expect(cropStolen.json().owner.farm.lands[0].stolen).toBeGreaterThanOrEqual(1);
      expect(cropStolen.json().visitor.farm.produceInventory).toEqual(
        expect.arrayContaining([expect.objectContaining({ sourceId: 6, quantity: expect.any(Number) })])
      );

      const duplicateCrop = await instance.app.inject({
        method: "POST",
        url: `/api/manor/friends/${owner.userId}/actions`,
        headers: { cookie: visitor.cookie },
        payload: { type: "steal-crop", landId: 1 }
      });
      expect(duplicateCrop.statusCode).toBe(400);
      expect(duplicateCrop.json().error).toContain("已经偷过");

      const productStolen = await instance.app.inject({
        method: "POST",
        url: `/api/manor/friends/${owner.userId}/actions`,
        headers: { cookie: visitor.cookie },
        payload: { type: "steal-product", serial: 2 }
      });
      expect(productStolen.statusCode, JSON.stringify(productStolen.json())).toBe(200);
      expect(productStolen.json().owner.pasture.animals[1]).toMatchObject({ stolenProduct: 1 });
      expect(productStolen.json().visitor.pasture.productInventory).toEqual(
        expect.arrayContaining([expect.objectContaining({ sourceId: 1002, quantity: 1 })])
      );

      const friendView = await instance.app.inject({
        method: "GET",
        url: `/api/manor/friends/${owner.userId}`,
        headers: { cookie: visitor.cookie }
      });
      expect(friendView.statusCode).toBe(200);
      expect(friendView.json().owner).toEqual({ userId: owner.userId, displayName: "庄园主人" });

      const social = await instance.app.inject({
        method: "GET",
        url: "/api/manor/social",
        headers: { cookie: visitor.cookie }
      });
      expect(social.statusCode).toBe(200);
      expect(social.json().friends).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: owner.userId, displayName: "庄园主人" })])
      );
      expect(social.json().farmRanking).toHaveLength(2);
      expect(social.json().pastureRanking).toHaveLength(2);

      const guestbook = await instance.app.inject({
        method: "POST",
        url: `/api/manor/friends/${owner.userId}/guestbook`,
        headers: { cookie: visitor.cookie },
        payload: { content: "作物长得不错" }
      });
      expect(guestbook.statusCode, JSON.stringify(guestbook.json())).toBe(200);
      expect(guestbook.json()).toMatchObject({
        ownerUserId: owner.userId,
        canClear: false,
        messages: [expect.objectContaining({ senderUserId: visitor.userId, content: "作物长得不错" })]
      });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps farm and pasture friend protocols synchronized and opens every friend pasture", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-friend-protocol-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      const firstFriend = await registerMember(instance.app, owner.cookie);
      const secondFriend = await registerMember(instance.app, owner.cookie, {
        username: "second-visitor",
        displayName: "第二位好友",
        password: "second-visitor-password"
      });
      await getManor(instance.app, owner.cookie);
      await getManor(instance.app, firstFriend.cookie);
      await getManor(instance.app, secondFriend.cookie);

      const farmResponse = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=friend&refresh=true",
        headers: { cookie: secondFriend.cookie }
      });
      const pastureResponse = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=friend",
        headers: { cookie: secondFriend.cookie }
      });
      expect(farmResponse.statusCode, farmResponse.body).toBe(200);
      expect(pastureResponse.statusCode, pastureResponse.body).toBe(200);
      const farmFriends = farmResponse.json() as Array<{
        uId: number;
        pf: number;
        yellowlevel: number;
        yellowstatus: number;
      }>;
      const pastureFriends = pastureResponse.json() as typeof farmFriends;
      const farmIds = farmFriends.map((friend) => friend.uId).sort((left, right) => left - right);
      const pastureIds = pastureFriends.map((friend) => friend.uId).sort((left, right) => left - right);
      expect(farmIds).toHaveLength(3);
      expect(farmIds).toEqual(pastureIds);
      expect(farmFriends).toEqual(expect.arrayContaining([
        expect.objectContaining({ pf: 1, yellowlevel: 7, yellowstatus: 2 })
      ]));
      expect(pastureFriends.every((friend) => (
        friend.pf === 1 && friend.yellowlevel === 7 && friend.yellowstatus === 2
      ))).toBe(true);

      const refreshedSelector = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=friend&refresh=friend",
        headers: { cookie: secondFriend.cookie }
      });
      expect(refreshedSelector.statusCode, refreshedSelector.body).toBe(200);
      const callbackMatch = /^_callback\((.*)\);$/s.exec(refreshedSelector.body);
      expect(callbackMatch).not.toBeNull();
      const selector = JSON.parse(callbackMatch?.[1] ?? "{}") as { items?: Array<{ uin: number }> };
      expect(selector.items?.map((friend) => friend.uin).sort((left, right) => left - right)).toEqual(
        farmIds.filter((id) => id !== stableFlashUserId(secondFriend.userId))
      );

      const friendPasture = await instance.app.inject({
        method: "GET",
        url: `/api/manor/flash/pasture?mod=cgi_enter&uId=${stableFlashUserId(owner.userId)}`,
        headers: { cookie: secondFriend.cookie }
      });
      expect(friendPasture.statusCode, friendPasture.body).toBe(200);
      expect(friendPasture.json()).toMatchObject({
        user: {
          uId: stableFlashUserId(owner.userId),
          userName: "庄园主人",
          yellowlevel: 7,
          yellowstatus: 2
        }
      });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("serves the second-batch original task, social, reward, renewal and exchange protocols", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-v7-protocol-gap-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      const visitor = await registerMember(instance.app, owner.cookie);
      await getManor(instance.app, owner.cookie);
      await getManor(instance.app, visitor.cookie);

      const ownerState = instance.repository.getManorV7State(owner.userId);
      const visitorState = instance.repository.getManorV7State(visitor.userId);
      if (!ownerState || !visitorState) throw new Error("V7 protocol test state missing");
      const preparedOwner: ManorV7State = structuredClone(ownerState);
      preparedOwner.coins = 100_000;
      preparedOwner.farmExperience = manorV7ExperienceForLevel(5);
      preparedOwner.pastureExperience = manorV7ExperienceForLevel(5);
      preparedOwner.pasture.animals = [];
      preparedOwner.revision += 1;
      preparedOwner.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, ownerState.revision, preparedOwner);
      const preparedVisitor: ManorV7State = structuredClone(visitorState);
      preparedVisitor.coins = 10_000;
      preparedVisitor.revision += 1;
      preparedVisitor.updatedAt = Date.now();
      instance.repository.updateManorV7State(visitor.userId, visitorState.revision, preparedVisitor);

      const friendGrass = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_feed_food",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `foodnum=10&type=2&uId=${stableFlashUserId(owner.userId)}`
      });
      expect(friendGrass.statusCode, friendGrass.body).toBe(200);
      expect(friendGrass.json()).toMatchObject({ code: 1, money: 300, total: 30, type: 2 });
      expect(instance.repository.getManorV7State(visitor.userId)).toMatchObject({ coins: 9_700 });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({ pasture: { grass: 30 } });

      const mosquitoes = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_demolish_pasture",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `type=1&num=25&uId=${stableFlashUserId(owner.userId)}`
      });
      expect(mosquitoes.statusCode, mosquitoes.body).toBe(200);
      expect(mosquitoes.json()).toMatchObject({ code: 1, leftnum: 0, num: 25, total: 25, type: 1 });

      const acceptedTask = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_up_task",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "act=1"
      });
      expect(acceptedTask.json()).toMatchObject({ ecode: 0, task: { taskFlag: 1, taskId: 0 } });
      const completedTask = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_up_task",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "act=2"
      });
      expect(completedTask.json()).toMatchObject({ addExp: 50, ecode: 0, money: 50, task: { taskId: 1 } });

      const levelReward = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_levelup",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "level=3"
      });
      expect(levelReward.json()).toMatchObject({ code: 1, ecode: 0, level: 3, item: expect.any(Array) });
      expect(levelReward.json().item).toHaveLength(3);

      const firstGuide = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_fetch_strategy_rules",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "bitpos=11"
      });
      const secondGuide = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_fetch_strategy_rules",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "bitpos=11"
      });
      expect(firstGuide.json()).toEqual({ bit_flag: 1, ecode: 0 });
      expect(secondGuide.json()).toEqual({ bit_flag: 0, ecode: 0 });

      const giftQuery = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_return_gift",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "opt=0"
      });
      expect(giftQuery.json()).toMatchObject({ code: 1, item: expect.any(Array), vipItem: expect.any(Array) });
      const giftClaim = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_return_gift",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "opt=1"
      });
      expect(giftClaim.json()).toMatchObject({ code: 1, ecode: 0, money: 1_000 });
      const giftDuplicate = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_return_gift",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "opt=1"
      });
      expect(giftDuplicate.json()).toMatchObject({ code: 0, direction: "VIP 回归礼包已经领取" });

      const decoration = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=item&act=buy",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "itemId=45&useFB=1"
      });
      expect(decoration.json()).toMatchObject({ code: 1, itemId: 45 });
      const beforeExpiry = instance.repository.getManorV7State(owner.userId);
      if (!beforeExpiry) throw new Error("V7 decoration state missing");
      const expired: ManorV7State = structuredClone(beforeExpiry);
      const ownership = expired.decorationOwnerships.find((candidate) => (
        candidate.area === "farm" && candidate.decorationId === 45
      ));
      if (!ownership) throw new Error("V7 decoration ownership missing");
      ownership.validUntil = Date.now() - 1_000;
      expired.revision += 1;
      expired.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, beforeExpiry.revision, expired);
      const renewed = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=item&act=renew",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "itemId=45&useFB=1"
      });
      expect(renewed.json()).toMatchObject({ code: 1, direction: "续期成功。", itemId: 45, money: 0 });
      expect(renewed.json().itemValidTime).toBeGreaterThan(Math.floor(Date.now() / 1_000));

      const redeemed = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=market&act=change",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "code=%20manor2026%20"
      });
      expect(redeemed.json()).toMatchObject({
        code: 1,
        direction: "兑换成功",
        ecode: 0,
        item: expect.any(Array),
        money: 5_000,
        vipItem: expect.any(Array)
      });
      const duplicateCode = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=market&act=change",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "code=MANOR2026"
      });
      expect(duplicateCode.json()).toMatchObject({ code: 0, direction: "该兑换码已经使用" });

      const cleared = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_clear_log",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(cleared.json()).toEqual({ code: 1, ecode: 0 });
      expect(instance.repository.getManorV7State(owner.userId)?.activities).toEqual([]);
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("serves the remaining original farm task, weather, yield, watchdog and hidden-seed protocols", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-v7-original-protocol-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      await getManor(instance.app, owner.cookie);

      const acceptedTask = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=task&act=accept",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(acceptedTask.json()).toMatchObject({ taskFlag: 1, taskId: 0 });
      const runningTask = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=task&act=run",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(runningTask.json()).toEqual({ taskFlag: 1, taskId: 0 });
      const updatedTask = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=task&act=update",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(updatedTask.json()).toMatchObject({
        direction: expect.stringContaining("完成任务"),
        item: expect.any(Array),
        task: { taskFlag: 2, taskId: 1 }
      });
      const levelUp = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=feast&act=levelup",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(levelUp.json()).toMatchObject({ code: 1, direction: expect.stringContaining("成功升到第") });

      const current = instance.repository.getManorV7State(owner.userId);
      if (!current) throw new Error("V7 original protocol state missing");
      const prepared: ManorV7State = structuredClone(current);
      const crop = manorV7Crop(1);
      const land = prepared.farm.lands[0]!;
      land.cropId = crop.id;
      land.growthSeconds = crop.growthSeconds;
      land.harvests = 0;
      land.watered = true;
      land.weeds = false;
      land.pests = false;
      land.stolen = 0;
      land.thiefUserIds = [];
      land.yieldPenaltyPercent = 25;
      prepared.randomState = 1_972;
      prepared.revision += 1;
      prepared.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, current.revision, prepared);

      const bootstrap = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?qzonemod=user&act=run",
        headers: { cookie: owner.cookie }
      });
      expect(bootstrap.json()).toMatchObject({ weather: { weatherDesc: expect.any(String), weatherId: expect.any(Number) } });
      const output = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=farmlandstatus&act=getOutput",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `ownerId=${stableFlashUserId(owner.userId)}&place=0`
      });
      expect(output.json()).toMatchObject({
        farmlandIndex: 0,
        status: {
          health: 75,
          output: Math.ceil(crop.baseYield * 0.75),
          leavings: Math.ceil(crop.baseYield * 0.75)
        }
      });

      const finalCropState = instance.repository.getManorV7State(owner.userId);
      if (!finalCropState) throw new Error("V7 hidden seed state missing");
      const readyToScarify: ManorV7State = structuredClone(finalCropState);
      readyToScarify.farm.lands[0]!.harvests = crop.harvestCycles;
      readyToScarify.farm.seedInventory = [];
      readyToScarify.randomState = 1_972;
      readyToScarify.revision += 1;
      readyToScarify.updatedAt = Date.now() + 60_000;
      instance.repository.updateManorV7State(owner.userId, finalCropState.revision, readyToScarify);
      const scarified = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=farmlandstatus&act=scarify",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "place=0"
      });
      const afterScarify = instance.repository.getManorV7State(owner.userId);
      expect(afterScarify?.farmExperience).toBe(readyToScarify.farmExperience + 3);
      expect(afterScarify?.farm.seedInventory).toHaveLength(1);
      expect(scarified.json()).toMatchObject({
        code: 1,
        exp: 3,
        farmlandIndex: 0,
        randsend: { id: expect.any(String), name: expect.any(String), num: expect.any(Number), type: 1 }
      });

      const hungryDog = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=dog&act=feedMoney",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(hungryDog.json()).toEqual({ hours: 0, saleOut: false });
      const boughtFood = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=usertool&act=buyTool",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "type=909090&tId=9001&number=1"
      });
      expect(boughtFood.json()).toMatchObject({ code: 1, tId: 9001, type: 909090 });
      const fedDog = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=dog&act=feedDog",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(fedDog.json()).toMatchObject({ code: 1, direction: "看门动物正在工作", hours: expect.any(Number) });
      expect(fedDog.json().hours).toBeGreaterThanOrEqual(23);
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("sends original flower gifts and processes the manure fertilizer recipe atomically", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-v7-flower-workshop-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      const visitor = await registerMember(instance.app, owner.cookie);
      await getManor(instance.app, owner.cookie);
      await getManor(instance.app, visitor.cookie);

      const ownerState = instance.repository.getManorV7State(owner.userId);
      const visitorState = instance.repository.getManorV7State(visitor.userId);
      if (!ownerState || !visitorState) throw new Error("V7 flower workshop state missing");
      const preparedOwner: ManorV7State = structuredClone(ownerState);
      preparedOwner.coins = 2_000;
      preparedOwner.pasture.materialInventory = [{ sourceId: 1506, quantity: 5 }];
      preparedOwner.farm.produceInventory = [{ sourceId: 41, quantity: 5 }];
      preparedOwner.revision += 1;
      preparedOwner.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, ownerState.revision, preparedOwner);
      const preparedVisitor: ManorV7State = structuredClone(visitorState);
      preparedVisitor.farm.produceInventory = [{ sourceId: 41, quantity: 3 }];
      preparedVisitor.revision += 1;
      preparedVisitor.updatedAt = Date.now();
      instance.repository.updateManorV7State(visitor.userId, visitorState.revision, preparedVisitor);

      const sent = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=user&act=send",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `to=${stableFlashUserId(owner.userId)}&fId=12&w=%E7%A5%9D%E4%BD%A0%E5%BC%80%E5%BF%83`
      });
      expect(sent.json()).toMatchObject({ code: 1, direction: expect.stringContaining("寄出去") });
      expect(instance.repository.getManorV7State(visitor.userId)?.farm.produceInventory).toEqual([]);

      const received = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=user&act=received",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(received.json()).toMatchObject({
        code: 1,
        flowerPath: "module/ui/flower",
        myFlower: [expect.objectContaining({ fId: 12, friendName: "来访好友", word: "祝你开心" })]
      });
      const flower = received.json().myFlower[0] as { fromId: number; time: number };
      const card = await instance.app.inject({
        method: "GET",
        url: `/api/manor/flash/farm?mod=user&act=card&uid=${flower.fromId}&time=${flower.time}`,
        headers: { cookie: owner.cookie }
      });
      expect(card.json()).toEqual({ code: 1, time: flower.time, uid: flower.fromId, word: "祝你开心" });
      const deleted = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=user&act=del",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `uid=${flower.fromId}&time=${flower.time}`
      });
      expect(deleted.json()).toEqual({
        cardId: flower.time,
        code: 1,
        direction: "ok",
        ecode: 1,
        friendUin: flower.fromId
      });
      const afterDelete = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=user&act=received",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(afterDelete.json()).toMatchObject({ code: 1, myFlower: [] });

      const processed = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=user&act=case",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: ""
      });
      expect(processed.json()).toMatchObject({ code: 1, money: -1_000, poptype: 0 });
      const after = instance.repository.getManorV7State(owner.userId);
      expect(after).toMatchObject({ coins: 1_000, pasture: { materialInventory: [] } });
      expect(after?.farm.produceInventory).toEqual([]);
      expect(after?.farm.toolInventory).toEqual(expect.arrayContaining([{ sourceId: 3, quantity: 1 }]));
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps the original friend filter synchronized across farm and pasture visits", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-v7-friend-filter-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      const visitor = await registerMember(instance.app, owner.cookie);
      await getManor(instance.app, owner.cookie);
      await getManor(instance.app, visitor.cookie);
      const visitorFlashId = stableFlashUserId(visitor.userId);
      const ownerFlashId = stableFlashUserId(owner.userId);

      const added = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=friend&act=addFilter",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `uId=${visitorFlashId}`
      });
      expect(added.json()).toEqual({ code: 1, direction: "已将该好友加入拦截名单", uId: visitorFlashId });
      const listed = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=friend&act=listFilter",
        headers: { cookie: owner.cookie }
      });
      expect(listed.json()).toEqual({ [String(visitorFlashId)]: 1 });

      const blockedFarm = await instance.app.inject({
        method: "GET",
        url: `/api/manor/flash/farm?qzonemod=user&act=run&ownerId=${ownerFlashId}`,
        headers: { cookie: visitor.cookie }
      });
      const blockedPasture = await instance.app.inject({
        method: "GET",
        url: `/api/manor/flash/pasture?mod=cgi_enter&uId=${ownerFlashId}`,
        headers: { cookie: visitor.cookie }
      });
      expect(blockedFarm.json()).toMatchObject({ code: 0, direction: "对方暂未允许你进入庄园" });
      expect(blockedPasture.json()).toMatchObject({ code: 0, direction: "对方暂未允许你进入庄园" });

      const removed = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=friend&act=delFilter",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `uin=${visitorFlashId}`
      });
      expect(removed.json()).toEqual({ code: 1, direction: "已将该好友移出拦截名单", uId: visitorFlashId });
      const farm = await instance.app.inject({
        method: "GET",
        url: `/api/manor/flash/farm?qzonemod=user&act=run&ownerId=${ownerFlashId}`,
        headers: { cookie: visitor.cookie }
      });
      const pasture = await instance.app.inject({
        method: "GET",
        url: `/api/manor/flash/pasture?mod=cgi_enter&uId=${ownerFlashId}`,
        headers: { cookie: visitor.cookie }
      });
      expect(farm.json()).toMatchObject({ user: { uId: ownerFlashId } });
      expect(pasture.json()).toMatchObject({ user: { uId: ownerFlashId } });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("restores the original seasonal animal, cookie and Spring Festival protocols", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-seasonal-protocol-test-"));
    const instance = await createApp({ databasePath: join(directory, "test.sqlite"), logger: false });
    try {
      const owner = await bootstrapOwner(instance.app);
      const visitor = await registerMember(instance.app, owner.cookie);
      await getManor(instance.app, owner.cookie);
      await getManor(instance.app, visitor.cookie);
      const ownerFlashId = stableFlashUserId(owner.userId);

      const visitorState = instance.repository.getManorV7State(visitor.userId);
      if (!visitorState) throw new Error("Seasonal visitor state missing");
      const fundedVisitor: ManorV7State = structuredClone(visitorState);
      fundedVisitor.coins = 10_000;
      fundedVisitor.pasture.wild.moralExperience = 200;
      fundedVisitor.pasture.wild.crystalInventory = [{ sourceId: 1, quantity: 15 }];
      fundedVisitor.revision += 1;
      fundedVisitor.updatedAt = Date.now();
      instance.repository.updateManorV7State(visitor.userId, visitorState.revision, fundedVisitor);

      const created = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_pasture_create_animal",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `ownerId=${ownerFlashId}&op=0`
      });
      expect(created.statusCode, created.body).toBe(200);
      expect(created.json()).toMatchObject({
        code: 1,
        drop: { id: expect.any(Number), num: 1, time: expect.any(Number), type: 12 },
        ecode: 0
      });
      expect([1085, 1086, 1593]).toContain(created.json().drop.id);

      const friendPasture = await instance.app.inject({
        method: "GET",
        url: `/api/manor/flash/pasture?mod=cgi_enter&uId=${ownerFlashId}`,
        headers: { cookie: visitor.cookie }
      });
      expect(friendPasture.statusCode, friendPasture.body).toBe(200);
      expect(friendPasture.json().beast.drop).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: created.json().drop.id, num: 1, type: 12 })
      ]));

      const adopted = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_pasture_adopt_animal",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `id=${created.json().drop.id}&ownerId=${ownerFlashId}`
      });
      expect(adopted.statusCode, adopted.body).toBe(200);
      expect(adopted.json()).toEqual({ bit_flag: 1, code: 1, ecode: 0 });
      expect(instance.repository.getManorV7State(owner.userId)?.seasonal.animalDrops).toEqual([]);
      expect(instance.repository.getManorV7State(visitor.userId)?.pasture.cubInventory).toEqual(
        expect.arrayContaining([{ sourceId: created.json().drop.id, quantity: 1 }])
      );

      const cookieSprites = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=xiaoyoucgi_farm_get_halloweenseed",
        headers: { cookie: visitor.cookie }
      });
      expect(cookieSprites.statusCode, cookieSprites.body).toBe(200);
      expect(cookieSprites.json()).toEqual({ code: 1, id: 1037, num: 3 });

      const offered = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_putin",
        headers: { cookie: visitor.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: `uId=${ownerFlashId}`
      });
      expect(offered.statusCode, offered.body).toBe(200);
      expect([1, 2]).toContain(offered.json().num);
      expect(instance.repository.getManorV7State(owner.userId)?.seasonal).toMatchObject({
        halloweenCookies: 1,
        cookieOfferedByUserIds: [visitor.userId]
      });

      const currentOwner = instance.repository.getManorV7State(owner.userId);
      if (!currentOwner) throw new Error("Seasonal owner state missing before exchange");
      const exchangeReady: ManorV7State = structuredClone(currentOwner);
      exchangeReady.seasonal.halloweenCookies = 5;
      exchangeReady.revision += 1;
      exchangeReady.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, currentOwner.revision, exchangeReady);
      const exchanged = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/pasture?mod=cgi_pasture_activity",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "actid=1&op=1"
      });
      expect(exchanged.statusCode, exchanged.body).toBe(200);
      expect(exchanged.json()).toEqual({ code: 1 });
      expect(instance.repository.getManorV7State(owner.userId)).toMatchObject({
        seasonal: { halloweenCookies: 0 },
        pasture: { cubInventory: expect.arrayContaining([{ sourceId: 1537, quantity: 1 }]) }
      });

      const springStatus = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=cgi_pasture_checkbitmap",
        headers: { cookie: owner.cookie }
      });
      expect(springStatus.json()).toMatchObject({ anim_num: 0, code: 1, farm_num: 0, flag: 0 });
      const springGift = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_pasture_chunjie",
        headers: { cookie: owner.cookie }
      });
      expect(springGift.statusCode, springGift.body).toBe(200);
      expect(springGift.json()).toEqual({ code: 1, vip: 1 });
      const claimedSpringStatus = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/pasture?mod=cgi_pasture_checkbitmap",
        headers: { cookie: owner.cookie }
      });
      expect(claimedSpringStatus.json()).toMatchObject({ anim_num: 4, code: 1, farm_num: 4, flag: 1 });

      const ceremonyOwner = instance.repository.getManorV7State(owner.userId);
      if (!ceremonyOwner) throw new Error("Seasonal owner state missing before ceremony package");
      const ceremonyReady: ManorV7State = structuredClone(ceremonyOwner);
      ceremonyReady.farm.produceInventory = [{ sourceId: 450, quantity: 1_999 }];
      ceremonyReady.revision += 1;
      ceremonyReady.updatedAt = Date.now();
      instance.repository.updateManorV7State(owner.userId, ceremonyOwner.revision, ceremonyReady);
      const ceremonyFlags = await instance.app.inject({
        method: "GET",
        url: "/api/manor/flash/farm?mod=cgi_fetch_package_flags",
        headers: { cookie: owner.cookie }
      });
      expect(ceremonyFlags.json()).toMatchObject({ bpck: 1, code: 1, ecode: 0, mcnt: 1_999 });
      const ceremonyGift = await instance.app.inject({
        method: "POST",
        url: "/api/manor/flash/farm?mod=cgi_farm_ceremony_package",
        headers: { cookie: owner.cookie, "content-type": "application/x-www-form-urlencoded" },
        payload: "type=3"
      });
      expect(ceremonyGift.statusCode, ceremonyGift.body).toBe(200);
      expect(ceremonyGift.json()).toEqual({ code: 1, ecode: 0, type: 3 });
      const ceremonyState = instance.repository.getManorV7State(owner.userId);
      expect(ceremonyState).toMatchObject({
        coins: 99_999,
        seasonal: { reunionFishGiftClaimed: true },
        farm: {
          fishPool: {
            seedInventory: expect.arrayContaining([{ sourceId: 15, quantity: 2 }]),
            unlockedFishIds: expect.arrayContaining([15])
          },
          seedInventory: expect.arrayContaining([{ sourceId: 448, quantity: 5 }]),
          produceInventory: []
        }
      });
      expect(ceremonyState?.decorationOwnerships.filter((ownership) => (
        ownership.area === "farm" && ownership.decorationId >= 377 && ownership.decorationId <= 384
      ))).toHaveLength(8);
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not expose manor test mutation routes", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-no-test-routes-"));
    const instance = await createApp({
      databasePath: join(directory, "test.sqlite"),
      logger: false,
      environment: {}
    });
    try {
      const platform = await instance.app.inject({ method: "GET", url: "/api/platform" });
      const advanceTime = await instance.app.inject({
        method: "POST",
        url: "/api/manor/test/advance-time",
        payload: { seconds: 3_600 }
      });
      const grantResource = await instance.app.inject({
        method: "POST",
        url: "/api/manor/test/grant-resource",
        payload: { resource: "coins", amount: 100 }
      });
      expect(platform.json()).toMatchObject({ manorTestToolsEnabled: false });
      expect(advanceTime.statusCode).toBe(404);
      expect(grantResource.statusCode).toBe(404);
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("exposes owner-only manor test tools when explicitly enabled", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-test-tools-"));
    const instance = await createApp({
      databasePath: join(directory, "test.sqlite"),
      logger: false,
      environment: { MANOR_TEST_TOOLS_ENABLED: "true" }
    });
    try {
      const platform = await instance.app.inject({ method: "GET", url: "/api/platform" });
      expect(platform.json()).toMatchObject({ manorTestToolsEnabled: true });

      const unauthorized = await instance.app.inject({
        method: "POST",
        url: "/api/manor/test/advance-time",
        payload: { seconds: 3_600 }
      });
      expect(unauthorized.statusCode).toBe(401);

      const owner = await bootstrapOwner(instance.app);
      const member = await registerMember(instance.app, owner.cookie);
      const forbidden = await instance.app.inject({
        method: "POST",
        url: "/api/manor/test/grant-resource",
        headers: { cookie: member.cookie },
        payload: { resource: "coins", amount: 100 }
      });
      expect(forbidden.statusCode).toBe(401);

      const initial = await getManor(instance.app, owner.cookie);
      const grant = await instance.app.inject({
        method: "POST",
        url: "/api/manor/test/grant-resource",
        headers: { cookie: owner.cookie },
        payload: { resource: "coins", amount: 1_234 }
      });
      expect(grant.statusCode, grant.body).toBe(200);
      expect(grant.json()).toMatchObject({ message: "金币已增加 1234" });

      const advance = await instance.app.inject({
        method: "POST",
        url: "/api/manor/test/advance-time",
        headers: { cookie: owner.cookie },
        payload: { seconds: 7 * 24 * 60 * 60 }
      });
      expect(advance.statusCode, advance.body).toBe(200);
      expect(advance.json()).toMatchObject({ message: "庄园时间已推进 7 天" });

      const persisted = await getManor(instance.app, owner.cookie);
      expect(persisted.coins).toBe(initial.coins + 1_234);
      expect(persisted.farm.lands[0]).toMatchObject({ harvestable: true });
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

type TestApp = Awaited<ReturnType<typeof createApp>>["app"];

async function bootstrapOwner(app: TestApp) {
  const response = await app.inject({
    method: "POST",
    url: "/api/account/bootstrap",
    payload: { username: "owner", displayName: "庄园主人", password: "owner-password" }
  });
  expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
  return { cookie: sessionCookie(response.headers["set-cookie"]), userId: String(response.json().user.id) };
}

async function registerMember(
  app: TestApp,
  ownerCookie: string,
  account: { username: string; displayName: string; password: string } = {
    username: "visitor",
    displayName: "来访好友",
    password: "visitor-password"
  }
) {
  const invite = await app.inject({
    method: "POST",
    url: "/api/account/invites",
    headers: { cookie: ownerCookie },
    payload: { expiresInDays: 7 }
  });
  expect(invite.statusCode, JSON.stringify(invite.json())).toBe(200);
  const response = await app.inject({
    method: "POST",
    url: "/api/account/register",
    payload: {
      ...account,
      inviteCode: invite.json().code
    }
  });
  expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
  return { cookie: sessionCookie(response.headers["set-cookie"]), userId: String(response.json().user.id) };
}

async function getManor(app: TestApp, cookie: string) {
  const response = await app.inject({ method: "GET", url: "/api/manor", headers: { cookie } });
  expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
  return response.json();
}

function prepareStealableOwnerState(
  repository: Awaited<ReturnType<typeof createApp>>["repository"],
  ownerUserId: string
): void {
  const current = repository.getManorV7State(ownerUserId);
  if (!current) throw new Error("Owner V7 state missing");
  const next: ManorV7State = structuredClone(current);
  const land = next.farm.lands[0]!;
  land.growthSeconds = manorV7Crop(land.cropId!).growthSeconds;
  land.watered = true;
  land.stolen = 0;
  land.thiefUserIds = [];
  const animal = next.pasture.animals[1]!;
  animal.pendingProduct = manorV7Animal(animal.animalId).baseYield;
  animal.stolenProduct = 0;
  animal.productThiefUserIds = [];
  next.revision += 1;
  next.updatedAt = Date.now();
  repository.updateManorV7State(ownerUserId, current.revision, next);
}

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error("Session cookie missing");
  return value.split(";", 1)[0] ?? "";
}
