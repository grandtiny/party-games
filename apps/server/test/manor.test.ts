import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("manor account persistence", () => {
  it("uses the platform account session and keeps one farm per account", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-test-"));
    const databasePath = join(directory, "test.sqlite");
    const legacyRoot = join(directory, "legacy");
    const legacyBackground = join(legacyRoot, "module", "nc", "farm", "diy", "26f.jpg");
    mkdirSync(join(legacyRoot, "module", "nc", "farm", "diy"), { recursive: true });
    writeFileSync(legacyBackground, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    const environment = {
      MANOR_LEGACY_ASSETS_PATH: legacyRoot,
      MANOR_TIME_SCALE: "120"
    };
    const first = await createApp({ databasePath, logger: false, environment });
    let firstClosed = false;
    try {
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
      const cookie = sessionCookie(setup.headers["set-cookie"]);
      const initial = await first.app.inject({
        method: "GET",
        url: "/api/manor",
        headers: { cookie }
      });
      expect(initial.statusCode).toBe(200);
      expect(initial.json()).toMatchObject({
        profile: { displayName: "农场主", coins: 120, level: 1 },
        starterGift: { claimed: false },
        art: { source: "legacy", backgroundUrl: "/api/manor/assets/background" }
      });
      expect(initial.json().inventory.fertilizers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "ordinary", amount: 0, effectSeconds: 30 }),
          expect.objectContaining({ id: "fast", amount: 0, effectSeconds: 75 }),
          expect.objectContaining({ id: "instant", amount: 0, effectSeconds: 165 })
        ])
      );
      expect(initial.json().catalog).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "radish", seeds: 3 })])
      );
      expect(initial.json().plots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, status: "empty", unlocked: true }),
          expect.objectContaining({
            id: 7,
            status: "empty",
            unlocked: false,
            nextUnlock: true,
            unlockLevel: 5,
            unlockCost: 10_000
          })
        ])
      );
      expect(initial.json().plots).toHaveLength(18);

      const lockedPlot = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "plant", plotId: 7, cropId: "radish" }
      });
      expect(lockedPlot.statusCode).toBe(400);
      expect(lockedPlot.json().error).toContain("这块土地尚未开垦");

      const reclaimAttempt = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "reclaim-plot", plotId: 7 }
      });
      expect(reclaimAttempt.statusCode).toBe(400);
      expect(reclaimAttempt.json().error).toContain("达到 5 级后才能开垦");

      const starterGift = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "claim-starter-gift" }
      });
      expect(starterGift.statusCode).toBe(200);
      expect(starterGift.json()).toMatchObject({ revision: 1, starterGift: { claimed: true } });
      expect(starterGift.json().inventory.fertilizers).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "ordinary", amount: 4 })])
      );
      expect(starterGift.json().catalog).toEqual(
        expect.arrayContaining([expect.objectContaining({ sourceId: 7, seeds: 2 })])
      );

      const duplicateGift = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "claim-starter-gift" }
      });
      expect(duplicateGift.statusCode).toBe(400);
      expect(duplicateGift.json().error).toContain("新手礼包已经领取");

      const planted = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "plant", plotId: 1, cropId: "radish" }
      });
      expect(planted.statusCode).toBe(200);
      expect(planted.json().revision).toBe(2);
      expect(planted.json().catalog).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "radish", seeds: 2 })])
      );
      expect(planted.json().plots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, status: "growing", cropId: "radish", watered: true })
        ])
      );

      const fertilized = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "fertilize", plotId: 1 }
      });
      expect(fertilized.statusCode).toBe(200);
      expect(fertilized.json().revision).toBe(3);
      expect(fertilized.json().inventory.fertilizers).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "ordinary", amount: 3 })])
      );

      const secondPlot = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "plant", plotId: 2, cropId: "radish" }
      });
      expect(secondPlot.statusCode).toBe(200);
      expect(secondPlot.json().revision).toBe(4);
      expect(secondPlot.json().catalog).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "radish", seeds: 1 })])
      );
      expect(secondPlot.json().plots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 2, cropId: "radish", watered: true })
        ])
      );

      const background = await first.app.inject({
        method: "GET",
        url: "/api/manor/assets/background"
      });
      expect(background.statusCode).toBe(200);
      expect(background.headers["content-type"]).toContain("image/jpeg");

      await first.app.close();
      firstClosed = true;
      const second = await createApp({ databasePath, logger: false, environment });
      try {
        const restored = await second.app.inject({
          method: "GET",
          url: "/api/manor",
          headers: { cookie }
        });
        expect(restored.statusCode).toBe(200);
        expect(restored.json().revision).toBe(4);
        expect(restored.json()).toMatchObject({ starterGift: { claimed: true } });
        expect(restored.json().catalog).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: "radish", seeds: 1 })])
        );
        expect(restored.json().plots).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 1, cropId: "radish", watered: true }),
            expect.objectContaining({ id: 2, cropId: "radish", watered: true })
          ])
        );
      } finally {
        await second.app.close();
      }
    } finally {
      if (!firstClosed) await first.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("persists pasture actions in the same account manor save", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-pasture-test-"));
    const databasePath = join(directory, "test.sqlite");
    const first = await createApp({ databasePath, logger: false });
    let firstClosed = false;
    try {
      expect((await first.app.inject({ method: "GET", url: "/api/manor/pasture" })).statusCode).toBe(401);
      const setup = await first.app.inject({
        method: "POST",
        url: "/api/account/bootstrap",
        payload: {
          username: "rancher",
          displayName: "牧场主",
          password: "rancher-password"
        }
      });
      const cookie = sessionCookie(setup.headers["set-cookie"]);
      const initial = await first.app.inject({
        method: "GET",
        url: "/api/manor/pasture",
        headers: { cookie }
      });
      expect(initial.statusCode).toBe(200);
      expect(initial.json()).toMatchObject({
        revision: 0,
        profile: { displayName: "牧场主", coins: 120, level: 1, experience: 0 },
        grass: 20,
        grassCapacity: 400,
        grassPrice: 60,
        houses: {
          hutch: { level: 1, capacity: 2, occupied: 2 },
          shed: { level: 0, capacity: 0, occupied: 0 }
        }
      });
      expect(initial.json().animals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ serial: 1, sourceId: 1002, visualState: "lifecycle_complete" }),
          expect.objectContaining({ serial: 2, sourceId: 1002, visualState: "ready_to_produce" })
        ])
      );
      expect(initial.json().catalog).toHaveLength(35);

      const invalidAnimal = await first.app.inject({
        method: "POST",
        url: "/api/manor/pasture/actions",
        headers: { cookie },
        payload: { type: "buy-animal", animalId: 1000, quantity: 1 }
      });
      expect(invalidAnimal.statusCode).toBe(400);

      const produced = await first.app.inject({
        method: "POST",
        url: "/api/manor/pasture/actions",
        headers: { cookie },
        payload: { type: "start-animal-production", animalSerial: 2 }
      });
      expect(produced.statusCode).toBe(200);
      expect(produced.json()).toMatchObject({
        revision: 1,
        profile: { coins: 120, experience: 5 }
      });
      expect(produced.json().animals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ serial: 2, pendingProduct: 12, canHarvestProduct: true })
        ])
      );

      const harvested = await first.app.inject({
        method: "POST",
        url: "/api/manor/pasture/actions",
        headers: { cookie },
        payload: { type: "harvest-animal", animalSerial: 1 }
      });
      expect(harvested.statusCode).toBe(200);
      expect(harvested.json()).toMatchObject({ revision: 2, profile: { experience: 33 } });
      expect(harvested.json().inventory).toEqual(
        expect.arrayContaining([expect.objectContaining({ animalId: 1002, animalCount: 1 })])
      );

      const sold = await first.app.inject({
        method: "POST",
        url: "/api/manor/pasture/actions",
        headers: { cookie },
        payload: { type: "sell-pasture-item", animalId: 1002, itemType: "animal", quantity: 1 }
      });
      expect(sold.statusCode).toBe(200);
      expect(sold.json()).toMatchObject({ revision: 3, profile: { coins: 1_580 } });

      const farm = await first.app.inject({
        method: "GET",
        url: "/api/manor",
        headers: { cookie }
      });
      expect(farm.json()).toMatchObject({ revision: 3, profile: { coins: 1_580 } });

      await first.app.close();
      firstClosed = true;
      const second = await createApp({ databasePath, logger: false });
      try {
        const restored = await second.app.inject({
          method: "GET",
          url: "/api/manor/pasture",
          headers: { cookie }
        });
        expect(restored.statusCode).toBe(200);
        expect(restored.json()).toMatchObject({
          revision: 3,
          profile: { coins: 1_580, experience: 33 }
        });
        expect(restored.json().animals).toHaveLength(1);
        expect(restored.json().inventory).toEqual([]);
      } finally {
        await second.app.close();
      }
    } finally {
      if (!firstClosed) await first.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("revalidates classic manor assets while retaining immutable hashed assets", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-manor-static-test-"));
    const databasePath = join(directory, "test.sqlite");
    const webDistPath = join(directory, "web");
    const classicAssetPath = join(webDistPath, "assets", "manor", "classic");
    const hashedAssetPath = join(webDistPath, "assets");
    mkdirSync(classicAssetPath, { recursive: true });
    writeFileSync(join(webDistPath, "index.html"), "<!doctype html><title>test</title>");
    writeFileSync(join(classicAssetPath, "crop-radish-3.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(hashedAssetPath, "index-abc123.js"), "export {};\n");

    const instance = await createApp({ databasePath, webDistPath, logger: false });
    try {
      const classicAsset = await instance.app.inject({
        method: "GET",
        url: "/assets/manor/classic/crop-radish-3.png?v=classic-crops-v2"
      });
      expect(classicAsset.statusCode).toBe(200);
      expect(classicAsset.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");

      const hashedAsset = await instance.app.inject({
        method: "GET",
        url: "/assets/index-abc123.js"
      });
      expect(hashedAsset.statusCode).toBe(200);
      expect(hashedAsset.headers["cache-control"]).toContain("max-age=31536000");
      expect(hashedAsset.headers["cache-control"]).toContain("immutable");
    } finally {
      await instance.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error("Session cookie missing");
  return value.split(";", 1)[0] ?? "";
}
