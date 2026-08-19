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
        art: { source: "legacy", backgroundUrl: "/api/manor/assets/background" }
      });
      expect(initial.json().catalog).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "radish", seeds: 3 })])
      );
      expect(initial.json().plots).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 1, status: "empty" })])
      );
      expect(initial.json().plots).toHaveLength(18);

      const planted = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "plant", plotId: 1, cropId: "radish" }
      });
      expect(planted.statusCode).toBe(200);
      expect(planted.json().revision).toBe(1);
      expect(planted.json().catalog).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "radish", seeds: 2 })])
      );
      expect(planted.json().plots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, status: "growing", cropId: "radish" })
        ])
      );

      const watered = await first.app.inject({
        method: "POST",
        url: "/api/manor/actions",
        headers: { cookie },
        payload: { type: "water", plotId: 1 }
      });
      expect(watered.statusCode).toBe(200);
      expect(watered.json().revision).toBe(2);
      expect(watered.json().plots).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 1, watered: true })])
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
        expect(restored.json().revision).toBe(2);
        expect(restored.json().catalog).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: "radish", seeds: 2 })])
        );
        expect(restored.json().plots).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 1, cropId: "radish", watered: true })
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
