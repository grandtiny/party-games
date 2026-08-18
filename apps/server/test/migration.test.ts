import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { migrateInternalRoomState } from "../src/domain.js";
import { SqliteRoomRepository } from "../src/repository.js";

const cleanupTasks: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanupTasks.splice(0)) cleanup();
});

describe("sqlite migrations", () => {
  it("backfills clocktower fields used by current validation", () => {
    const migrated = migrateInternalRoomState({
      id: "legacy-clocktower-room",
      code: "OLDCT1",
      gameType: "clocktower",
      phase: "role-reveal",
      ownerPlayerId: "owner",
      version: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      players: [{ id: "owner", nickname: "Owner", seat: 1, ready: true }],
      clocktower: {
        setup: { assignments: [] },
        seedCommitment: "legacy"
      }
    });

    expect(migrated.clocktower?.roleConfirmedPlayerIds).toEqual([]);
    expect(migrated.clocktower?.dayNumber).toBe(0);
    expect(migrated.clocktower?.timeline).toEqual([]);
  });

  it("backfills normal difficulty for legacy solo AI rooms", () => {
    const migrated = migrateInternalRoomState({
      id: "legacy-poker-room",
      code: "OLDPK1",
      gameType: "poker",
      phase: "lobby",
      ownerPlayerId: "owner",
      version: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      players: [{ id: "owner", nickname: "Owner", seat: 1, ready: true }],
      poker: {
        config: {
          mode: "points",
          smallBlind: 5,
          bigBlind: 10,
          aiPlayerCount: 3
        }
      }
    });

    expect(migrated.poker?.config.aiDifficulty).toBe("normal");
  });

  it("applies every migration to a new database", () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-migration-new-"));
    const databasePath = join(directory, "test.sqlite");
    const repository = new SqliteRoomRepository(databasePath);
    expect(repository.getSchemaVersion()).toBe(6);
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("upgrades a legacy room database without losing room state", () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-migration-legacy-"));
    const databasePath = join(directory, "test.sqlite");
    cleanupTasks.push(() => rmSync(directory, { recursive: true, force: true }));
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      CREATE TABLE rooms (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        game_type TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        state_json TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    const legacyState = {
      id: "legacy-room",
      code: "LEGACY",
      gameType: "clocktower",
      phase: "lobby",
      ownerPlayerId: "owner",
      version: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      players: [{ id: "owner", nickname: "Owner", seat: 1, ready: false }]
    };
    legacy
      .prepare(`
        INSERT INTO rooms (
          id, code, game_type, password_salt, password_hash,
          state_json, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        legacyState.id,
        legacyState.code,
        legacyState.gameType,
        "salt",
        "hash",
        JSON.stringify(legacyState),
        0,
        legacyState.createdAt,
        legacyState.updatedAt
      );
    legacy.close();

    const repository = new SqliteRoomRepository(databasePath);
    expect(repository.getSchemaVersion()).toBe(6);
    expect(repository.getRoom("LEGACY")).toMatchObject({
      schemaVersion: 1,
      id: "legacy-room",
      ownerPlayerId: "owner",
      players: [{ id: "owner", seat: 1 }]
    });
    repository.close();
  });
});
